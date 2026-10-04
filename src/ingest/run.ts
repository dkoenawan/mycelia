// The ingester's pipeline (DES-002). Phase 5, per item: classify, fetch if
// thin, fixed targets, agent step, plan, journal and apply, re-hash, check,
// then commit or roll back. Only the agent step is model-driven.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AgentItemError, type AgentProvider } from "./agent/provider.ts";
import { ARCHIVE_CAPTURE_DIR, itemStem, planAsk, planResolvedAsks, type AskDetails, type OpenAsk } from "./asks.ts";
import { addBacklink } from "./backlinks.ts";
import { currentSha, type CaptureItem } from "./capture.ts";
import { checkHold, checkIngest } from "./check.ts";
import { extractUrls, fetchSources, isThin, type SourcesResult } from "./fetch.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { RollbackConflict, type Journal, type PlanOp, type Txn } from "./journal.ts";
import type { ItemRecord, Ledger } from "./ledger.ts";
import { OUTPUT_SCHEMA, parseRawOutput, validateOutput, type Output } from "./output.ts";
import { buildPrompt } from "./prompt.ts";
import { archiveBase, renderResource, resourceSlugBase } from "./render.ts";
import type { FlatTargetIndex, Target } from "./targets.ts";
import { parseWikilinks, type VaultIndex } from "./vault.ts";

export const AGENT_TIMEOUT_MS = 300_000;
export const AGENT_MAX_TURNS = 12;
export const STRIKES_FOR_ASK = 3;

export interface ItemContext {
  root: string;
  run: string;
  runDate: string;
  vault: VaultIndex;
  targets: FlatTargetIndex;
  asks: OpenAsk[];
  ledger: Ledger;
  journal: Journal;
  provider: AgentProvider;
  env: NodeJS.ProcessEnv;
  log: (msg: string) => void;
  /** Test seam: runs after each applied operation. */
  onApplyStep?: (i: number) => Promise<void> | void;
  /** Test seam: runs after apply, before the re-hash and check. */
  afterApply?: () => Promise<void> | void;
}

export type ItemOutcome =
  | { kind: "ingested"; record: ItemRecord; resource: string }
  | { kind: "held"; record: ItemRecord; ask: string }
  | { kind: "failed"; record: ItemRecord; ask?: string }
  | { kind: "network-deferred"; item: CaptureItem; failures: SourcesResult["failures"] };

/** A fault that must stop the run (D12): exit 4, no strike. */
export class RunAbort extends Error {
  override name = "RunAbort";
}

function base(ctx: ItemContext, item: CaptureItem): Pick<ItemRecord, "event" | "run" | "item" | "sha256"> {
  return { event: "item", run: ctx.run, item: item.name, sha256: item.sha };
}

/** Wikilinks in the item that resolve to indexed targets (REQ-019). */
export function fixedTargets(text: string, vault: VaultIndex, index: FlatTargetIndex): Target[] {
  const out: Target[] = [];
  for (const l of parseWikilinks(splitFrontmatter(text).body)) {
    const m = vault.matches(l.target);
    if (m.length !== 1) continue;
    const t = index.targets().find((x) => x.relPath === m[0]);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

async function rollbackOrAbort(ctx: ItemContext, txn: Txn): Promise<void> {
  try {
    await ctx.journal.rollback(txn.journal);
  } catch (e) {
    if (e instanceof RollbackConflict) throw new RunAbort(e.message);
    throw e;
  }
}

/** Journal, apply, then commit with `record` if `check` finds nothing; otherwise roll back. */
async function transact(
  ctx: ItemContext, item: CaptureItem, plan: PlanOp[], record: ItemRecord,
  check: (txn: Txn) => Promise<string[]>, stillThere: () => Promise<boolean>,
): Promise<{ ok: true } | { ok: false; reason: string; strike: boolean }> {
  const txn = await ctx.journal.begin({ run: ctx.run, item: item.name, itemSha: item.sha }, plan);
  try {
    await ctx.journal.apply(txn, ctx.onApplyStep);
  } catch (e) {
    await rollbackOrAbort(ctx, txn);
    return { ok: false, reason: `apply failed: ${e instanceof Error ? e.message : String(e)}`, strike: false };
  }
  await ctx.afterApply?.();
  if (!(await stillThere())) {
    await rollbackOrAbort(ctx, txn);
    return { ok: false, reason: "changed-during-run", strike: false };
  }
  const problems = await check(txn);
  if (problems.length > 0) {
    await rollbackOrAbort(ctx, txn);
    return { ok: false, reason: problems.join("; "), strike: true };
  }
  await ctx.journal.commit(() => ctx.ledger.append(record));
  return { ok: true };
}

function refreshAsks(ctx: ItemContext, removed: readonly string[], added?: OpenAsk): void {
  ctx.asks = ctx.asks.filter((a) => !removed.includes(a.rel) && a.rel !== added?.rel);
  if (added) ctx.asks.push(added);
}

/** Raise (or rewrite) the one ask for an item, in its own small transaction (DES-005). */
export async function holdItem(ctx: ItemContext, item: CaptureItem, details: AskDetails, extra: Partial<ItemRecord> = {}): Promise<ItemOutcome> {
  const { op, rel } = planAsk({ item: item.name, sha: item.sha, runDate: ctx.runDate, details, asks: ctx.asks, ledger: ctx.ledger, vault: ctx.vault });
  const record: ItemRecord = { ...base(ctx, item), outcome: "held", reason: details.reason, ask: rel, ...extra };
  const created = op.op === "create";
  if (created) ctx.vault.add(rel);
  const res = await transact(
    ctx, item, [op], record,
    (txn) => checkHold({ kind: "hold", root: ctx.root, itemRel: item.rel, itemName: item.name, itemSha: item.sha, askRel: rel, ops: txn.journal.ops, allowed: new Set([rel]) }),
    async () => (await currentSha(ctx.root, item)) === item.sha,
  );
  if (!res.ok) {
    if (created) ctx.vault.remove(rel);
    const failed: ItemRecord = { ...base(ctx, item), outcome: "failed", reason: res.reason, ...(res.strike ? { strike: true } : {}), ...extra };
    await ctx.ledger.append(failed);
    return { kind: "failed", record: failed };
  }
  refreshAsks(ctx, [], { rel, item: item.name, sha: item.sha, reason: details.reason, created: ctx.runDate });
  ctx.log(`held ${item.name}: ${details.reason} (${rel})`);
  return { kind: "held", record, ask: rel };
}

async function fail(ctx: ItemContext, item: CaptureItem, reason: string, strike: boolean, extra: Partial<ItemRecord> = {}): Promise<ItemOutcome> {
  const record: ItemRecord = { ...base(ctx, item), outcome: "failed", reason, ...(strike ? { strike: true } : {}), ...extra };
  await ctx.ledger.append(record);
  ctx.log(`failed ${item.name}: ${reason}`);
  if (strike && ctx.ledger.strikes(item.name) >= STRIKES_FOR_ASK) {
    const held = await holdItem(ctx, item, { reason: "check-failed", lastFailure: reason });
    if (held.kind === "held") return { kind: "failed", record, ask: held.ask };
  }
  return { kind: "failed", record };
}

interface AgentStep {
  output: Output;
  extra: Partial<ItemRecord>;
}

async function agentStep(ctx: ItemContext, item: CaptureItem, text: string, sources: SourcesResult["sources"], fixed: Target[]): Promise<AgentStep | { error: string; strike: boolean; extra: Partial<ItemRecord> }> {
  const scope = ctx.targets.readScope();
  const prompt = buildPrompt({ vaultRoot: scope.root, targets: ctx.targets.targets(), fixedTargets: fixed.map((t) => t.slug), itemName: item.name, itemText: text, sources });
  let res;
  try {
    res = await ctx.provider.run({
      systemPrompt: prompt.systemPrompt, userPrompt: prompt.userPrompt, outputSchema: OUTPUT_SCHEMA,
      readScope: scope, maxTurns: AGENT_MAX_TURNS, timeoutMs: AGENT_TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof AgentItemError) return { error: e.message, strike: true, extra: {} };
    throw e; // ProviderUnavailable and anything unexpected stop the run
  }
  const reads = res.toolCalls.filter((c) => c.allowed).length;
  const denied = res.toolCalls.length - reads;
  for (const c of res.toolCalls) ctx.log(`  ${c.allowed ? "read" : "DENIED"} ${c.tool} ${c.path}`);
  const extra: Partial<ItemRecord> = { reads, denied, usage: res.usage };
  const raw = res.output ?? parseRawOutput(res.rawText);
  const v = validateOutput(raw, {
    canary: prompt.canary, nonces: [prompt.canary, prompt.blockNonce],
    slugs: ctx.targets.targets().map((t) => t.slug), fixedTargets: fixed.map((t) => t.slug),
  });
  const inj = !!raw && typeof raw === "object" && (raw as Record<string, unknown>)["injection_suspected"] === true;
  extra.injectionSuspected = inj;
  if (!v.ok) return { error: `model output invalid: ${v.problems.join("; ")}`, strike: true, extra };
  return { output: v.output, extra };
}

async function ingest(ctx: ItemContext, item: CaptureItem, text: string, out: Output, urls: string[], extra: Partial<ItemRecord>): Promise<ItemOutcome> {
  const ext = path.extname(item.name).slice(1);
  const stem = itemStem(item.name);
  const added: string[] = [];
  const removed: string[] = [];
  const reg = (rel: string): void => { ctx.vault.add(rel); added.push(rel); };
  const unreg = (rel: string): void => { ctx.vault.remove(rel); removed.push(rel); };
  // Names: archive first, then the resource, each registered so they can't collide (REQ-022).
  const archiveName = ctx.vault.uniqueFileName(archiveBase(stem), ext, [item.rel]);
  const archivedRel = `${ARCHIVE_CAPTURE_DIR}/${archiveName}`;
  unreg(item.rel);
  reg(archivedRel);
  const slug = ctx.vault.uniqueStem(resourceSlugBase(out.title, stem));
  const resourceRel = `30-resources/${slug}.md`;
  reg(resourceRel);
  const archivedLinkTarget = ext.toLowerCase() === "md" ? archiveName.slice(0, -3) : archiveName;
  const chosen = out.targets.map((s) => ctx.targets.bySlug(s)).filter((t): t is Target => !!t);
  const plan: PlanOp[] = [{
    op: "create", path: resourceRel,
    content: renderResource({ slug, date: ctx.runDate, description: out.description, summary: out.summary, takeaways: out.takeaways, targets: chosen.map((t) => t.slug), archivedLinkTarget, urls }),
  }];
  for (const t of chosen) {
    const pre = await readFile(path.join(ctx.root, t.relPath), "utf8");
    const edit = addBacklink(pre, slug);
    if (edit.changed) plan.push({ op: "modify", path: t.relPath, content: edit.content });
  }
  const resolved = planResolvedAsks(item.name, ctx.asks, ctx.ledger, ctx.vault);
  plan.push(...resolved.ops);
  plan.push({ op: "move", src: item.rel, dst: archivedRel });
  const allowed = new Set([resourceRel, item.rel, archivedRel, ...chosen.map((t) => t.relPath), ...resolved.ops.flatMap((o) => (o.op === "move" ? [o.src, o.dst] : []))]);
  const askSrcs = resolved.ops.flatMap((o) => (o.op === "move" ? [o.src] : []));
  const record: ItemRecord = {
    ...base(ctx, item), outcome: "ingested", resource: resourceRel, targets: chosen.map((t) => t.relPath), archived: archivedRel,
    ...(resolved.dsts.length > 0 ? { asksArchived: resolved.dsts } : {}), ...extra,
  };
  const res = await transact(
    ctx, item, plan, record,
    (txn) => checkIngest({
      kind: "ingest", root: ctx.root, runDate: ctx.runDate, vault: ctx.vault, itemRel: item.rel, itemName: item.name, itemSha: item.sha,
      resourceRel, archivedRel, archivedLinkTarget, urls, targets: chosen, pre: txn.pre, resourceSlug: slug, ops: txn.journal.ops, allowed,
    }),
    async () => (await currentSha(ctx.root, { ...item, rel: archivedRel })) === item.sha,
  );
  if (!res.ok) {
    // Undo the in-memory index changes too.
    for (const r of added) ctx.vault.remove(r);
    for (const r of removed) ctx.vault.add(r);
    for (const o of resolved.ops) if (o.op === "move") { ctx.vault.remove(o.dst); ctx.vault.add(o.src); }
    return fail(ctx, item, res.reason, res.strike, extra);
  }
  refreshAsks(ctx, askSrcs);
  ctx.log(`ingested ${item.name} -> ${resourceRel} (${chosen.map((t) => t.slug).join(", ")})`);
  return { kind: "ingested", record, resource: resourceRel };
}

/** Process one selected item. Throws ProviderUnavailable or RunAbort to stop the run. */
export async function processItem(ctx: ItemContext, item: CaptureItem): Promise<ItemOutcome> {
  const c = item.classification;
  if (c.kind === "unsupported") return holdItem(ctx, item, { reason: "unsupported", detail: c.detail });
  if (c.kind === "empty") return holdItem(ctx, item, { reason: "empty" });
  const text = c.text;
  const urls = extractUrls(text);
  let sources: SourcesResult["sources"] = [];
  if (isThin(text)) {
    const fetched = await fetchSources(urls, ctx.env);
    if (fetched.failures.length > 0) {
      if (fetched.failures.every((f) => f.level === "connection")) return { kind: "network-deferred", item, failures: fetched.failures };
      return holdItem(ctx, item, { reason: "fetch-failed", failures: fetched.failures });
    }
    sources = fetched.sources;
  }
  const fixed = fixedTargets(text, ctx.vault, ctx.targets);
  const step = await agentStep(ctx, item, text, sources, fixed);
  if ("error" in step) return fail(ctx, item, step.error, step.strike, step.extra);
  if (step.output.decision === "no_fit") {
    return holdItem(ctx, item, { reason: "no-fit", closest: step.output.closest }, step.extra);
  }
  return ingest(ctx, item, text, step.output, urls, step.extra);
}

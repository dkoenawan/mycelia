// The ingester's pipeline (DES-002). Phase 5, per item: classify, fetch if
// thin, fixed targets, agent step, plan, journal and apply, re-hash, check,
// then commit or roll back. Only the agent step is model-driven.
import { execFile } from "node:child_process";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { appendDaily } from "../lib/daily.ts";
import { utcDate, utcStamp, utcTime } from "../lib/dates.ts";
import { AgentItemError, ProviderNotReady, ProviderUnavailable, type AgentProvider } from "./agent/provider.ts";
import { ARCHIVE_CAPTURE_DIR, INBOX_DIR, itemStem, itemLink, ownedAsks, planAsk, planResolvedAsks, renderAsk, scanAsks, type AskDetails, type OpenAsk } from "./asks.ts";
import { addBacklink } from "./backlinks.ts";
import { CAPTURE_DIR, currentSha, listCapture, select, type CaptureItem } from "./capture.ts";
import { checkHold, checkIngest } from "./check.ts";
import { extractUrls, fetchSources, isThin, type SourcesResult } from "./fetch.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { Journal, RollbackConflict, type PlanOp, type Txn } from "./journal.ts";
import { Ledger, type ItemRecord } from "./ledger.ts";
import { LockHeld, acquireLock } from "./lock.ts";
import { OUTPUT_SCHEMA, parseRawOutput, validateOutput, type Output } from "./output.ts";
import { buildPrompt } from "./prompt.ts";
import { archiveBase, renderResource, resourceSlugBase } from "./render.ts";
import { FlatTargetIndex, type Target } from "./targets.ts";
import { VaultIndex, parseWikilinks } from "./vault.ts";

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

// --- The run (DES-001, DES-002) -------------------------------------------

export const EXIT = { ok: 0, itemFailed: 1, cantStart: 2, locked: 3, abort: 4 } as const;
export const START_CUTOFF_MS = 40 * 60 * 1000;
export const STATE_DIR = ".state/ingest-inbox";
export const LEDGER_REL = `${STATE_DIR}/ledger.jsonl`;
const execFileP = promisify(execFile);

/** Paths that must be gitignored before the ingester writes anything (REQ-034). */
export const IGNORE_PROBES = [
  "00-inbox/capture/probe.md", "00-inbox/probe.md", "30-resources/probe.md", "40-archive/capture/probe.md",
  "20-areas/probe.md", "10-projects/probe.md", "daily/probe.md", LEDGER_REL,
];

export interface RunOptions {
  root: string;
  provider: AgentProvider;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  log?: (msg: string) => void;
  preflightOnly?: boolean;
  /** Install SIGINT/SIGTERM handlers that release the lock (the CLI does; tests don't). */
  signals?: boolean;
}

class CantStart extends Error {
  override name = "CantStart";
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function gitIgnoreProbes(root: string): Promise<void> {
  try {
    const { stdout } = await execFileP("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
    if (stdout.trim() !== "true") return;
  } catch {
    return; // not a git work tree (or no git): nothing can be tracked
  }
  const tracked: string[] = [];
  for (const probe of IGNORE_PROBES) {
    try {
      await execFileP("git", ["check-ignore", "-q", "--no-index", probe], { cwd: root });
    } catch {
      tracked.push(probe);
    }
  }
  if (tracked.length > 0) {
    throw new CantStart(`these paths aren't gitignored, so the ingester could write a tracked file: ${tracked.join(", ")}. Restore the framework's .gitignore. Nothing was changed.`);
  }
}

/** Preflight steps 1-4 (DES-001). Writes nothing. */
async function preflight(o: RunOptions): Promise<{ vault: VaultIndex; targets: FlatTargetIndex }> {
  for (const [rel, what] of [[CAPTURE_DIR, "the capture folder"], ["20-areas", "the areas folder"], ["10-projects", "the projects folder"], [INBOX_DIR, "the inbox"]] as const) {
    if (!(await isDir(path.join(o.root, rel)))) throw new CantStart(`${rel}/ is missing (${what}). Restore it from the framework (git checkout -- ${rel}), then retry. Nothing was changed.`);
  }
  await gitIgnoreProbes(o.root);
  const vault = VaultIndex.build(o.root);
  const targets = await FlatTargetIndex.load(o.root, vault);
  if (targets.targets().length === 0) {
    throw new CantStart("no area or project notes to place captures under — run `task bootstrap-areas` (or create one in 20-areas/ or 10-projects/). Nothing was changed.");
  }
  try {
    await o.provider.preflight();
  } catch (e) {
    if (e instanceof ProviderNotReady) throw new CantStart(e.message);
    throw e;
  }
  return { vault, targets };
}

function summaryBlock(time: string, outcomes: ItemOutcome[]): string {
  const done = outcomes.filter((x): x is Exclude<ItemOutcome, { kind: "network-deferred" }> => x.kind !== "network-deferred");
  const n = (k: string): number => done.filter((x) => x.kind === k).length;
  const lines = [`## Inbox ingestion (${time} UTC)`, "", `- ${String(n("ingested"))} ingested, ${String(n("held"))} held, ${String(n("failed"))} failed`];
  const resources = done.flatMap((x) => (x.kind === "ingested" ? [`[[${path.posix.basename(x.resource, ".md")}]]`] : []));
  const asks = done.flatMap((x) => (x.kind === "held" ? [x.ask] : x.kind === "failed" && x.ask ? [x.ask] : [])).map((a) => `[[${path.posix.basename(a, ".md")}]]`);
  if (resources.length > 0) lines.push(`- Resources: ${resources.join(", ")}`);
  if (asks.length > 0) lines.push(`- Asks: ${asks.join(", ")}`);
  if (n("failed") > 0) lines.push(`- Failures: see the ledger, \`${LEDGER_REL}\``);
  for (const x of done) {
    const denied = x.record.denied ?? 0;
    if (denied === 0 && !x.record.injectionSuspected) continue;
    const link = x.kind === "ingested" ? `[[${path.posix.basename(x.resource, ".md")}]]` : itemLink(x.record.item);
    const why = [denied > 0 ? `blocked tool calls: ${String(denied)}` : "", x.record.injectionSuspected ? "possible injection" : ""].filter(Boolean).join("; ");
    lines.push(`- Needs a look: ${link} (${why})`);
  }
  return `${lines.join("\n")}\n`;
}

/** Raise one check-failed ask for an item whose recovery hit operator edits (DES-015). */
async function conflictAsk(o: RunOptions, ledger: Ledger, vault: VaultIndex, run: string, runDate: string, item: string, sha: string, files: string[]): Promise<void> {
  const asks = await scanAsks(o.root);
  if (ownedAsks(item, asks, ledger).length > 0 || asks.some((a) => a.item === item)) return;
  const stem = vault.uniqueStem(`${runDate}-ingest-${itemStem(item)}`);
  const rel = `${INBOX_DIR}/${stem}.md`;
  const content = renderAsk({ stem, created: runDate, updated: runDate, item, sha, details: { reason: "check-failed", interrupted: true, lastFailure: `these files changed after the interrupted run: ${files.join(", ")}` } });
  const fh = await open(path.join(o.root, rel), "wx");
  try {
    await fh.writeFile(content);
  } finally {
    await fh.close();
  }
  await ledger.append({ event: "item", run, item, sha256: sha, outcome: "held", reason: "check-failed", ask: rel });
}

/** One run of the ingester. Returns the exit code. */
export async function runIngest(o: RunOptions): Promise<number> {
  const now = o.now ?? (() => new Date());
  const log = o.log ?? (() => undefined);
  const env = o.env ?? process.env;
  const started = now();
  const run = utcStamp(started);
  const runDate = utcDate(started);

  let pre: { vault: VaultIndex; targets: FlatTargetIndex };
  try {
    pre = await preflight(o);
  } catch (e) {
    if (e instanceof CantStart) {
      log(`ERROR: ${e.message}`);
      return EXIT.cantStart;
    }
    throw e;
  }
  const preflightMs = now().getTime() - started.getTime();
  for (const w of pre.targets.warnings) log(`WARN: ${w}`);
  if (o.preflightOnly) {
    log(`preflight ok: ${String(pre.targets.targets().length)} areas and projects, provider ${o.provider.name} ready`);
    return EXIT.ok;
  }

  const stateDir = path.join(o.root, STATE_DIR);
  let lock;
  try {
    lock = await acquireLock(stateDir, started, log);
  } catch (e) {
    if (e instanceof LockHeld) {
      log(`ERROR: ${e.message}. Nothing was changed.`);
      return EXIT.locked;
    }
    throw e;
  }
  const onSignal = (sig: NodeJS.Signals): void => {
    lock.release();
    process.exit(sig === "SIGINT" ? 130 : 143);
  };
  if (o.signals) {
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }
  const ledger = new Ledger(path.join(o.root, LEDGER_REL));
  const journal = new Journal(o.root, stateDir);
  const outcomes: ItemOutcome[] = [];
  let exit: number = EXIT.ok;
  let skippedHeld = 0;
  try {
    await ledger.append({ event: "run-start", run, provider: o.provider.name });
    // Recover (REQ-027).
    try {
      const recovered = await journal.recover((j) => ledger.itemRecords(j.item).some((r) => r.run === j.run && r.sha256 === j.itemSha));
      if (recovered) {
        await ledger.append({ event: "item", run, item: recovered.item, sha256: recovered.itemSha, outcome: "recovered", reason: `rolled back an interrupted run (${recovered.run})` });
        log(`recovered ${recovered.item}: rolled back the interrupted run ${recovered.run}`);
      }
    } catch (e) {
      if (!(e instanceof RollbackConflict)) throw e;
      const j = journal.read();
      log(`ERROR: recovery stopped: ${e.message}`);
      if (j) await conflictAsk(o, ledger, pre.vault, run, runDate, j.item, j.itemSha, e.files);
      exit = EXIT.abort;
      return exit;
    }
    // Select (DES-004).
    const asks = await scanAsks(o.root);
    const sel = select(await listCapture(o.root), asks);
    skippedHeld = sel.skippedHeld;
    if (sel.deferred > 0) log(`${String(sel.deferred)} eligible item(s) left for later runs (10 per run)`);
    const ctx: ItemContext = { root: o.root, run, runDate, vault: pre.vault, targets: pre.targets, asks, ledger, journal, provider: o.provider, env, log };
    let thin = 0;
    for (const item of sel.selected) {
      if (now().getTime() - started.getTime() >= START_CUTOFF_MS) {
        log("40 minutes have passed; leaving the remaining items for the next run");
        break;
      }
      if (item.classification.kind === "supported" && isThin(item.classification.text)) thin++;
      try {
        outcomes.push(await processItem(ctx, item));
      } catch (e) {
        if (e instanceof ProviderUnavailable || e instanceof RunAbort) {
          log(`ERROR: stopping the run (${e.name}): ${e.message}. No strike recorded; remaining items stay eligible.`);
          exit = EXIT.abort;
          break;
        }
        throw e;
      }
    }
    // Deferred network holds (D12).
    const deferred = outcomes.filter((x): x is Extract<ItemOutcome, { kind: "network-deferred" }> => x.kind === "network-deferred");
    if (exit !== EXIT.abort && deferred.length > 0) {
      if (deferred.length >= 2 && deferred.length === thin) {
        log(`ERROR: every thin item (${String(thin)}) failed to connect; treating it as a network outage. No asks raised; the items stay eligible.`);
        exit = EXIT.abort;
      } else {
        for (const d of deferred) outcomes.push(await holdItem(ctx, d.item, { reason: "fetch-failed", failures: d.failures }));
      }
    }
    const failed = outcomes.some((x) => x.kind === "failed" && x.record.reason !== "changed-during-run");
    if (exit === EXIT.ok && failed) exit = EXIT.itemFailed;
    // Daily summary (DES-018): only when at least one item was processed (REQ-029, REQ-030).
    if (outcomes.some((x) => x.kind !== "network-deferred")) await appendDaily(o.root, runDate, summaryBlock(utcTime(started), outcomes), { block: true });
    return exit;
  } finally {
    const counts: Record<string, number> = {};
    for (const x of outcomes) counts[x.kind] = (counts[x.kind] ?? 0) + 1;
    try {
      await ledger.append({ event: "run-end", run, counts, skippedHeld, targetsExcluded: pre.targets.excluded, preflightMs, exit });
    } finally {
      if (o.signals) {
        process.removeListener("SIGINT", onSignal);
        process.removeListener("SIGTERM", onSignal);
      }
      lock.release();
    }
  }
}

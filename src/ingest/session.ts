// Ingest session seam (#21 DES-001, D1): open / processOne / close around the
// unchanged per-item pipeline in run.ts. `runIngest` drives it over the
// capture folder; the Notion connector drives it one pulled item at a time,
// under the same lock.
//
// run.ts and this module import each other. That's safe because neither
// touches the other's bindings at module top level, only inside functions.
import { execFile } from "node:child_process";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { appendDaily } from "../lib/daily.ts";
import { utcDate, utcStamp, utcTime } from "../lib/dates.ts";
import { ProviderNotReady, type AgentProvider } from "./agent/provider.ts";
import { INBOX_DIR, itemLink, itemStem, ownedAsks, renderAsk, scanAsks } from "./asks.ts";
import { CAPTURE_DIR, isHeld, listCapture, type CaptureItem } from "./capture.ts";
import { isThin } from "./fetch.ts";
import { Journal, RollbackConflict } from "./journal.ts";
import { Ledger } from "./ledger.ts";
import { acquireLock, type Lock } from "./lock.ts";
import { EXIT, IGNORE_PROBES, LEDGER_REL, RunAbort, STATE_DIR, holdItem, processItem, type ItemContext, type ItemOutcome } from "./run.ts";
import { FlatTargetIndex } from "./targets.ts";
import { VaultIndex } from "./vault.ts";

const execFileP = promisify(execFile);

/** The ingester can't start: exit 2, nothing changed (REQ-032, REQ-034). */
export class CantStart extends Error {
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

export interface Preflight {
  vault: VaultIndex;
  targets: FlatTargetIndex;
}

/** Preflight steps 1-4 (DES-001). Writes nothing. Throws CantStart. */
export async function ingestPreflight(root: string, provider: AgentProvider): Promise<Preflight> {
  for (const [rel, what] of [[CAPTURE_DIR, "the capture folder"], ["20-areas", "the areas folder"], ["10-projects", "the projects folder"], [INBOX_DIR, "the inbox"]] as const) {
    if (!(await isDir(path.join(root, rel)))) throw new CantStart(`${rel}/ is missing (${what}). Restore it from the framework (git checkout -- ${rel}), then retry. Nothing was changed.`);
  }
  await gitIgnoreProbes(root);
  const vault = VaultIndex.build(root);
  const targets = await FlatTargetIndex.load(root, vault);
  if (targets.targets().length === 0) {
    throw new CantStart("no area or project notes to place captures under — run `task bootstrap-areas` (or create one in 20-areas/ or 10-projects/). Nothing was changed.");
  }
  try {
    await provider.preflight();
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
async function conflictAsk(root: string, ledger: Ledger, vault: VaultIndex, run: string, runDate: string, item: string, sha: string, files: string[]): Promise<void> {
  const asks = await scanAsks(root);
  if (ownedAsks(item, asks, ledger).length > 0 || asks.some((a) => a.item === item)) return;
  const stem = vault.uniqueStem(`${runDate}-ingest-${itemStem(item)}`);
  const rel = `${INBOX_DIR}/${stem}.md`;
  const content = renderAsk({ stem, created: runDate, updated: runDate, item, sha, details: { reason: "check-failed", interrupted: true, lastFailure: `these files changed after the interrupted run: ${files.join(", ")}` } });
  const fh = await open(path.join(root, rel), "wx");
  try {
    await fh.writeFile(content);
  } finally {
    await fh.close();
  }
  await ledger.append({ event: "item", run, item, sha256: sha, outcome: "held", reason: "check-failed", ask: rel });
}

export interface SessionOptions {
  root: string;
  provider: AgentProvider;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  log?: (msg: string) => void;
  /** A lock the caller already holds. The session uses it and never releases it. */
  lock?: Lock;
  /** A preflight the caller already ran (runIngest runs it before taking the lock). */
  preflight?: Preflight;
  /** Install SIGINT/SIGTERM handlers that release a lock the session took itself. */
  signals?: boolean;
}

export type ProcessResult = ItemOutcome | { kind: "not-found"; item: string } | { kind: "already-held"; item: string };

export interface CloseResult {
  /** Outcomes decided at close: deferred network holds (D12). */
  late: ItemOutcome[];
  exit: number;
}

/** One open ingest session. Create it with openIngestSession. */
export class IngestSession {
  readonly started: Date;
  readonly outcomes: ItemOutcome[] = [];
  /** Held items runIngest skipped at selection; recorded in run-end. */
  skippedHeld = 0;
  private exit: number = EXIT.ok;
  private thin = 0;
  private closed = false;

  private readonly ctx: ItemContext;
  private readonly lock: Lock;
  private readonly ownsLock: boolean;
  private readonly preflightMs: number;
  private readonly excluded: number;
  private readonly root: string;
  private readonly onSignal: ((sig: NodeJS.Signals) => void) | null;

  constructor(o: { ctx: ItemContext; lock: Lock; ownsLock: boolean; preflightMs: number; excluded: number; onSignal: ((sig: NodeJS.Signals) => void) | null; started: Date }) {
    this.ctx = o.ctx;
    this.lock = o.lock;
    this.ownsLock = o.ownsLock;
    this.preflightMs = o.preflightMs;
    this.excluded = o.excluded;
    this.root = o.ctx.root;
    this.onSignal = o.onSignal;
    this.started = o.started;
  }

  /** Open asks as of the session start, for selection. */
  get asks(): ItemContext["asks"] {
    return this.ctx.asks;
  }

  /** Run the unchanged pipeline on one item. Throws ProviderUnavailable or RunAbort to stop the run. */
  async process(item: CaptureItem): Promise<ItemOutcome> {
    if (item.classification.kind === "supported" && isThin(item.classification.text)) this.thin++;
    const out = await processItem(this.ctx, item);
    this.outcomes.push(out);
    return out;
  }

  /** Process exactly the named capture item; no other item is touched. */
  async processOne(name: string): Promise<ProcessResult> {
    const item = (await listCapture(this.root)).find((i) => i.name === name);
    if (!item) return { kind: "not-found", item: name };
    if (isHeld(item, this.ctx.asks)) return { kind: "already-held", item: name };
    this.ctx.vault.add(item.rel); // written after the session's index was built
    return this.process(item);
  }

  /** Record that the run was stopped (ProviderUnavailable, RunAbort): exit 4, deferred items stay eligible. */
  markAborted(): void {
    this.exit = EXIT.abort;
  }

  /** Resolve deferred network holds, write the daily block and run-end, release a lock the session took. */
  async close(): Promise<CloseResult> {
    const late: ItemOutcome[] = [];
    try {
      const deferred = this.outcomes.filter((x): x is Extract<ItemOutcome, { kind: "network-deferred" }> => x.kind === "network-deferred");
      if (this.exit !== EXIT.abort && deferred.length > 0) {
        if (deferred.length >= 2 && deferred.length === this.thin) {
          this.ctx.log(`ERROR: every thin item (${String(this.thin)}) failed to connect; treating it as a network outage. No asks raised; the items stay eligible.`);
          this.exit = EXIT.abort;
        } else {
          for (const d of deferred) {
            const out = await holdItem(this.ctx, d.item, { reason: "fetch-failed", failures: d.failures });
            this.outcomes.push(out);
            late.push(out);
          }
        }
      }
      const failed = this.outcomes.some((x) => x.kind === "failed" && x.record.reason !== "changed-during-run");
      if (this.exit === EXIT.ok && failed) this.exit = EXIT.itemFailed;
      // Daily summary (DES-018): only when at least one item was processed (REQ-029, REQ-030).
      if (this.outcomes.some((x) => x.kind !== "network-deferred")) await appendDaily(this.root, this.ctx.runDate, summaryBlock(utcTime(this.started), this.outcomes), { block: true });
      return { late, exit: this.exit };
    } finally {
      await this.dispose();
    }
  }

  /** Write run-end and release a lock the session took. Idempotent; close() calls it. */
  async dispose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const counts: Record<string, number> = {};
    for (const x of this.outcomes) counts[x.kind] = (counts[x.kind] ?? 0) + 1;
    try {
      await this.ctx.ledger.append({ event: "run-end", run: this.ctx.run, counts, skippedHeld: this.skippedHeld, targetsExcluded: this.excluded, preflightMs: this.preflightMs, exit: this.exit });
    } finally {
      if (this.onSignal) {
        process.removeListener("SIGINT", this.onSignal);
        process.removeListener("SIGTERM", this.onSignal);
      }
      if (this.ownsLock) this.lock.release();
    }
  }
}

/**
 * Open a session: preflight (unless given), lock (unless given), run-start,
 * recovery. Throws CantStart, LockHeld, or RunAbort when recovery hit operator
 * edits (after raising its ask and writing run-end).
 */
export async function openIngestSession(o: SessionOptions): Promise<IngestSession> {
  const now = o.now ?? (() => new Date());
  const log = o.log ?? (() => undefined);
  const env = o.env ?? process.env;
  const started = now();
  const run = utcStamp(started);
  const runDate = utcDate(started);
  const pre = o.preflight ?? (await ingestPreflight(o.root, o.provider));
  const preflightMs = now().getTime() - started.getTime();
  if (!o.preflight) for (const w of pre.targets.warnings) log(`WARN: ${w}`);
  const stateDir = path.join(o.root, STATE_DIR);
  const ownsLock = !o.lock;
  const lock = o.lock ?? (await acquireLock(stateDir, started, log));
  let onSignal: ((sig: NodeJS.Signals) => void) | null = null;
  if (o.signals && ownsLock) {
    onSignal = (sig) => {
      lock.release();
      process.exit(sig === "SIGINT" ? 130 : 143);
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }
  const ledger = new Ledger(path.join(o.root, LEDGER_REL));
  const journal = new Journal(o.root, stateDir);
  const ctx: ItemContext = { root: o.root, run, runDate, vault: pre.vault, targets: pre.targets, asks: [], ledger, journal, provider: o.provider, env, log };
  const session = new IngestSession({ ctx, lock, ownsLock, preflightMs, excluded: pre.targets.excluded, onSignal, started });
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
      if (j) await conflictAsk(o.root, ledger, pre.vault, run, runDate, j.item, j.itemSha, e.files);
      session.markAborted();
      await session.dispose();
      throw new RunAbort(`recovery stopped: ${e.message}`);
    }
    ctx.asks = await scanAsks(o.root);
    return session;
  } catch (e) {
    await session.dispose();
    throw e;
  }
}

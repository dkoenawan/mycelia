// Pull use case (DES-009): the design's Pull run flow. Can-start checks, the
// shared lock, recovery, query, status catch-up, selection, then per item:
// pull (read, convert, write the capture item), ingest through the ingester's
// session, set Status and Reason, record. All I/O goes through ports; never
// runs git; writes only capture items, its asks, its ledger and the daily note.
import type { ItemEvent, SourceRow } from "../domain/capture.ts";
import { captureName, hintSlug, renderCaptureItem } from "../domain/capture-item.ts";
import { utcDate, utcStamp, utcTime } from "../domain/dates.ts";
import { selectWork } from "../domain/eligibility.ts";
import { nextStatus, stopsNow } from "../domain/lifecycle.ts";
import { renderStoppedAsk, stoppedAskBase } from "../domain/stopped-ask.ts";
import { renderSummary } from "../domain/summary.ts";
import { canStart, type PreflightDeps } from "./preflight.ts";
import {
  IngestAborted, RunLocked, SourceAuthRejected, SourceItemError, SourceUnavailable,
  type Clock, type IngestResult, type IngestRun, type PullLedger, type RunLock, type SourceInbox,
} from "./ports.ts";

export const EXIT = { ok: 0, itemFailed: 1, cantStart: 2, locked: 3, abort: 4 } as const;
/** No new item starts after this long, as for the ingester. */
export const START_CUTOFF_MS = 40 * 60 * 1000;

export interface PullDeps extends PreflightDeps {
  ledger: PullLedger;
  clock: Clock;
}

/** Stops the run: the source or the ingester is unavailable. Nothing is recorded against remaining items. */
class Abort extends Error {
  override name = "Abort";
}

function why(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

class PullRun {
  private readonly d: PullDeps;
  private readonly inbox: SourceInbox;
  private readonly lock: RunLock;
  private readonly started: Date;
  private readonly run: string;
  private readonly runDate: string;
  private session: IngestRun | null = null;
  private ingestMs = 0;
  readonly counts: Record<string, number> = {};
  readonly resources: string[] = [];
  readonly asks: string[] = [];
  private readonly titles = new Map<string, string>();
  /** Deferred ingests, resolved when the session closes. */
  private readonly deferred = new Map<string, string>();

  constructor(d: PullDeps, inbox: SourceInbox, lock: RunLock) {
    this.d = d;
    this.inbox = inbox;
    this.lock = lock;
    this.started = d.clock.now();
    this.run = utcStamp(this.started);
    this.runDate = utcDate(this.started);
  }

  private count(k: string): void {
    this.counts[k] = (this.counts[k] ?? 0) + 1;
  }

  get processed(): number {
    return ["ingested", "held", "failed", "stopped"].reduce((n, k) => n + (this.counts[k] ?? 0), 0);
  }

  get pullMs(): number {
    return Math.max(0, this.d.clock.now().getTime() - this.started.getTime() - this.ingestMs);
  }

  private overCutoff(): boolean {
    return this.d.clock.now().getTime() - this.started.getTime() >= START_CUTOFF_MS;
  }

  /** Run a source call; outages and a rejected key stop the run. */
  private async source<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      if (e instanceof SourceUnavailable || e instanceof SourceAuthRejected) throw new Abort(why(e));
      throw e;
    }
  }

  /** Time spent in the ingester doesn't count toward the pull time (REQ-043). */
  private async ingesting<T>(f: () => Promise<T>): Promise<T> {
    const t0 = this.d.clock.now().getTime();
    try {
      return await f();
    } catch (e) {
      if (e instanceof IngestAborted) throw new Abort(why(e));
      throw e;
    } finally {
      this.ingestMs += this.d.clock.now().getTime() - t0;
    }
  }

  private async record(e: Omit<ItemEvent, "run">, title: string): Promise<void> {
    await this.d.ledger.item({ ...e, run: this.run });
    if (e.outcome !== "resumed") this.count(e.outcome);
    const s = nextStatus(e);
    if (s) await this.source(() => this.inbox.setStatus(e.id, s.status, s.reason));
    this.d.log(`${e.outcome} ${title || e.id}${e.reason ? `: ${e.reason}` : ""}`);
  }

  /** Step 3: an intent with no pulled record. */
  async recover(): Promise<void> {
    for (const i of this.d.ledger.openIntents()) {
      if ((await this.d.vault.captureExists(i.capture)) || this.d.ingester.wasIngested(i.capture)) {
        await this.d.ledger.pulled(i.id, i.capture, "recovered");
        this.d.log(`recovered ${i.capture}: it was written before an interrupted run recorded it`);
      }
      // Otherwise nothing was written: the row is re-pulled under the same name.
    }
  }

  /** Step 5: pulled rows whose status lags the vault outcome (REQ-013, REQ-020). */
  async catchUp(rows: readonly SourceRow[]): Promise<void> {
    for (const row of rows) {
      const capture = this.d.ledger.captureOf(row.id);
      if (!capture || !this.d.ledger.isPulled(row.id) || !this.d.ingester.wasIngested(capture)) continue;
      await this.record({ id: row.id, capture, outcome: "synced" }, row.title);
    }
  }

  private async pullFailure(row: SourceRow, reason: string): Promise<void> {
    if (!stopsNow(this.d.ledger.events(row.id))) {
      await this.record({ id: row.id, capture: null, outcome: "failed", reason, strike: true }, row.title);
      return;
    }
    await this.d.ledger.item({ id: row.id, run: this.run, capture: null, outcome: "failed", reason, strike: true });
    const stem = await this.d.vault.uniqueAskStem(stoppedAskBase(this.runDate, row.title));
    const ask = await this.d.vault.writeAsk(stem, renderStoppedAsk({ stem, date: this.runDate, row, reason }));
    this.asks.push(ask);
    await this.record({ id: row.id, capture: null, outcome: "stopped", reason, ask }, row.title);
  }

  /** Step 7: read, convert, write the capture item. Returns its name, or null after a pull failure. */
  async pull(row: SourceRow): Promise<string | null> {
    let content: string;
    try {
      const capture = await this.source(() => this.inbox.read(row));
      const slug = hintSlug(capture.hint);
      content = renderCaptureItem(row, capture, !!slug && (await this.d.vault.hintTargetExists(slug)));
    } catch (e) {
      if (e instanceof SourceItemError) {
        await this.pullFailure(row, why(e));
        return null;
      }
      throw e;
    }
    const name = captureName(row);
    await this.d.ledger.intent(row.id, name);
    let sha: string;
    try {
      sha = await this.d.vault.writeCapture(name, content);
    } catch (e) {
      const exists = (e as { code?: string }).code === "EEXIST";
      await this.pullFailure(row, exists ? `a capture item named ${name} already exists` : `couldn't write the capture item: ${why(e)}`);
      return null;
    }
    await this.d.ledger.pulled(row.id, name, sha);
    return name;
  }

  /** Step 8 and 9: ingest one pulled capture through the session, then set its status. */
  async ingest(id: string, capture: string, title: string): Promise<void> {
    const result = await this.ingesting(async () => {
      this.session ??= await this.d.ingester.open(this.lock);
      return this.session.processOne(capture);
    });
    if (result.kind === "deferred") {
      this.deferred.set(capture, id);
      return;
    }
    await this.settle(id, capture, title, result);
  }

  private async settle(id: string, capture: string, title: string, r: IngestResult): Promise<void> {
    switch (r.kind) {
      case "ingested":
        this.resources.push(r.resource);
        return this.record({ id, capture, outcome: "ingested" }, title);
      case "held":
        this.asks.push(r.ask);
        return this.record({ id, capture, outcome: "held", reason: r.reason, ask: r.ask }, title);
      case "failed":
        if (r.ask) {
          // The ingester's third check failure holds the item with its own ask.
          this.asks.push(r.ask);
          return this.record({ id, capture, outcome: "held", reason: "check-failed", ask: r.ask }, title);
        }
        return this.record({ id, capture, outcome: "failed", reason: r.reason }, title);
      case "already-held":
        return this.record({ id, capture, outcome: "held", reason: "an ask in 00-inbox/ already holds it" }, title);
      case "not-found":
        return this.record({ id, capture, outcome: "held", reason: `the capture item ${capture} is no longer in the capture folder` }, title);
      case "deferred":
        return;
    }
  }

  /** Step 10: close the session and settle its late outcomes. */
  async close(): Promise<void> {
    if (!this.session) return;
    const session = this.session;
    this.session = null;
    const late = await this.ingesting(() => session.close());
    for (const { capture, result } of late) {
      const id = this.deferred.get(capture);
      if (id) await this.settle(id, capture, this.titles.get(id) ?? "", result);
    }
  }

  async summary(exit: number): Promise<void> {
    if (this.processed > 0) {
      await this.d.vault.appendDaily(this.runDate, renderSummary({ time: utcTime(this.started), counts: this.counts, resources: this.resources, asks: this.asks }));
    }
    await this.d.ledger.runEnd({ counts: this.counts, pullMs: this.pullMs, exit });
  }

  async process(): Promise<number> {
    this.d.ledger.startRun(this.run);
    await this.recover();
    const rows = await this.source(() => this.inbox.rowsNotIngested());
    await this.catchUp(rows);
    const cfg = await this.d.config.read();
    const sel = selectWork({
      rows, instructionsId: cfg?.instructions_page_id ?? null,
      isPulled: (id) => this.d.ledger.isPulled(id), events: (id) => this.d.ledger.events(id), pending: this.d.ledger.pending(),
    });
    if (sel.deferred > 0) this.d.log(`${String(sel.deferred)} eligible row(s) left for later runs (10 per run)`);
    for (const r of rows) this.titles.set(r.id, r.title);
    const titles = this.titles;
    for (const id of sel.resumed) await this.record({ id, capture: null, outcome: "resumed" }, titles.get(id) ?? "");
    for (const p of sel.pending) {
      if (this.overCutoff()) break;
      await this.ingest(p.id, p.capture, titles.get(p.id) ?? "");
    }
    for (const row of sel.rows) {
      if (this.overCutoff()) {
        this.d.log("40 minutes have passed; leaving the remaining rows for the next run");
        break;
      }
      const name = await this.pull(row);
      if (name) await this.ingest(row.id, name, row.title);
    }
    await this.close();
    return (this.counts["failed"] ?? 0) + (this.counts["stopped"] ?? 0) > 0 ? EXIT.itemFailed : EXIT.ok;
  }
}

/** One pull run. Returns the exit code (0-4, as for the ingester). */
export async function pullInbox(deps: PullDeps): Promise<number> {
  const ready = await canStart(deps);
  if (!ready.ok) {
    deps.log(`ERROR: ${ready.message}`);
    return EXIT.cantStart;
  }
  let lock: RunLock;
  try {
    lock = await deps.ingester.lock();
  } catch (e) {
    if (e instanceof RunLocked) {
      deps.log(`ERROR: ${why(e)}: another pull run or task ingest-inbox is in progress. Nothing was changed.`);
      return EXIT.locked;
    }
    throw e;
  }
  const run = new PullRun(deps, ready.inbox, lock);
  let exit: number;
  try {
    try {
      exit = await run.process();
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
      deps.log(`ERROR: stopping the run: ${e.message}. Completed items are kept; nothing was recorded against the rest.`);
      exit = EXIT.abort;
      try {
        await run.close();
      } catch (c) {
        if (!(c instanceof Abort)) throw c;
      }
    }
    await run.summary(exit);
    return exit;
  } finally {
    lock.release();
  }
}

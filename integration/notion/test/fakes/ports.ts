// In-memory fakes of the application ports (D8 test layout).
import { createHash } from "node:crypto";
import { JsonlPullLedger } from "../../src/adapters/ledger/jsonl-ledger.ts";
import type { Capture, SourceRow, Status } from "../../src/domain/capture.ts";
import {
  ConfigUnsafe, IngestAborted, IngestNotReady, RunLocked, SourceItemError, SourceUnavailable,
  type Clock, type ConfigStore, type ConnectorConfig, type IngestResult, type IngestRun, type Ingester, type KeyPrompt,
  type RunLock, type SourceInbox, type VaultWriter,
} from "../../src/application/ports.ts";

export class MemoryConfig implements ConfigStore {
  readonly path = "control/notion.local.yaml";
  value: ConnectorConfig | null = null;
  safe = true;
  writes = 0;

  guard(): Promise<void> {
    return this.safe ? Promise.resolve() : Promise.reject(new ConfigUnsafe(`${this.path} isn't gitignored. Nothing was written.`));
  }

  read(): Promise<ConnectorConfig | null> {
    return Promise.resolve(this.value ? { ...this.value } : null);
  }

  async write(config: ConnectorConfig): Promise<void> {
    await this.guard();
    this.writes++;
    this.value = { ...config };
  }
}

export class StaticPrompt implements KeyPrompt {
  calls = 0;
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  read(): Promise<string> {
    this.calls++;
    return Promise.resolve(this.key);
  }
}

export function logSink(): { log: (m: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (m) => { lines.push(m); }, lines };
}

// --- Pull-run fakes -----------------------------------------------------------


/** The connector's ledger logic, kept in memory. */
export class MemoryPullLedger extends JsonlPullLedger {
  constructor() {
    super("/nonexistent/notion-pull/ledger.jsonl");
  }

  protected override persist(): Promise<void> {
    return Promise.resolve();
  }
}

export interface MemRow extends SourceRow {
  reason: string;
  capture: Capture;
}

export class MemorySourceInbox implements SourceInbox {
  readonly rows: MemRow[] = [];
  readonly statusWrites: { id: string; status: Status; reason: string }[] = [];
  /** Row IDs whose read fails as a pull failure. */
  readonly failingReads = new Set<string>();
  /** Calls left before the source becomes unreachable (Infinity: never). */
  callsBeforeOutage = Infinity;
  checkError: Error | null = null;
  private minute = 0;

  add(title: string, extra: Partial<MemRow> = {}): MemRow {
    this.minute++;
    const row: MemRow = {
      id: `row-${String(this.rows.length + 1).padStart(2, "0")}`, title, status: "New", reason: "",
      createdTime: `2026-10-11T08:${String(this.minute).padStart(2, "0")}:00.000Z`,
      capture: { title, body: `${title} body text about designing agentic workflows.`, url: null, hint: null, omitted: {} },
      ...extra,
    };
    this.rows.push(row);
    return row;
  }

  private tick(): void {
    if (this.callsBeforeOutage <= 0) throw new SourceUnavailable("can't reach Notion (ECONNRESET)");
    this.callsBeforeOutage--;
  }

  check(): Promise<void> {
    return this.checkError ? Promise.reject(this.checkError) : Promise.resolve();
  }

  rowsNotIngested(): Promise<SourceRow[]> {
    this.tick();
    return Promise.resolve(this.rows.filter((r) => r.status !== "Ingested").map(({ id, title, status, createdTime }) => ({ id, title, status, createdTime })));
  }

  read(row: SourceRow): Promise<Capture> {
    this.tick();
    if (this.failingReads.has(row.id)) return Promise.reject(new SourceItemError("couldn't read the row: bad block (validation_error)"));
    const r = this.rows.find((x) => x.id === row.id);
    return r ? Promise.resolve(r.capture) : Promise.reject(new SourceItemError("no such row"));
  }

  setStatus(id: string, status: Status, reason: string): Promise<void> {
    this.tick();
    const r = this.rows.find((x) => x.id === id);
    if (r) {
      r.status = status;
      r.reason = reason;
    }
    this.statusWrites.push({ id, status, reason });
    return Promise.resolve();
  }
}

export class MemoryVault implements VaultWriter {
  readonly captures = new Map<string, string>();
  readonly asks = new Map<string, string>();
  readonly daily: { date: string; block: string }[] = [];
  readonly targets = new Set<string>();
  unignored: string[] = [];
  /** Names whose write fails (simulated disk error). */
  readonly failingWrites = new Set<string>();

  unignoredPaths(): Promise<string[]> {
    return Promise.resolve(this.unignored);
  }

  captureExists(name: string): Promise<boolean> {
    return Promise.resolve(this.captures.has(name));
  }

  writeCapture(name: string, content: string): Promise<string> {
    if (this.failingWrites.has(name)) return Promise.reject(new Error("EIO: i/o error"));
    if (this.captures.has(name)) return Promise.reject(Object.assign(new Error("EEXIST"), { code: "EEXIST" }));
    this.captures.set(name, content);
    return Promise.resolve(createHash("sha256").update(content).digest("hex"));
  }

  hintTargetExists(slug: string): Promise<boolean> {
    return Promise.resolve(this.targets.has(slug));
  }

  uniqueAskStem(base: string): Promise<string> {
    let stem = base;
    for (let i = 2; this.asks.has(`00-inbox/${stem}.md`); i++) stem = `${base}-${String(i)}`;
    return Promise.resolve(stem);
  }

  writeAsk(stem: string, content: string): Promise<string> {
    const rel = `00-inbox/${stem}.md`;
    this.asks.set(rel, content);
    return Promise.resolve(rel);
  }

  appendDaily(date: string, block: string): Promise<void> {
    this.daily.push({ date, block });
    return Promise.resolve();
  }
}

export type Decide = (capture: string, content: string) => IngestResult;

/** The ingester behind the port: decides each capture's outcome with `decide`. */
export class FakeIngester implements Ingester {
  readonly processed: string[] = [];
  readonly ingested = new Set<string>();
  locked = false;
  notReady: string | null = null;
  opens = 0;
  closes = 0;
  /** Capture names whose processOne aborts the run. */
  readonly aborting = new Set<string>();
  private readonly vault: MemoryVault;
  private readonly decide: Decide;

  constructor(vault: MemoryVault, decide: Decide) {
    this.vault = vault;
    this.decide = decide;
  }

  preflight(): Promise<void> {
    return this.notReady ? Promise.reject(new IngestNotReady(this.notReady)) : Promise.resolve();
  }

  lock(): Promise<RunLock> {
    if (this.locked) return Promise.reject(new RunLocked("a run is already in progress"));
    this.locked = true;
    return Promise.resolve({ release: () => { this.locked = false; } });
  }

  open(): Promise<IngestRun> {
    this.opens++;
    const late: { capture: string; result: IngestResult }[] = [];
    return Promise.resolve({
      processOne: (capture: string): Promise<IngestResult> => {
        if (this.aborting.has(capture)) return Promise.reject(new IngestAborted("Claude Code is unavailable"));
        const content = this.vault.captures.get(capture);
        if (content === undefined) return Promise.resolve({ kind: "not-found" });
        this.processed.push(capture);
        const r = this.decide(capture, content);
        if (r.kind === "ingested") {
          this.ingested.add(capture);
          this.vault.captures.delete(capture);
        }
        if (r.kind === "deferred") late.push({ capture, result: { kind: "held", reason: "fetch-failed", ask: `00-inbox/2026-10-12-ingest-${capture}` } });
        return Promise.resolve(r);
      },
      close: () => {
        this.closes++;
        return Promise.resolve(late);
      },
    });
  }

  wasIngested(capture: string): boolean {
    return this.ingested.has(capture);
  }
}

export class StepClock implements Clock {
  t: number;
  step: number;

  constructor(start = Date.parse("2026-10-12T06:00:00Z"), step = 0) {
    this.t = start;
    this.step = step;
  }

  now(): Date {
    const d = new Date(this.t);
    this.t += this.step;
    return d;
  }
}

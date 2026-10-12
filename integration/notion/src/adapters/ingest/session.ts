// Ingester adapter (DES-009, D1, D8): the one file coupling the connector to
// the ADR-0006 ingester. The shared lock, the ingest session seam
// (src/ingest/session.ts) and the ingester's ledger, behind the Ingester port.
import path from "node:path";
import type { AgentProvider } from "../../../../../src/ingest/agent/provider.ts";
import { ProviderUnavailable } from "../../../../../src/ingest/agent/provider.ts";
import { Ledger } from "../../../../../src/ingest/ledger.ts";
import { LockHeld, acquireLock, type Lock } from "../../../../../src/ingest/lock.ts";
import { LEDGER_REL, RunAbort, STATE_DIR, type ItemOutcome } from "../../../../../src/ingest/run.ts";
import { CantStart, ingestPreflight, openIngestSession, type IngestSession, type ProcessResult } from "../../../../../src/ingest/session.ts";
import { IngestAborted, IngestNotReady, RunLocked, type IngestResult, type IngestRun, type Ingester, type RunLock } from "../../application/ports.ts";

export interface SessionIngesterOptions {
  root: string;
  provider: AgentProvider;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  log?: (msg: string) => void;
}

function toResult(r: ProcessResult | ItemOutcome): IngestResult {
  switch (r.kind) {
    case "ingested": return { kind: "ingested", resource: r.resource };
    case "held": return { kind: "held", reason: r.record.reason ?? "", ask: r.ask };
    case "failed": return { kind: "failed", reason: r.record.reason ?? "failed", ...(r.ask ? { ask: r.ask } : {}) };
    case "network-deferred": return { kind: "deferred" };
    case "not-found": return { kind: "not-found" };
    case "already-held": return { kind: "already-held" };
  }
}

function captureOf(o: ItemOutcome): string {
  return o.kind === "network-deferred" ? o.item.name : o.record.item;
}

class SessionRun implements IngestRun {
  private readonly session: IngestSession;

  constructor(session: IngestSession) {
    this.session = session;
  }

  async processOne(capture: string): Promise<IngestResult> {
    try {
      return toResult(await this.session.processOne(capture));
    } catch (e) {
      if (e instanceof ProviderUnavailable || e instanceof RunAbort) {
        this.session.markAborted();
        throw new IngestAborted(`${e.name}: ${e.message}`);
      }
      throw e;
    }
  }

  async close(): Promise<{ capture: string; result: IngestResult }[]> {
    const { late } = await this.session.close();
    return late.map((o) => ({ capture: captureOf(o), result: toResult(o) }));
  }
}

export class SessionIngester implements Ingester {
  private readonly o: SessionIngesterOptions;
  private readonly locks = new WeakMap<RunLock, Lock>();
  private readonly held = new Set<Lock>();
  private ingested: Set<string> | null = null;

  constructor(o: SessionIngesterOptions) {
    this.o = o;
  }

  private now(): Date {
    return (this.o.now ?? (() => new Date()))();
  }

  async preflight(): Promise<void> {
    try {
      await ingestPreflight(this.o.root, this.o.provider);
    } catch (e) {
      if (e instanceof CantStart) throw new IngestNotReady(e.message.replace(/\s*Nothing was changed\.$/, ""));
      throw e;
    }
  }

  async lock(): Promise<RunLock> {
    try {
      const lock = await acquireLock(path.join(this.o.root, STATE_DIR), this.now(), this.o.log);
      const handle: RunLock = { release: () => { this.held.delete(lock); lock.release(); } };
      this.locks.set(handle, lock);
      this.held.add(lock);
      return handle;
    } catch (e) {
      if (e instanceof LockHeld) throw new RunLocked(e.message);
      throw e;
    }
  }

  async open(lock: RunLock): Promise<IngestRun> {
    const held = this.locks.get(lock);
    if (!held) throw new Error("open() needs a lock taken by this ingester");
    try {
      const session = await openIngestSession({ root: this.o.root, provider: this.o.provider, env: this.o.env ?? process.env, ...(this.o.now ? { now: this.o.now } : {}), ...(this.o.log ? { log: this.o.log } : {}), lock: held });
      return new SessionRun(session);
    } catch (e) {
      if (e instanceof CantStart || e instanceof RunAbort) throw new IngestAborted(`${e.name}: ${e.message}`);
      throw e;
    }
  }

  /** Release every lock still held; synchronous, for signal handlers. */
  releaseAll(): void {
    for (const l of this.held) l.release();
    this.held.clear();
  }

  wasIngested(capture: string): boolean {
    this.ingested ??= new Set(Ledger.readAll(path.join(this.o.root, LEDGER_REL)).flatMap((r) => (r.event === "item" && r.outcome === "ingested" ? [r.item] : [])));
    return this.ingested.has(capture);
  }
}

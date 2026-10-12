// Connector ledger (DES-007): .state/notion-pull/ledger.jsonl, JSON Lines,
// append-only, synced after each append, like the ingester's ledger. The
// strike, stop and resume rules are pure functions in domain/lifecycle.ts.
import { existsSync, readFileSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import type { ItemEvent } from "../../domain/capture.ts";
import type { PullLedger, RunEnd } from "../../application/ports.ts";

export const PULL_STATE_DIR = ".state/notion-pull";
export const PULL_LEDGER_REL = `${PULL_STATE_DIR}/ledger.jsonl`;

export type PullRecord =
  | { event: "run-start"; run: string }
  | { event: "intent"; run: string; id: string; capture: string }
  | { event: "pulled"; run: string; id: string; capture: string; sha256: string }
  | ({ event: "item" } & ItemEvent)
  | ({ event: "run-end"; run: string } & RunEnd);

/** Outcomes after which a pulled item no longer waits for ingestion. */
const SETTLED = new Set<ItemEvent["outcome"]>(["ingested", "held", "synced"]);

export class JsonlPullLedger implements PullLedger {
  readonly file: string;
  private readonly cache: PullRecord[];
  private run = "";
  private startPending = false;
  private started = false;

  constructor(file: string) {
    this.file = file;
    this.cache = JsonlPullLedger.readAll(file);
  }

  static readAll(file: string): PullRecord[] {
    if (!existsSync(file)) return [];
    const out: PullRecord[] = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const v: unknown = JSON.parse(line);
        if (v && typeof v === "object" && "event" in v) out.push(v as PullRecord);
      } catch {
        // a torn last line from a crash; ignore it
      }
    }
    return out;
  }

  records(): readonly PullRecord[] {
    return this.cache;
  }

  private async write(rec: PullRecord): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const fh = await open(this.file, "a");
    try {
      await fh.writeFile(`${JSON.stringify(rec)}\n`);
      await fh.datasync();
    } finally {
      await fh.close();
    }
    this.cache.push(rec);
  }

  private async append(rec: PullRecord): Promise<void> {
    if (this.startPending) {
      this.startPending = false;
      this.started = true;
      await this.write({ event: "run-start", run: this.run });
    }
    await this.write(rec);
  }

  startRun(run: string): void {
    this.run = run;
    this.startPending = true;
    this.started = false;
  }

  intent(id: string, capture: string): Promise<void> {
    return this.append({ event: "intent", run: this.run, id, capture });
  }

  pulled(id: string, capture: string, sha256: string): Promise<void> {
    return this.append({ event: "pulled", run: this.run, id, capture, sha256 });
  }

  item(event: ItemEvent): Promise<void> {
    return this.append({ event: "item", ...event });
  }

  async runEnd(end: RunEnd): Promise<void> {
    if (!this.started) return; // a no-op run leaves the ledger byte-identical
    await this.write({ event: "run-end", run: this.run, ...end });
  }

  isPulled(id: string): boolean {
    return this.cache.some((r) => r.event === "pulled" && r.id === id);
  }

  captureOf(id: string): string | null {
    for (const r of this.cache) if ((r.event === "pulled" || r.event === "intent") && r.id === id) return r.capture;
    return null;
  }

  events(id: string): ItemEvent[] {
    return this.cache.flatMap((r) => {
      if (r.event !== "item" || r.id !== id) return [];
      const e: ItemEvent = { id: r.id, run: r.run, capture: r.capture, outcome: r.outcome };
      if (r.reason !== undefined) e.reason = r.reason;
      if (r.ask !== undefined) e.ask = r.ask;
      if (r.strike !== undefined) e.strike = r.strike;
      return [e];
    });
  }

  openIntents(): { id: string; capture: string }[] {
    const out: { id: string; capture: string }[] = [];
    for (const r of this.cache) {
      if (r.event === "intent" && !this.isPulled(r.id) && !out.some((o) => o.id === r.id)) out.push({ id: r.id, capture: r.capture });
    }
    return out;
  }

  allPulled(): { id: string; capture: string }[] {
    return this.cache.flatMap((r) => (r.event === "pulled" ? [{ id: r.id, capture: r.capture }] : []));
  }

  pending(): { id: string; capture: string }[] {
    return this.allPulled().filter((p) => !this.events(p.id).some((e) => SETTLED.has(e.outcome) || e.ask !== undefined));
  }
}

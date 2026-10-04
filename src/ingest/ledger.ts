// Ledger (DES-017): .state/ingest-inbox/ledger.jsonl, JSON Lines, append-only,
// synced after each append. Read for ask ownership, strikes and recovery.
import { existsSync, readFileSync } from "node:fs";
import { open } from "node:fs/promises";

export type Outcome = "ingested" | "held" | "failed" | "recovered";

export interface RunStartRecord {
  event: "run-start";
  run: string;
  provider: string;
}

export interface ItemRecord {
  event: "item";
  run: string;
  item: string;
  sha256: string;
  outcome: Outcome;
  reason?: string;
  /** True for failures that count toward the 3-strike ask (DES-016). */
  strike?: boolean;
  resource?: string;
  targets?: string[];
  archived?: string;
  ask?: string;
  asksArchived?: string[];
  reads?: number;
  denied?: number;
  injectionSuspected?: boolean;
  usage?: Record<string, number>;
}

export interface RunEndRecord {
  event: "run-end";
  run: string;
  counts: Record<string, number>;
  skippedHeld: number;
  targetsExcluded: number;
  preflightMs: number;
  exit: number;
}

export type LedgerRecord = RunStartRecord | ItemRecord | RunEndRecord;

export class Ledger {
  readonly file: string;
  private cache: LedgerRecord[];

  constructor(file: string) {
    this.file = file;
    this.cache = Ledger.readAll(file);
  }

  static readAll(file: string): LedgerRecord[] {
    if (!existsSync(file)) return [];
    const out: LedgerRecord[] = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const v: unknown = JSON.parse(line);
        if (v && typeof v === "object" && "event" in v) out.push(v as LedgerRecord);
      } catch {
        // a torn last line from a crash; ignore it
      }
    }
    return out;
  }

  records(): readonly LedgerRecord[] {
    return this.cache;
  }

  async append(rec: LedgerRecord): Promise<void> {
    const fh = await open(this.file, "a");
    try {
      await fh.writeFile(`${JSON.stringify(rec)}\n`);
      await fh.datasync();
    } finally {
      await fh.close();
    }
    this.cache.push(rec);
  }

  itemRecords(item: string): ItemRecord[] {
    return this.cache.filter((r): r is ItemRecord => r.event === "item" && r.item === item);
  }

  hasIngested(item: string, sha: string): boolean {
    return this.itemRecords(item).some((r) => r.outcome === "ingested" && r.sha256 === sha);
  }

  /** The ingester created this ask (REQ-002, D5). */
  ownsAsk(askRel: string): boolean {
    return this.cache.some((r) => r.event === "item" && r.ask === askRel);
  }

  /** Consecutive counted failures, newest first, up to the first other outcome (DES-016). */
  strikes(item: string): number {
    let n = 0;
    for (const r of [...this.itemRecords(item)].reverse()) {
      if (r.outcome !== "failed") break;
      if (r.strike) n++;
    }
    return n;
  }

  lastFailureReason(item: string): string | undefined {
    return [...this.itemRecords(item)].reverse().find((r) => r.outcome === "failed")?.reason;
  }
}

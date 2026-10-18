// Domain model (DES-018): what the connector knows about a capture, free of
// Notion's data shapes and of any I/O. Adapters map to and from these types.

/** A source item's status. A blank status counts as New (requirements glossary). */
export type Status = "New" | "Ingested" | "Failed" | "";

export const STATUSES: readonly Status[] = ["New", "Ingested", "Failed", ""];

/** One row of the source inbox, as the pull run sees it. */
export interface SourceRow {
  id: string;
  title: string;
  status: Status;
  /** ISO 8601; Notion rounds it to the minute (A5), so ties break by id. */
  createdTime: string;
}

/** A source item's content, converted to Markdown (DES-006). */
export interface Capture {
  title: string;
  /** Markdown body, without the title. */
  body: string;
  /** The row's URL property, or null when unset. */
  url: string | null;
  /** The row's area-or-project hint, trimmed, or null when unset. */
  hint: string | null;
  /** Content kinds left out, counted by kind (REQ-012). */
  omitted: Readonly<Record<string, number>>;
}

/** What happened to a source item in one run (DES-007 `item` records). */
export type PullOutcome = "ingested" | "held" | "failed" | "stopped" | "resumed" | "synced";

/** One `item` record for a source item, as the lifecycle rules read it. */
export interface ItemEvent {
  id: string;
  run: string;
  capture: string | null;
  outcome: PullOutcome;
  reason?: string;
  ask?: string;
  /** True for a pull failure, which counts toward stopping the item (REQ-017, REQ-018). */
  strike?: boolean;
}

// Eligibility and selection (DES-008): pure. Which rows a pull run takes, in
// what order, and how many. Depends on no interval between runs (REQ-035).
import type { ItemEvent, SourceRow } from "./capture.ts";
import { isStopped, lastWasPullFailure } from "./lifecycle.ts";

export const MAX_ITEMS_PER_RUN = 10;

export interface Pending {
  id: string;
  capture: string;
}

export interface SelectionInput {
  /** Rows whose status isn't Ingested. */
  rows: readonly SourceRow[];
  instructionsId: string | null;
  isPulled: (id: string) => boolean;
  events: (id: string) => ItemEvent[];
  /** Pulled items still waiting for ingestion, oldest pull first. */
  pending: readonly Pending[];
  cap?: number;
}

export interface Selection {
  pending: Pending[];
  rows: SourceRow[];
  /** Stopped rows the operator set back to New, among the selected rows (REQ-019). */
  resumed: string[];
  /** Eligible rows left for later runs (REQ-010). */
  deferred: number;
}

/** Oldest first by (createdTime, id) (REQ-010). */
export function byCreation(a: SourceRow, b: SourceRow): number {
  if (a.createdTime !== b.createdTime) return a.createdTime < b.createdTime ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** An eligible source item: not pulled, not stopped (unless set back to New), and New, blank, or Failed by a pull failure. */
export function isEligible(row: SourceRow, events: readonly ItemEvent[]): boolean {
  if (isStopped(events)) return row.status === "New";
  if (row.status === "New" || row.status === "") return true;
  return row.status === "Failed" && lastWasPullFailure(events);
}

export function selectWork(input: SelectionInput): Selection {
  const cap = input.cap ?? MAX_ITEMS_PER_RUN;
  const pending = input.pending.slice(0, cap);
  const eligible = input.rows
    .filter((r) => r.id !== input.instructionsId && !input.isPulled(r.id) && isEligible(r, input.events(r.id)))
    .sort(byCreation);
  const rows = eligible.slice(0, Math.max(0, cap - pending.length));
  return {
    pending,
    rows,
    resumed: rows.filter((r) => isStopped(input.events(r.id))).map((r) => r.id),
    deferred: eligible.length - rows.length,
  };
}

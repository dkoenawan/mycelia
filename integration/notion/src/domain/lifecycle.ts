// Status lifecycle (DES-018, the design's state flow): New -> Ingested, or
// Failed (pull failure, retried; held or check failure, resolved in the vault;
// stopped after 3 consecutive pull failures, until the operator sets New).
import type { ItemEvent, PullOutcome, Status } from "./capture.ts";

/** Consecutive pull failures that stop an item and raise one ask (REQ-018). */
export const STRIKES_TO_STOP = 3;

export const STOPPED_REASON = "stopped: set Status to New to retry";

/** Consecutive pull failures, newest first, back to the last resume, success or stop. */
export function strikes(events: readonly ItemEvent[]): number {
  let n = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!e || e.outcome === "synced") continue;
    if (e.outcome === "failed" && e.strike) n++;
    else break;
  }
  return n;
}

/** Stopped: the latest stop has no later resume or success (REQ-018, REQ-019). */
export function isStopped(events: readonly ItemEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const o = events[i]?.outcome;
    if (o === "stopped") return true;
    if (o === "resumed" || o === "ingested") return false;
  }
  return false;
}

/** The latest outcome was a pull failure, so a Failed status means "retry me" (REQ-017). */
export function lastWasPullFailure(events: readonly ItemEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!e || e.outcome === "synced") continue;
    return e.outcome === "failed" && e.strike === true;
  }
  return false;
}

/** This pull failure is the one that stops the item. */
export function stopsNow(events: readonly ItemEvent[]): boolean {
  return strikes(events) + 1 >= STRIKES_TO_STOP;
}

/** Status and Reason to write for an outcome, or null when nothing is written. */
export function nextStatus(e: Pick<ItemEvent, "outcome" | "reason" | "ask">): { status: Status; reason: string } | null {
  const outcome: PullOutcome = e.outcome;
  switch (outcome) {
    case "ingested":
    case "synced":
      return { status: "Ingested", reason: "" };
    case "held":
      return { status: "Failed", reason: `held: ${holdCause(e.reason)}${e.ask ? `; see ask ${baseName(e.ask)}` : ""}` };
    case "failed":
      return { status: "Failed", reason: e.reason ?? "failed" };
    case "stopped":
      return { status: "Failed", reason: STOPPED_REASON };
    case "resumed":
      return null;
  }
}

/** The status the connector last wrote for an item, or null if it never wrote one. */
export function lastStatusWritten(events: readonly ItemEvent[]): Status | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!e) continue;
    const s = nextStatus(e);
    if (s) return s.status;
  }
  return null;
}

const HOLD_CAUSES: Readonly<Record<string, string>> = {
  "no-fit": "no area or project fitted",
  empty: "the capture is empty",
  "fetch-failed": "a linked page couldn't be fetched",
  unsupported: "the capture isn't a supported kind",
  "check-failed": "the ingester's check failed three times",
};

/** The ingester's hold reason in words, for the Reason property (REQ-016). */
export function holdCause(reason: string | undefined): string {
  if (!reason) return "the ingester held it";
  return HOLD_CAUSES[reason] ?? reason;
}

function baseName(rel: string): string {
  const i = rel.lastIndexOf("/");
  return i >= 0 ? rel.slice(i + 1) : rel;
}

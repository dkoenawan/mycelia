// Status lifecycle rules (DES-018): strikes, stop, resume, status mapping.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ItemEvent } from "../../src/domain/capture.ts";
import { STOPPED_REASON, holdCause, isStopped, lastStatusWritten, lastWasPullFailure, nextStatus, stopsNow, strikes } from "../../src/domain/lifecycle.ts";

const ev = (outcome: ItemEvent["outcome"], extra: Partial<ItemEvent> = {}): ItemEvent => ({ id: "r1", run: "2026-10-12T06:00:00Z", capture: "c.md", outcome, ...extra });
const pullFail = (): ItemEvent => ev("failed", { reason: "read failed", strike: true });

test("three consecutive pull failures stop the item", () => {
  const e: ItemEvent[] = [pullFail(), pullFail()];
  assert.equal(strikes(e), 2);
  assert.equal(stopsNow(e), true);
  assert.equal(stopsNow([pullFail()]), false);
  e.push(ev("stopped", { reason: "read failed" }));
  assert.equal(isStopped(e), true);
  assert.equal(strikes(e), 0);
});

test("resumed resets the count and ends the stop (REQ-019)", () => {
  const e: ItemEvent[] = [pullFail(), pullFail(), pullFail(), ev("stopped"), ev("resumed")];
  assert.equal(isStopped(e), false);
  assert.equal(strikes(e), 0);
  e.push(pullFail());
  assert.equal(strikes(e), 1);
});

test("a success or a check failure breaks the strike run; synced is transparent", () => {
  assert.equal(strikes([pullFail(), ev("ingested"), pullFail()]), 1);
  assert.equal(strikes([pullFail(), ev("failed", { reason: "check" }), pullFail()]), 1);
  assert.equal(strikes([pullFail(), ev("synced"), pullFail()]), 2);
  assert.equal(lastWasPullFailure([pullFail(), ev("synced")]), true);
  assert.equal(lastWasPullFailure([ev("failed", { reason: "check" })]), false);
  assert.equal(lastWasPullFailure([]), false);
});

test("nextStatus maps outcomes to Status and Reason (REQ-015..018)", () => {
  assert.deepEqual(nextStatus(ev("ingested")), { status: "Ingested", reason: "" });
  assert.deepEqual(nextStatus(ev("synced")), { status: "Ingested", reason: "" });
  assert.deepEqual(nextStatus(ev("held", { reason: "no-fit", ask: "00-inbox/2026-10-12-ingest-x.md" })), { status: "Failed", reason: "held: no area or project fitted; see ask 2026-10-12-ingest-x.md" });
  assert.deepEqual(nextStatus(ev("failed", { reason: "fault" })), { status: "Failed", reason: "fault" });
  assert.deepEqual(nextStatus(ev("stopped")), { status: "Failed", reason: STOPPED_REASON });
  assert.equal(nextStatus(ev("resumed")), null);
  assert.equal(holdCause("something-new"), "something-new");
});

test("lastStatusWritten skips records that write nothing", () => {
  assert.equal(lastStatusWritten([]), null);
  assert.equal(lastStatusWritten([ev("held", { reason: "no-fit" }), ev("resumed")]), "Failed");
  assert.equal(lastStatusWritten([ev("held"), ev("synced")]), "Ingested");
});

// Eligibility and selection (DES-008).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ItemEvent, SourceRow } from "../../src/domain/capture.ts";
import { selectWork } from "../../src/domain/eligibility.ts";

const row = (id: string, minute: number, status: SourceRow["status"] = "New"): SourceRow => ({ id, title: id, status, createdTime: `2026-10-11T08:${String(minute).padStart(2, "0")}:00.000Z` });
const none = (): ItemEvent[] => [];
const ev = (id: string, outcome: ItemEvent["outcome"], strike = false): ItemEvent => ({ id, run: "r", capture: null, outcome, ...(strike ? { strike } : {}) });

test("REQ-010: 12 eligible rows, the oldest 10, ties broken by ID", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(`id-${String(i).padStart(2, "0")}`, 30 - i));
  rows.push(row("id-zz", 19), row("id-aa", 19)); // tie with id-11 at minute 19
  const sel = selectWork({ rows, instructionsId: null, isPulled: () => false, events: none, pending: [] });
  assert.equal(sel.rows.length, 10);
  assert.deepEqual(sel.rows.slice(0, 3).map((r) => r.id), ["id-11", "id-aa", "id-zz"]);
  assert.equal(sel.deferred, 4);
});

test("pending ingests go first and count toward the cap; the instructions row and pulled rows are dropped", () => {
  const rows = [row("ins", 1), row("pulled", 2), row("a", 3), row("b", 4)];
  const sel = selectWork({ rows, instructionsId: "ins", isPulled: (id) => id === "pulled", events: none, pending: [{ id: "p1", capture: "p1.md" }], cap: 2 });
  assert.deepEqual(sel.pending.map((p) => p.id), ["p1"]);
  assert.deepEqual(sel.rows.map((r) => r.id), ["a"]);
  assert.equal(sel.deferred, 1);
});

test("Failed rows: retried after a pull failure, not after a hold or check failure", () => {
  const events = (id: string): ItemEvent[] => (id === "pf" ? [ev(id, "failed", true)] : id === "held" ? [ev(id, "held")] : []);
  const sel = selectWork({ rows: [row("pf", 1, "Failed"), row("held", 2, "Failed"), row("manual", 3, "Failed"), row("blank", 4, "")], instructionsId: null, isPulled: () => false, events, pending: [] });
  assert.deepEqual(sel.rows.map((r) => r.id), ["pf", "blank"]);
});

test("REQ-019: a stopped row is eligible again only once set to New, and is marked resumed", () => {
  const stopped = [ev("s", "failed", true), ev("s", "failed", true), ev("s", "failed", true), ev("s", "stopped")];
  const sel1 = selectWork({ rows: [row("s", 1, "Failed")], instructionsId: null, isPulled: () => false, events: () => stopped, pending: [] });
  assert.deepEqual(sel1.rows, []);
  const sel2 = selectWork({ rows: [row("s", 1, "New")], instructionsId: null, isPulled: () => false, events: () => stopped, pending: [] });
  assert.deepEqual(sel2.rows.map((r) => r.id), ["s"]);
  assert.deepEqual(sel2.resumed, ["s"]);
});

test("REQ-035: a run right after another changes nothing (everything taken is now pulled)", () => {
  const rows = [row("mon", 1), row("wed", 50)];
  const first = selectWork({ rows, instructionsId: null, isPulled: () => false, events: none, pending: [] });
  assert.deepEqual(first.rows.map((r) => r.id), ["mon", "wed"]);
  const second = selectWork({ rows, instructionsId: null, isPulled: () => true, events: none, pending: [] });
  assert.deepEqual([second.rows, second.pending, second.deferred], [[], [], 0]);
});

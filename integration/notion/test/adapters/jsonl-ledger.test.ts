// Connector ledger adapter (DES-007).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isStopped, strikes } from "../../src/domain/lifecycle.ts";
import { JsonlPullLedger, PULL_LEDGER_REL } from "../../src/adapters/ledger/jsonl-ledger.ts";

function dir(): { file: string; done: () => void } {
  const root = mkdtempSync(path.join(os.tmpdir(), "mycelia-pull-ledger-"));
  return { file: path.join(root, PULL_LEDGER_REL), done: () => { rmSync(root, { recursive: true, force: true }); } };
}

test("records survive a reload; three strikes then stopped; resumed resets", async () => {
  const d = dir();
  try {
    let l = new JsonlPullLedger(d.file);
    for (const run of ["r1", "r2", "r3"]) {
      l.startRun(run);
      await l.item({ id: "a", run, capture: null, outcome: "failed", reason: "read failed", strike: true });
      await l.runEnd({ counts: { failed: 1 }, pullMs: 5, exit: 1 });
    }
    l = new JsonlPullLedger(d.file);
    assert.equal(strikes(l.events("a")), 3);
    l.startRun("r4");
    await l.item({ id: "a", run: "r4", capture: null, outcome: "stopped", ask: "00-inbox/x.md" });
    assert.equal(isStopped(new JsonlPullLedger(d.file).events("a")), true);
    await l.item({ id: "a", run: "r4", capture: null, outcome: "resumed" });
    l = new JsonlPullLedger(d.file);
    assert.equal(isStopped(l.events("a")), false);
    assert.equal(strikes(l.events("a")), 0);
    assert.deepEqual(l.records().filter((r) => r.event === "run-start").map((r) => r.run), ["r1", "r2", "r3", "r4"]);
  } finally { d.done(); }
});

test("an intent with no pulled record shows up for recovery; pending tracks settled items", async () => {
  const d = dir();
  try {
    const l = new JsonlPullLedger(d.file);
    l.startRun("r1");
    await l.intent("a", "a.md");
    await l.intent("b", "b.md");
    await l.pulled("b", "b.md", "sha");
    await l.intent("c", "c.md");
    await l.pulled("c", "c.md", "sha");
    assert.deepEqual(l.openIntents(), [{ id: "a", capture: "a.md" }]);
    assert.equal(l.isPulled("b"), true);
    assert.equal(l.captureOf("a"), "a.md");
    assert.deepEqual(l.pending().map((p) => p.id), ["b", "c"]);
    await l.item({ id: "b", run: "r1", capture: "b.md", outcome: "failed", reason: "check" });
    await l.item({ id: "c", run: "r1", capture: "c.md", outcome: "held", reason: "no-fit", ask: "00-inbox/c.md" });
    assert.deepEqual(l.pending().map((p) => p.id), ["b"]);
    await l.item({ id: "b", run: "r1", capture: "b.md", outcome: "ingested" });
    assert.deepEqual(l.pending(), []);
  } finally { d.done(); }
});

test("a row re-pulled under a new name answers with its latest intent and pulled name", async () => {
  const d = dir();
  try {
    const l = new JsonlPullLedger(d.file);
    l.startRun("r1");
    await l.intent("a", "old.md");
    await l.intent("a", "new.md");
    assert.deepEqual(l.openIntents(), [{ id: "a", capture: "new.md" }]);
    assert.equal(l.captureOf("a"), "new.md");
    await l.pulled("a", "new.md", "sha");
    assert.deepEqual(l.openIntents(), []);
    assert.equal(l.captureOf("a"), "new.md");
  } finally { d.done(); }
});

test("a no-op run leaves the file byte-identical (and absent if it was)", async () => {
  const d = dir();
  try {
    let l = new JsonlPullLedger(d.file);
    l.startRun("r1");
    await l.runEnd({ counts: {}, pullMs: 1, exit: 0 });
    assert.equal(existsSync(d.file), false);
    l.startRun("r2");
    await l.item({ id: "a", run: "r2", capture: "a.md", outcome: "synced" });
    await l.runEnd({ counts: { synced: 1 }, pullMs: 1, exit: 0 });
    const before = readFileSync(d.file);
    l = new JsonlPullLedger(d.file);
    l.startRun("r3");
    await l.runEnd({ counts: {}, pullMs: 1, exit: 0 });
    assert.deepEqual(readFileSync(d.file), before);
  } finally { d.done(); }
});

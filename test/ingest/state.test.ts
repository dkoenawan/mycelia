import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LockHeld, acquireLock } from "../../src/ingest/lock.ts";
import { Ledger } from "../../src/ingest/ledger.ts";
import { Journal, RollbackConflict, sha256, writtenPaths } from "../../src/ingest/journal.ts";
import { tempVault } from "../helpers/vault.ts";

const now = new Date("2026-10-01T06:00:00Z");

test("lock: exclusive, live lock refuses, stale or old locks are taken over, release is ours only", async () => {
  const v = tempVault();
  try {
    const dir = path.join(v.root, ".state/ingest-inbox");
    const a = await acquireLock(dir, now);
    await assert.rejects(acquireLock(dir, now), LockHeld);
    a.release();
    assert.equal(existsSync(a.path), false);
    // Dead pid: stale.
    const dead = spawnSync(process.execPath, ["-e", "process.exit(0)"]).pid;
    writeFileSync(a.path, JSON.stringify({ pid: dead, hostname: os.hostname(), started: now.toISOString() }));
    const b = await acquireLock(dir, now);
    // Older than 2 hours: stale, even with a live pid.
    writeFileSync(a.path, JSON.stringify({ pid: process.pid, hostname: os.hostname(), started: "2026-10-01T03:00:00Z" }));
    const c = await acquireLock(dir, new Date(now.getTime() + 1000));
    // Another host: stale.
    writeFileSync(a.path, JSON.stringify({ pid: process.pid, hostname: "elsewhere", started: now.toISOString() }));
    const d = await acquireLock(dir, new Date(now.getTime() + 2000));
    b.release();
    c.release();
    assert.equal(existsSync(a.path), true, "release leaves another run's lock alone");
    d.release();
    assert.equal(existsSync(a.path), false);
    // Corrupt lock file: stale.
    writeFileSync(a.path, "{not json");
    (await acquireLock(dir, now)).release();
  } finally { v.done(); }
});

test("ledger: append, torn line, ownership, strikes", async () => {
  const v = tempVault();
  try {
    mkdirSync(path.join(v.root, ".state"), { recursive: true });
    const file = path.join(v.root, ".state/ledger.jsonl");
    const l = new Ledger(file);
    const run = "2026-10-01T06:00:00Z";
    await l.append({ event: "run-start", run, provider: "fake" });
    await l.append({ event: "item", run, item: "odd.md", sha256: "a", outcome: "failed", reason: "x", strike: true });
    await l.append({ event: "item", run, item: "odd.md", sha256: "a", outcome: "failed", reason: "changed-during-run" });
    await l.append({ event: "item", run, item: "odd.md", sha256: "a", outcome: "failed", reason: "y", strike: true });
    await l.append({ event: "item", run, item: "s.md", sha256: "b", outcome: "held", reason: "no-fit", ask: "00-inbox/2026-10-01-ingest-s.md" });
    writeFileSync(file, readFileSync(file, "utf8") + '{"event":"item","tor');
    const r = new Ledger(file);
    assert.equal(r.records().length, 5);
    assert.equal(r.strikes("odd.md"), 2);
    assert.equal(r.lastFailureReason("odd.md"), "y");
    assert.equal(r.ownsAsk("00-inbox/2026-10-01-ingest-s.md"), true);
    assert.equal(r.ownsAsk("00-inbox/2026-10-01-renew-cert.md"), false);
    await l.append({ event: "item", run, item: "odd.md", sha256: "a", outcome: "held", reason: "check-failed" });
    assert.equal(l.strikes("odd.md"), 0);
  } finally { v.done(); }
});

function fixture(): { v: ReturnType<typeof tempVault>; stateDir: string; snapshot: () => Record<string, string | null> } {
  const v = tempVault({ "20-areas/career.md": "---\nname: career\n---\n\nResources:\n-\n", "00-inbox/capture/post.md": "a post\n" });
  const stateDir = path.join(v.root, ".state/ingest-inbox");
  mkdirSync(stateDir, { recursive: true });
  const files = ["20-areas/career.md", "00-inbox/capture/post.md", "30-resources/post-summary.md", "40-archive/capture/post.md"];
  const snapshot = (): Record<string, string | null> =>
    Object.fromEntries(files.map((f) => [f, existsSync(path.join(v.root, f)) ? readFileSync(path.join(v.root, f), "utf8") : null]));
  return { v, stateDir, snapshot };
}

test("journal: apply then commit; rollback restores; write set lists every path", async () => {
  const { v, stateDir, snapshot } = fixture();
  try {
    const before = snapshot();
    const j = new Journal(v.root, stateDir);
    const plan = [
      { op: "create" as const, path: "30-resources/post-summary.md", content: "r\n" },
      { op: "modify" as const, path: "20-areas/career.md", content: "changed\n" },
      { op: "move" as const, src: "00-inbox/capture/post.md", dst: "40-archive/capture/post.md" },
    ];
    const txn = await j.begin({ run: "r", item: "post.md", itemSha: sha256("a post\n") }, plan);
    assert.deepEqual(writtenPaths(txn.journal.ops), ["30-resources/post-summary.md", "20-areas/career.md", "00-inbox/capture/post.md", "40-archive/capture/post.md"]);
    await j.apply(txn);
    assert.equal(snapshot()["40-archive/capture/post.md"], "a post\n");
    await j.rollback(txn.journal);
    assert.deepEqual(snapshot(), before);
    assert.equal(j.read(), null);
    // Rollback is idempotent: nothing applied, nothing to undo.
    const txn2 = await j.begin({ run: "r", item: "post.md", itemSha: "x" }, plan);
    await j.rollback(txn2.journal);
    assert.deepEqual(snapshot(), before);
    // Commit drops the journal after the ledger callback.
    const txn3 = await j.begin({ run: "r", item: "post.md", itemSha: "x" }, plan);
    await j.apply(txn3);
    let appended = false;
    await j.commit(() => { appended = true; return Promise.resolve(); });
    assert.equal(appended, true);
    assert.equal(j.read(), null);
    assert.equal(existsSync(j.txnDir), false);
  } finally { v.done(); }
});

test("journal: an operator edit after a crash is a conflict and nothing is touched", async () => {
  const { v, stateDir, snapshot } = fixture();
  try {
    const j = new Journal(v.root, stateDir);
    const txn = await j.begin({ run: "r", item: "post.md", itemSha: "x" }, [
      { op: "create", path: "30-resources/post-summary.md", content: "r\n" },
      { op: "modify", path: "20-areas/career.md", content: "changed\n" },
    ]);
    await j.apply(txn);
    writeFileSync(path.join(v.root, "20-areas/career.md"), "operator edit\n");
    const mid = snapshot();
    await assert.rejects(j.recover(() => false), (e: unknown) => e instanceof RollbackConflict && e.files.includes("20-areas/career.md"));
    assert.deepEqual(snapshot(), mid);
    assert.ok(j.read(), "journal kept");
  } finally { v.done(); }
});

const CHILD = path.join(import.meta.dirname, "..", "helpers", "crash-child.ts");

for (const killAt of ["begin", "0", "1", "2", "ledger"]) {
  test(`crash gate: killed at ${killAt}, then recovery leaves the item ingested once or untouched`, async () => {
    const { v, stateDir, snapshot } = fixture();
    try {
      const before = snapshot();
      const r = spawnSync(process.execPath, [CHILD, v.root, stateDir, killAt], { encoding: "utf8" });
      assert.equal(r.signal, "SIGKILL", r.stderr);
      const ledger = new Ledger(path.join(stateDir, "ledger.jsonl"));
      const j = new Journal(v.root, stateDir);
      const recovered = await j.recover((jf) => ledger.itemRecords(jf.item).some((x) => x.run === jf.run && x.sha256 === jf.itemSha));
      assert.equal(j.read(), null);
      const after = snapshot();
      if (killAt === "ledger") {
        assert.equal(recovered, null);
        assert.equal(after["00-inbox/capture/post.md"], null);
        assert.equal(after["40-archive/capture/post.md"], "a post\n");
        assert.equal(after["30-resources/post-summary.md"], "resource\n");
      } else {
        assert.deepEqual(after, before);
        if (killAt !== "begin") assert.equal(recovered?.item, "post.md");
      }
    } finally { v.done(); }
  });
}

test("crash gate: killed with no journal yet leaves only stray backups, which recovery clears", async () => {
  const { v, stateDir } = fixture();
  try {
    mkdirSync(path.join(stateDir, "txn"), { recursive: true });
    writeFileSync(path.join(stateDir, "txn", "x.bak"), "x");
    assert.equal(await new Journal(v.root, stateDir).recover(() => false), null);
    assert.equal(existsSync(path.join(stateDir, "txn")), false);
  } finally { v.done(); }
});

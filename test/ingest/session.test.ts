// The ingest session seam (#21 DES-001): open / processOne / close.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { FakeProvider } from "../../src/ingest/agent/fake.ts";
import { Ledger } from "../../src/ingest/ledger.ts";
import { LockHeld, acquireLock } from "../../src/ingest/lock.ts";
import { EXIT, LEDGER_REL, STATE_DIR } from "../../src/ingest/run.ts";
import { CantStart, openIngestSession } from "../../src/ingest/session.ts";
import { tempVault } from "../helpers/vault.ts";
import { BOOTSTRAP_AREA, noFit, placing } from "../helpers/pipeline.ts";

const POST = "Pasted text about designing agentic workflows and planning. ".repeat(15);
const NOW = new Date("2026-10-12T06:00:00Z");

function vault(): ReturnType<typeof tempVault> {
  return tempVault({ "20-areas/career.md": BOOTSTRAP_AREA("career", "Work and career"), "00-inbox/README.md": "readme" });
}

test("processOne processes exactly the named item; a hand-dropped file stays byte-identical", async () => {
  const v = vault();
  try {
    v.write("00-inbox/capture/a.md", POST);
    v.write("00-inbox/capture/b.md", `${POST} hand-dropped`);
    const before = readFileSync(path.join(v.root, "00-inbox/capture/b.md"));
    const s = await openIngestSession({ root: v.root, provider: new FakeProvider(placing(["career"])), now: () => NOW, env: {} });
    const out = await s.processOne("a.md");
    assert.equal(out.kind, "ingested");
    assert.deepEqual(await s.processOne("gone.md"), { kind: "not-found", item: "gone.md" });
    const closed = await s.close();
    assert.deepEqual(closed, { late: [], exit: EXIT.ok });
    assert.deepEqual(readFileSync(path.join(v.root, "00-inbox/capture/b.md")), before);
    assert.equal(existsSync(path.join(v.root, "00-inbox/capture/a.md")), false);
    const events = Ledger.readAll(path.join(v.root, LEDGER_REL)).map((r) => r.event);
    assert.deepEqual(events, ["run-start", "item", "run-end"]);
    assert.ok(readFileSync(path.join(v.root, "daily/2026-10-12.md"), "utf8").includes("## Inbox ingestion (06:00 UTC)"));
    assert.equal(existsSync(path.join(v.root, STATE_DIR, "lock")), false);
  } finally { v.done(); }
});

test("a held item reports already-held and isn't processed again", async () => {
  const v = vault();
  try {
    v.write("00-inbox/capture/bread.md", `${POST} sourdough`);
    const s1 = await openIngestSession({ root: v.root, provider: new FakeProvider(noFit()), now: () => NOW, env: {} });
    assert.equal((await s1.processOne("bread.md")).kind, "held");
    await s1.close();
    const fake = new FakeProvider(noFit());
    const s2 = await openIngestSession({ root: v.root, provider: fake, now: () => NOW, env: {} });
    assert.deepEqual(await s2.processOne("bread.md"), { kind: "already-held", item: "bread.md" });
    assert.equal(fake.requests.length, 0);
    await s2.close();
  } finally { v.done(); }
});

test("a session given an external lock leaves it in place; a second session meanwhile throws LockHeld", async () => {
  const v = vault();
  try {
    const lock = await acquireLock(path.join(v.root, STATE_DIR), NOW);
    await assert.rejects(openIngestSession({ root: v.root, provider: new FakeProvider(placing(["career"])), now: () => NOW, env: {} }), LockHeld);
    const s = await openIngestSession({ root: v.root, provider: new FakeProvider(placing(["career"])), now: () => NOW, env: {}, lock });
    const res = await s.close();
    assert.equal(res.exit, EXIT.ok);
    assert.equal(existsSync(lock.path), true);
    // Nothing processed: no daily block.
    assert.equal(existsSync(path.join(v.root, "daily/2026-10-12.md")), false);
    lock.release();
    assert.equal(existsSync(lock.path), false);
  } finally { v.done(); }
});

test("open throws CantStart before taking the lock when the ingester can't start", async () => {
  const v = tempVault({ "00-inbox/README.md": "readme" });
  try {
    await assert.rejects(openIngestSession({ root: v.root, provider: new FakeProvider(placing([])), now: () => NOW, env: {} }), CantStart);
    assert.equal(existsSync(path.join(v.root, STATE_DIR)), false);
  } finally { v.done(); }
});

// Pull and preflight use cases (DES-009) against in-memory fakes of every port.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXIT, START_CUTOFF_MS, pullInbox, type PullDeps } from "../../src/application/pull-inbox.ts";
import { preflight } from "../../src/application/preflight.ts";
import { SourceNoAccess, type ConnectorConfig, type IngestResult } from "../../src/application/ports.ts";
import { STOPPED_REASON } from "../../src/domain/lifecycle.ts";
import { FakeIngester, MemoryConfig, MemoryPullLedger, MemorySourceInbox, MemoryVault, StepClock, logSink, type Decide } from "../fakes/ports.ts";

const CFG: ConnectorConfig = { version: 1, api_key: "secret_TESTKEY0000", database_id: "db-1", data_source_id: "ds-1", instructions_page_id: null, status_property: "select" };

const ingestAll: Decide = (capture) => ({ kind: "ingested", resource: `30-resources/${capture.replace(/^notion-|-row.*$/g, "")}.md` });

interface World {
  inbox: MemorySourceInbox;
  vault: MemoryVault;
  ingester: FakeIngester;
  ledger: MemoryPullLedger;
  config: MemoryConfig;
  clock: StepClock;
  out: ReturnType<typeof logSink>;
  deps: PullDeps;
  run: () => Promise<number>;
}

function world(decide: Decide = ingestAll): World {
  const inbox = new MemorySourceInbox();
  const vault = new MemoryVault();
  const ingester = new FakeIngester(vault, decide);
  const ledger = new MemoryPullLedger();
  const config = new MemoryConfig();
  config.value = { ...CFG };
  const clock = new StepClock();
  const out = logSink();
  const deps: PullDeps = { config, connect: () => inbox, ingester, vault, ledger, clock, log: out.log };
  return { inbox, vault, ingester, ledger, config, clock, out, deps, run: () => pullInbox(deps) };
}

const items = (w: World): { id: string; outcome: string; reason?: string; capture: string | null; run: string }[] =>
  w.ledger.records().flatMap((r) => (r.event === "item" ? [r] : []));

test("happy path: pulled, ingested, Ingested, recorded, summarised (REQ-011, REQ-014, REQ-015, REQ-031, REQ-032)", async () => {
  const w = world();
  const a = w.inbox.add("Agentic workflows");
  const b = w.inbox.add("Interview prep");
  assert.equal(await w.run(), EXIT.ok, w.out.lines.join("\n"));
  assert.deepEqual([a.status, b.status], ["Ingested", "Ingested"]);
  assert.deepEqual(w.ingester.processed, ["notion-agentic-workflows-row01.md", "notion-interview-prep-row02.md"]);
  assert.deepEqual(items(w).map((r) => [r.id, r.outcome, r.capture]), [[a.id, "ingested", "notion-agentic-workflows-row01.md"], [b.id, "ingested", "notion-interview-prep-row02.md"]]);
  assert.ok(items(w).every((r) => r.run === "2026-10-12T06:00:00Z"));
  assert.equal(w.vault.daily.length, 1);
  assert.match(w.vault.daily[0]?.block ?? "", /## Phone capture \(06:00 UTC\)\n\n- 2 ingested from phone capture\n- Resources: /);
  assert.equal(w.ingester.locked, false);
  assert.deepEqual(w.ledger.records().map((r) => r.event), ["run-start", "intent", "pulled", "item", "intent", "pulled", "item", "run-end"]);
});

test("REQ-003: the instructions row is never pulled or changed", async () => {
  const w = world();
  const ins = w.inbox.add("How to capture (read me)");
  w.config.value = { ...CFG, instructions_page_id: ins.id };
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(ins.status, "New");
  assert.deepEqual(w.inbox.statusWrites, []);
  assert.deepEqual(w.ledger.records(), []);
  assert.equal(w.vault.captures.size, 0);
});

test("REQ-010: 12 eligible rows, the 10 oldest processed oldest first", async () => {
  const w = world();
  const rows = Array.from({ length: 12 }, (_, i) => w.inbox.add(`Item ${String(i + 1)}`));
  assert.equal(await w.run(), EXIT.ok);
  assert.deepEqual(items(w).map((r) => r.id), rows.slice(0, 10).map((r) => r.id));
  assert.deepEqual(rows.slice(10).map((r) => r.status), ["New", "New"]);
});

test("REQ-016: a held item gets Failed with the cause and the ingester's ask; the connector raises none", async () => {
  const w = world((c) => ({ kind: "held", reason: "no-fit", ask: `00-inbox/2026-10-12-ingest-${c.replace(/\.md$/, "")}.md` }));
  const s = w.inbox.add("Sourdough");
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(s.status, "Failed");
  assert.equal(s.reason, "held: no area or project fitted; see ask 2026-10-12-ingest-notion-sourdough-row01.md");
  assert.equal(w.vault.asks.size, 0);
  assert.match(w.vault.daily[0]?.block ?? "", /0 ingested, 1 held from phone capture/);
});

test("REQ-017: a pull failure sets Failed with the reason, exits 1, and is retried next run", async () => {
  const w = world();
  const n = w.inbox.add("Notes");
  w.inbox.failingReads.add(n.id);
  assert.equal(await w.run(), EXIT.itemFailed);
  assert.equal(n.status, "Failed");
  assert.match(n.reason, /validation_error/);
  w.inbox.failingReads.clear();
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(n.status, "Ingested");
});

test("REQ-018/019: three pull failures raise one ask and stop; set back to New, it's ingested", async () => {
  const w = world();
  const n = w.inbox.add("Notes");
  w.inbox.failingReads.add(n.id);
  for (let i = 0; i < 3; i++) assert.equal(await w.run(), EXIT.itemFailed);
  assert.equal(w.vault.asks.size, 1);
  const [askRel, ask] = [...w.vault.asks.entries()][0] ?? [];
  assert.equal(askRel, "00-inbox/2026-10-12-notion-stopped-notes.md");
  assert.ok(ask?.includes("Notes") && ask.includes("set its Status to New to retry") && ask.includes("validation_error"));
  assert.equal(n.reason, STOPPED_REASON);
  const before = w.ledger.records().length;
  assert.equal(await w.run(), EXIT.ok); // fourth run: stopped, not retried
  assert.equal(w.ledger.records().length, before);
  assert.equal(w.vault.asks.size, 1);
  // REQ-019
  w.inbox.failingReads.clear();
  n.status = "New";
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(n.status, "Ingested");
  assert.deepEqual(items(w).slice(-2).map((r) => r.outcome), ["resumed", "ingested"]);
});

test("REQ-020: a held item ingested later by task ingest-inbox is caught up to Ingested", async () => {
  const w = world((c) => ({ kind: "held", reason: "no-fit", ask: `00-inbox/x-${c}` }));
  const s = w.inbox.add("Sourdough");
  await w.run();
  assert.equal(s.status, "Failed");
  w.ingester.ingested.add("notion-sourdough-row01.md"); // the operator linked it and ran task ingest-inbox
  assert.equal(await w.run(), EXIT.ok);
  assert.deepEqual([s.status, s.reason], ["Ingested", ""]);
  assert.equal(items(w).at(-1)?.outcome, "synced");
  assert.equal(w.vault.daily.length, 1); // catch-up alone isn't a processed item
});

test("REQ-013: killed after writing the capture and before recording it, the next run doesn't duplicate it", async () => {
  const w = world();
  const a = w.inbox.add("Agentic workflows");
  w.ledger.startRun("2026-10-12T05:00:00Z");
  await w.ledger.intent(a.id, "notion-agentic-workflows-row01.md");
  w.vault.captures.set("notion-agentic-workflows-row01.md", "written before the crash");
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(a.status, "Ingested");
  assert.deepEqual(w.ingester.processed, ["notion-agentic-workflows-row01.md"]);
});

test("REQ-013: killed after ingesting and before setting the status, the next run catches up", async () => {
  const w = world();
  const a = w.inbox.add("Agentic workflows");
  w.ledger.startRun("2026-10-12T05:00:00Z");
  await w.ledger.intent(a.id, "notion-agentic-workflows-row01.md");
  await w.ledger.pulled(a.id, "notion-agentic-workflows-row01.md", "sha");
  w.ingester.ingested.add("notion-agentic-workflows-row01.md");
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(a.status, "Ingested");
  assert.deepEqual(w.ingester.processed, []);
});

test("REQ-021/035: edits after the pull are ignored; a second run right after changes nothing", async () => {
  const w = world();
  const a = w.inbox.add("Monday");
  w.inbox.add("Wednesday");
  await w.run();
  assert.deepEqual(w.ingester.processed, ["notion-monday-row01.md", "notion-wednesday-row02.md"]);
  a.capture = { ...a.capture, body: "edited" };
  const records = w.ledger.records().length;
  const writes = w.inbox.statusWrites.length;
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(w.ingester.processed.length, 2);
  assert.equal(w.ledger.records().length, records);
  assert.equal(w.inbox.statusWrites.length, writes);
});

test("REQ-028: no config means exit 2 naming setup, and nothing changed", async () => {
  const w = world();
  w.config.value = null;
  w.inbox.add("x");
  assert.equal(await w.run(), EXIT.cantStart);
  assert.match(w.out.lines.join("\n"), /task notion:setup/);
  assert.deepEqual([w.ledger.records().length, w.inbox.statusWrites.length, w.vault.captures.size, w.ingester.locked], [0, 0, 0, false]);
});

test("REQ-028/036: a rejected key, a lost inbox, unignored paths or an unready ingester can't start", async () => {
  for (const setup of [
    (w: World): void => { w.inbox.checkError = new SourceNoAccess("Could not find data source"); },
    (w: World): void => { w.vault.unignored = ["00-inbox/capture/probe.md"]; },
    (w: World): void => { w.ingester.notReady = "Claude Code isn't logged in"; },
  ]) {
    const w = world();
    w.inbox.add("x");
    setup(w);
    assert.equal(await w.run(), EXIT.cantStart);
    assert.equal(await preflight(w.deps), 2);
    assert.deepEqual([w.ledger.records().length, w.inbox.statusWrites.length], [0, 0]);
  }
  const w = world();
  w.inbox.checkError = new SourceNoAccess("Could not find data source");
  await preflight(w.deps);
  assert.match(w.out.lines.join("\n"), /source inbox \(database db-1\)/);
  const ok = world();
  assert.equal(await preflight(ok.deps), 0);
});

test("REQ-029: Notion unreachable after the first item: exit 4, first kept, the rest untouched", async () => {
  const w = world();
  const rows = [w.inbox.add("One"), w.inbox.add("Two"), w.inbox.add("Three")];
  w.inbox.callsBeforeOutage = 3; // query, read one, set its status
  assert.equal(await w.run(), EXIT.abort);
  assert.deepEqual(rows.map((r) => r.status), ["Ingested", "New", "New"]);
  assert.deepEqual(items(w).map((r) => [r.id, r.outcome]), [[rows[0]?.id, "ingested"]]);
  assert.match(w.out.lines.join("\n"), /ECONNRESET/);
  assert.equal(w.ingester.closes, 1);
  assert.equal(w.ingester.locked, false);
});

test("REQ-030: while another run holds the lock, exit 3 and nothing changes", async () => {
  const w = world();
  w.inbox.add("x");
  await w.ingester.lock();
  assert.equal(await w.run(), EXIT.locked);
  assert.match(w.out.lines.join("\n"), /in progress/);
  assert.deepEqual([w.ledger.records().length, w.inbox.statusWrites.length, w.vault.captures.size], [0, 0, 0]);
});

test("REQ-033: a failure in the middle still processes the rest, then exits 1", async () => {
  const w = world();
  const rows = [w.inbox.add("One"), w.inbox.add("Two"), w.inbox.add("Three")];
  w.inbox.failingReads.add(rows[1]?.id ?? "");
  assert.equal(await w.run(), EXIT.itemFailed);
  assert.deepEqual(rows.map((r) => r.status), ["Ingested", "Failed", "Ingested"]);
});

test("REQ-034: nothing eligible and nothing to catch up: exit 0, no writes, the ingester never opened", async () => {
  const w = world();
  w.inbox.add("Done", { status: "Ingested" });
  assert.equal(await w.run(), EXIT.ok);
  assert.deepEqual([w.ledger.records().length, w.inbox.statusWrites.length, w.vault.daily.length, w.ingester.opens], [0, 0, 0, 0]);
});

test("an ingester check failure sets Failed and retries the capture next run; the third holds it", async () => {
  let n = 0;
  const w = world((c): IngestResult => (++n < 3 ? { kind: "failed", reason: "model output invalid" } : { kind: "failed", reason: "model output invalid", ask: `00-inbox/2026-10-12-ingest-${c}` }));
  const r = w.inbox.add("Tricky");
  assert.equal(await w.run(), EXIT.itemFailed);
  assert.deepEqual([r.status, r.reason], ["Failed", "model output invalid"]);
  assert.equal(await w.run(), EXIT.itemFailed);
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(w.ingester.processed.length, 3);
  assert.match(r.reason, /^held: the ingester's check failed three times; see ask/);
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(w.ingester.processed.length, 3);
});

test("an ingester abort stops the run with exit 4 and records nothing for that item", async () => {
  const w = world();
  w.inbox.add("One");
  w.inbox.add("Two");
  w.ingester.aborting.add("notion-one-row01.md");
  assert.equal(await w.run(), EXIT.abort);
  assert.deepEqual(items(w), []);
  assert.deepEqual(w.ledger.pending().map((p) => p.capture), ["notion-one-row01.md"]);
  w.ingester.aborting.clear();
  assert.equal(await w.run(), EXIT.ok);
  assert.deepEqual(w.ingester.processed, ["notion-one-row01.md", "notion-two-row02.md"]);
});

test("deferred ingests are settled when the session closes", async () => {
  const w = world(() => ({ kind: "deferred" }));
  const r = w.inbox.add("Link only");
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(r.status, "Failed");
  assert.match(r.reason, /^held: a linked page couldn't be fetched; see ask/);
});

test("REQ-023: a hint naming an existing area links it; REQ-043: pull time excludes ingestion", async () => {
  const w = world((c) => { w.clock.t += 60_000; return ingestAll(c, ""); });
  w.vault.targets.add("career");
  w.inbox.add("Interview prep", { capture: { title: "Interview prep", body: "Practise.", url: null, hint: "career", omitted: {} } });
  w.inbox.add("Other", { capture: { title: "Other", body: "x", url: null, hint: "health", omitted: {} } });
  let captured = "";
  const orig = w.vault.writeCapture.bind(w.vault);
  w.vault.writeCapture = (name, content): Promise<string> => { if (name.includes("interview")) captured = content; else assert.ok(!content.includes("[[")); return orig(name, content); };
  assert.equal(await w.run(), EXIT.ok);
  assert.ok(captured.includes("[[career]]"));
  const end = w.ledger.records().find((r) => r.event === "run-end");
  assert.ok(end?.event === "run-end" && end.pullMs < 60_000, JSON.stringify(end));
});

test("no new item starts after 40 minutes", async () => {
  const w = world((c) => { w.clock.t += START_CUTOFF_MS; return ingestAll(c, ""); });
  w.inbox.add("One");
  w.inbox.add("Two");
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(w.ingester.processed.length, 1);
});

test("a capture write failure is a pull failure, and the intent is safely re-pulled next run", async () => {
  const w = world();
  const r = w.inbox.add("Disk");
  w.vault.failingWrites.add("notion-disk-row01.md");
  assert.equal(await w.run(), EXIT.itemFailed);
  assert.equal(r.status, "Failed");
  w.vault.failingWrites.clear();
  assert.equal(await w.run(), EXIT.ok);
  assert.equal(r.status, "Ingested");
});

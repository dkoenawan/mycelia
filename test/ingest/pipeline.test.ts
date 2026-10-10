import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { listCapture } from "../../src/ingest/capture.ts";
import { processItem, RunAbort } from "../../src/ingest/run.ts";
import { AgentItemError, ProviderUnavailable } from "../../src/ingest/agent/provider.ts";
import { structured } from "../../src/ingest/agent/fake.ts";
import { sha256 } from "../../src/ingest/journal.ts";
import { tempVault } from "../helpers/vault.ts";
import { BOOTSTRAP_AREA, canaryOf, makeContext, noFit, placing } from "../helpers/pipeline.ts";

const POST = "Pasted text about designing agentic workflows. ".repeat(20);

function vault(extra: Record<string, string> = {}): ReturnType<typeof tempVault> {
  return tempVault({
    "20-areas/career.md": BOOTSTRAP_AREA("career", "Work and career"),
    "20-areas/health.md": BOOTSTRAP_AREA("health", "Health"),
    "20-areas/recreation.md": BOOTSTRAP_AREA("recreation", "Hobbies"),
    "10-projects/side-project.md": "---\nname: side-project\ndescription: A side project\n---\n\nNotes.\n",
    ...extra,
  });
}

async function only(root: string, name: string): Promise<Awaited<ReturnType<typeof listCapture>>[number]> {
  const it = (await listCapture(root)).find((i) => i.name === name);
  assert.ok(it, name);
  return it;
}

test("ingest: resource, back-links, archive, ledger (REQ-012–016, 021, 028)", async () => {
  const v = vault({ "00-inbox/capture/agentic-post.md": POST });
  try {
    const ctx = await makeContext(v.root, placing(["career", "side-project"]));
    const item = await only(v.root, "agentic-post.md");
    const careerBefore = readFileSync(path.join(v.root, "20-areas/career.md"), "utf8");
    const out = await processItem(ctx, item);
    assert.equal(out.kind, "ingested");
    const res = readFileSync(path.join(v.root, "30-resources/designing-agentic-workflows.md"), "utf8");
    assert.match(res, /^---\nname: designing-agentic-workflows\n/);
    assert.ok(res.includes("- [[career]]\n- [[side-project]]"));
    assert.ok(res.includes("- Original capture: [[agentic-post]]"));
    assert.equal(existsSync(path.join(v.root, "00-inbox/capture/agentic-post.md")), false);
    assert.equal(sha256(readFileSync(path.join(v.root, "40-archive/capture/agentic-post.md"))), item.sha);
    assert.equal(readFileSync(path.join(v.root, "20-areas/career.md"), "utf8"), careerBefore.replace("`[[resource-slug]]`:\n\n-\n", "`[[resource-slug]]`:\n\n-\n- [[designing-agentic-workflows]]\n"));
    assert.ok(readFileSync(path.join(v.root, "10-projects/side-project.md"), "utf8").endsWith("Notes.\n## Resources\n- [[designing-agentic-workflows]]\n"));
    const rec = ctx.ledger.itemRecords("agentic-post.md")[0];
    assert.deepEqual([rec?.outcome, rec?.resource, rec?.targets, rec?.archived], ["ingested", "30-resources/designing-agentic-workflows.md", ["20-areas/career.md", "10-projects/side-project.md"], "40-archive/capture/agentic-post.md"]);
    assert.equal(ctx.journal.read(), null);
  } finally { v.done(); }
});

test("REQ-022: an existing resource name gets -2; the existing note is untouched", async () => {
  const v = vault({ "00-inbox/capture/again.md": POST, "30-resources/designing-agentic-workflows.md": "existing\n" });
  try {
    const ctx = await makeContext(v.root, placing(["career"]));
    const out = await processItem(ctx, await only(v.root, "again.md"));
    assert.equal(out.kind === "ingested" ? out.resource : "", "30-resources/designing-agentic-workflows-2.md");
    assert.equal(readFileSync(path.join(v.root, "30-resources/designing-agentic-workflows.md"), "utf8"), "existing\n");
  } finally { v.done(); }
});

test("REQ-019: the item's own target links win over the agent's choice", async () => {
  const v = vault({ "00-inbox/capture/sourdough.md": `${POST}\n\n[[recreation]]\n` });
  try {
    const ctx = await makeContext(v.root, placing(["career"], "Sourdough starter basics"));
    const out = await processItem(ctx, await only(v.root, "sourdough.md"));
    assert.equal(out.kind, "ingested");
    assert.deepEqual(out.kind === "ingested" ? out.record.targets : [], ["20-areas/recreation.md"]);
    assert.ok(ctx.fake.requests[0]?.userPrompt.includes("Fixed targets"));
  } finally { v.done(); }
});

test("REQ-020/023: no fit holds with one ask; after an edit it's ingested and the ask is archived", async () => {
  const v = vault({ "00-inbox/capture/sourdough.md": POST });
  try {
    const ctx = await makeContext(v.root, noFit(["recreation"]));
    const item = await only(v.root, "sourdough.md");
    const held = await processItem(ctx, item);
    assert.equal(held.kind, "held");
    const ask = held.kind === "held" ? held.ask : "";
    assert.equal(ask, "00-inbox/2026-10-01-ingest-sourdough.md");
    assert.equal(sha256(readFileSync(path.join(v.root, "00-inbox/capture/sourdough.md"))), item.sha);
    const askText = readFileSync(path.join(v.root, ask));
    v.write("00-inbox/capture/sourdough.md", `${POST}\n[[recreation]]\n`);
    const ctx2 = await makeContext(v.root, placing(["recreation"], "Sourdough starter basics"));
    const out = await processItem(ctx2, await only(v.root, "sourdough.md"));
    assert.equal(out.kind, "ingested");
    assert.equal(existsSync(path.join(v.root, ask)), false);
    assert.deepEqual(readFileSync(path.join(v.root, "40-archive/capture/2026-10-01-ingest-sourdough.md")), askText);
  } finally { v.done(); }
});

test("REQ-024/025: a failed check rolls everything back and records the reason", async () => {
  const v = vault({ "00-inbox/capture/agentic-post.md": POST });
  try {
    const careerBefore = readFileSync(path.join(v.root, "20-areas/career.md"));
    const ctx = await makeContext(v.root, placing(["career"]));
    ctx.afterApply = () => { ctx.vault.remove("20-areas/career.md"); };
    const out = await processItem(ctx, await only(v.root, "agentic-post.md"));
    ctx.vault.add("20-areas/career.md");
    assert.equal(out.kind, "failed");
    assert.match(out.kind === "failed" ? out.record.reason ?? "" : "", /unresolved \[\[career\]\]/);
    assert.equal(out.kind === "failed" ? out.record.strike : false, true);
    assert.equal(existsSync(path.join(v.root, "30-resources/designing-agentic-workflows.md")), false);
    assert.deepEqual(readFileSync(path.join(v.root, "20-areas/career.md")), careerBefore);
    assert.equal(existsSync(path.join(v.root, "00-inbox/capture/agentic-post.md")), true);
    assert.equal(ctx.journal.read(), null);
  } finally { v.done(); }
});

test("D13: an item edited during the run is rolled back with no strike", async () => {
  const v = vault({ "00-inbox/capture/agentic-post.md": POST });
  try {
    const p = path.join(v.root, "00-inbox/capture/agentic-post.md");
    const ctx = await makeContext(v.root, (req, n) => { writeFileSync(p, `${POST} edited`); return placing(["career"])(req, n); });
    const out = await processItem(ctx, await only(v.root, "agentic-post.md"));
    assert.equal(out.kind === "failed" ? out.record.reason : "", "changed-during-run");
    assert.equal(out.kind === "failed" ? out.record.strike : true, undefined);
    assert.equal(readFileSync(p, "utf8"), `${POST} edited`);
  } finally { v.done(); }
});

test("REQ-026: the third consecutive counted failure raises one check-failed ask", async () => {
  const v = vault({ "00-inbox/capture/odd.md": POST });
  try {
    const ctx = await makeContext(v.root, (req) => structured({ canary: canaryOf(req), decision: "place", title: "x", description: "y", summary: "z", takeaways: ["t"], targets: ["nonexistent-area"] }));
    const item = await only(v.root, "odd.md");
    for (const run of ["2026-09-29T06:00:00Z", "2026-09-30T06:00:00Z"]) {
      await ctx.ledger.append({ event: "item", run, item: "odd.md", sha256: item.sha, outcome: "failed", reason: "earlier", strike: true });
    }
    const out = await processItem(ctx, item);
    assert.equal(out.kind, "failed");
    assert.equal(out.kind === "failed" ? out.ask : "", "00-inbox/2026-10-01-ingest-odd.md");
    const ask = readFileSync(path.join(v.root, "00-inbox/2026-10-01-ingest-odd.md"), "utf8");
    assert.match(ask, /ingest_reason: check-failed/);
    assert.match(ask, /nonexistent-area/);
    assert.deepEqual(ctx.ledger.itemRecords("odd.md").map((r) => r.outcome), ["failed", "failed", "failed", "held"]);
  } finally { v.done(); }
});

test("agent errors: AgentItemError is a counted failure; ProviderUnavailable stops the run", async () => {
  const v = vault({ "00-inbox/capture/a.md": POST });
  try {
    const ctx = await makeContext(v.root, () => { throw new AgentItemError("agent timed out after 300 s"); });
    const out = await processItem(ctx, await only(v.root, "a.md"));
    assert.equal(out.kind === "failed" ? out.record.strike : false, true);
    const ctx2 = await makeContext(v.root, () => { throw new ProviderUnavailable("limit: rate limit"); });
    await assert.rejects(processItem(ctx2, await only(v.root, "a.md")), ProviderUnavailable);
    assert.ok(RunAbort);
  } finally { v.done(); }
});

test("REQ-007/009 and D12: unsupported, HTTP-level and connection-level fetch failures", async () => {
  const s = http.createServer((_q, res) => { res.writeHead(404); res.end(); });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const port = String((s.address() as AddressInfo).port);
  const v = vault({
    "00-inbox/capture/slides.pdf": "%PDF",
    "00-inbox/capture/gone.md": `http://127.0.0.1:${port}/gone`,
    "00-inbox/capture/down.md": "http://127.0.0.1:1/x",
  });
  try {
    const ctx = await makeContext(v.root, placing(["career"]));
    const pdf = await processItem(ctx, await only(v.root, "slides.pdf"));
    assert.equal(pdf.kind === "held" ? pdf.record.reason : "", "unsupported");
    assert.match(readFileSync(path.join(v.root, "00-inbox/2026-10-01-ingest-slides.md"), "utf8"), /PDF captures aren't supported yet/);
    const gone = await processItem(ctx, await only(v.root, "gone.md"));
    assert.equal(gone.kind === "held" ? gone.record.reason : "", "fetch-failed");
    assert.match(readFileSync(path.join(v.root, "00-inbox/2026-10-01-ingest-gone.md"), "utf8"), /\/gone`: HTTP 404/);
    const down = await processItem(ctx, await only(v.root, "down.md"));
    assert.equal(down.kind, "network-deferred");
    assert.equal(ctx.fake.requests.length, 0, "no agent call for held items");
  } finally {
    v.done();
    await new Promise<void>((r) => { s.close(() => { r(); }); });
  }
});

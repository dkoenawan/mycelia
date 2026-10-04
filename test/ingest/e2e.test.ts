// End-to-end runs on temp-directory vaults with FakeProvider (T14 gate).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FakeProvider, structured, type FakeResponder } from "../../src/ingest/agent/fake.ts";
import { ProviderNotReady, ProviderUnavailable } from "../../src/ingest/agent/provider.ts";
import { MSG_NOT_LOGGED_IN } from "../../src/ingest/agent/claude-code.ts";
import { Journal } from "../../src/ingest/journal.ts";
import { Ledger } from "../../src/ingest/ledger.ts";
import { runIngest, EXIT, LEDGER_REL } from "../../src/ingest/run.ts";
import { REPO_ROOT } from "../../src/lib/paths.ts";
import { tempVault, type TempVault } from "../helpers/vault.ts";
import { BOOTSTRAP_AREA, canaryOf, noFit, placing } from "../helpers/pipeline.ts";

const POST = "Pasted text about designing agentic workflows and planning. ".repeat(15);
const NOW = new Date("2026-10-01T06:00:04Z");

function gitVault(files: Record<string, string>, opts: { gitignore?: boolean } = {}): TempVault & { git: (...a: string[]) => string } {
  const v = tempVault({
    "20-areas/README.md": "readme", "10-projects/README.md": "readme", "30-resources/README.md": "readme",
    "40-archive/README.md": "readme", "daily/README.md": "readme", "00-inbox/README.md": "readme",
    "20-areas/career.md": BOOTSTRAP_AREA("career", "Work and career"),
    "20-areas/health.md": BOOTSTRAP_AREA("health", "Health"),
    ...files,
  });
  const git = (...a: string[]): string => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: v.root, encoding: "utf8" });
  git("init", "-q");
  if (opts.gitignore !== false) copyFileSync(path.join(REPO_ROOT, ".gitignore"), path.join(v.root, ".gitignore"));
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
  return { ...v, git };
}

function provider(responder: FakeResponder): FakeProvider {
  return new FakeProvider(responder);
}

/** Place agentic captures under career, say no fit to anything about bread. */
const byItem: FakeResponder = (req, n) => (req.userPrompt.includes("sourdough") ? noFit(["health"])(req, n) : placing(["career"])(req, n));

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (rel: string): void => {
    for (const e of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.name === ".git") continue;
      if (e.isDirectory()) walk(r);
      else out[r] = readFileSync(path.join(root, r), "utf8");
    }
  };
  walk("");
  return out;
}

test("full run: ingest, hold, unsupported; daily summary; ledger; git untouched (REQ-001/002/029/034)", async () => {
  const v = gitVault({ "00-inbox/2026-10-01-renew-cert.md": "---\nname: renew\n---\ndecision\n", "00-inbox/notes/idea.md": "idea" });
  try {
    v.write("00-inbox/capture/agentic-post.md", POST);
    v.write("00-inbox/capture/sourdough.md", `${POST} sourdough bread`);
    v.write("00-inbox/capture/slides.pdf", "%PDF");
    const head = v.git("rev-parse", "HEAD");
    const decision = readFileSync(path.join(v.root, "00-inbox/2026-10-01-renew-cert.md"));
    const logs: string[] = [];
    const code = await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, log: (m) => logs.push(m), env: {} });
    assert.equal(code, EXIT.ok, logs.join("\n"));
    assert.equal(v.git("status", "--porcelain"), "");
    assert.equal(v.git("rev-parse", "HEAD"), head);
    assert.deepEqual(readFileSync(path.join(v.root, "00-inbox/2026-10-01-renew-cert.md")), decision);
    const daily = readFileSync(path.join(v.root, "daily/2026-10-01.md"), "utf8");
    assert.ok(daily.startsWith("---\nname: 2026-10-01\n"));
    assert.ok(daily.includes("## Inbox ingestion (06:00 UTC)\n\n- 1 ingested, 2 held, 0 failed\n- Resources: [[designing-agentic-workflows]]\n- Asks: "));
    assert.ok(daily.includes("[[2026-10-01-ingest-sourdough]]") && daily.includes("[[2026-10-01-ingest-slides]]"));
    const recs = Ledger.readAll(path.join(v.root, LEDGER_REL));
    assert.deepEqual(recs.map((r) => r.event), ["run-start", "item", "item", "item", "run-end"]);
    assert.equal(existsSync(path.join(v.root, ".state/ingest-inbox/lock")), false);
    // REQ-005: a second run holds both and raises nothing new; nothing eligible, so no daily change.
    const noLedger = (o: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== LEDGER_REL));
    const before = noLedger(snapshot(v.root));
    const code2 = await runIngest({ root: v.root, provider: provider(byItem), now: () => new Date("2026-10-02T06:00:00Z"), env: {} });
    assert.equal(code2, EXIT.ok);
    assert.deepEqual(noLedger(snapshot(v.root)), before);
  } finally { v.done(); }
});

test("REQ-031: one failing item among three gives a non-zero exit after the others", async () => {
  const v = gitVault({});
  try {
    for (const n of ["a", "b", "c"]) v.write(`00-inbox/capture/${n}.md`, `${POST} ${n}`);
    const responder: FakeResponder = (req, n) => (req.userPrompt.includes('"b.md"') ? structured({ canary: "wrong" }) : placing(["career"], `Title ${String(n)}`)(req, n));
    assert.equal(await runIngest({ root: v.root, provider: provider(responder), now: () => NOW, env: {} }), EXIT.itemFailed);
    const items = Ledger.readAll(path.join(v.root, LEDGER_REL)).filter((r) => r.event === "item");
    assert.deepEqual(items.map((r) => r.event === "item" ? [r.item, r.outcome] : []), [["a.md", "ingested"], ["b.md", "failed"], ["c.md", "ingested"]]);
  } finally { v.done(); }
});

test("REQ-030: nothing eligible exits 0 and writes no vault note", async () => {
  const v = gitVault({});
  try {
    const before = snapshot(v.root);
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, env: {} }), EXIT.ok);
    const after = Object.fromEntries(Object.entries(snapshot(v.root)).filter(([k]) => !k.startsWith(".state/")));
    assert.deepEqual(after, before);
  } finally { v.done(); }
});

test("REQ-032: can't start — capture folder missing, logged out, no targets — exit 2, nothing changed", async () => {
  const v = gitVault({});
  try {
    rmSync(path.join(v.root, "00-inbox/capture"), { recursive: true });
    const logs: string[] = [];
    const before = snapshot(v.root);
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, log: (m) => logs.push(m), env: {} }), EXIT.cantStart);
    assert.match(logs.join("\n"), /00-inbox\/capture\//);
    assert.deepEqual(snapshot(v.root), before);
    mkdirSync(path.join(v.root, "00-inbox/capture"));
    const loggedOut = provider(byItem);
    loggedOut.preflightError = new ProviderNotReady(MSG_NOT_LOGGED_IN);
    const logs2: string[] = [];
    assert.equal(await runIngest({ root: v.root, provider: loggedOut, now: () => NOW, log: (m) => logs2.push(m), env: {} }), EXIT.cantStart);
    assert.match(logs2.join("\n"), /\/login/);
    assert.equal(existsSync(path.join(v.root, ".state")), false);
    rmSync(path.join(v.root, "20-areas/career.md"));
    rmSync(path.join(v.root, "20-areas/health.md"));
    const logs3: string[] = [];
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, log: (m) => logs3.push(m), env: {} }), EXIT.cantStart);
    assert.match(logs3.join("\n"), /task bootstrap-areas/);
  } finally { v.done(); }
});

test("REQ-034: a .gitignore regression stops the run before any write", async () => {
  const v = gitVault({}, { gitignore: false });
  try {
    v.write("00-inbox/capture/a.md", POST);
    const logs: string[] = [];
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, log: (m) => logs.push(m), env: {} }), EXIT.cantStart);
    assert.match(logs.join("\n"), /aren't gitignored/);
    assert.equal(existsSync(path.join(v.root, ".state")), false);
  } finally { v.done(); }
});

test("REQ-033: a run in progress makes a second run exit 3 and change nothing", async () => {
  const v = gitVault({});
  try {
    v.write("00-inbox/capture/a.md", POST);
    mkdirSync(path.join(v.root, ".state/ingest-inbox"), { recursive: true });
    writeFileSync(path.join(v.root, ".state/ingest-inbox/lock"), JSON.stringify({ pid: process.pid, hostname: (await import("node:os")).hostname(), started: NOW.toISOString() }));
    const before = snapshot(v.root);
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, env: {} }), EXIT.locked);
    assert.deepEqual(snapshot(v.root), before);
  } finally { v.done(); }
});

test("D12: every thin item failing to connect is an outage — exit 4, no asks", async () => {
  const v = gitVault({});
  try {
    v.write("00-inbox/capture/one.md", "http://127.0.0.1:1/a");
    v.write("00-inbox/capture/two.md", "http://127.0.0.1:1/b");
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, env: { MYCELIA_INGEST_ALLOW_PRIVATE: "1" } }), EXIT.abort);
    assert.deepEqual(readdirSync(path.join(v.root, "00-inbox")).sort(), ["README.md", "capture"]);
    // A single connection failure is an ordinary fetch-failed ask.
    rmSync(path.join(v.root, "00-inbox/capture/two.md"));
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, env: { MYCELIA_INGEST_ALLOW_PRIVATE: "1" } }), EXIT.ok);
    assert.ok(existsSync(path.join(v.root, "00-inbox/2026-10-01-ingest-one.md")));
  } finally { v.done(); }
});

test("D12: a provider fault mid-run stops with exit 4 and no strike", async () => {
  const v = gitVault({});
  try {
    v.write("00-inbox/capture/a.md", POST);
    const p = provider(() => { throw new ProviderUnavailable("auth: authentication_failed"); });
    assert.equal(await runIngest({ root: v.root, provider: p, now: () => NOW, env: {} }), EXIT.abort);
    assert.equal(Ledger.readAll(path.join(v.root, LEDGER_REL)).filter((r) => r.event === "item").length, 0);
    assert.ok(existsSync(path.join(v.root, "00-inbox/capture/a.md")));
  } finally { v.done(); }
});

test("REQ-041: no new item starts after 40 minutes", async () => {
  const v = gitVault({});
  try {
    v.write("00-inbox/capture/a.md", `${POST} a`);
    v.write("00-inbox/capture/b.md", `${POST} b`);
    let t = NOW.getTime();
    const clock = (): Date => new Date(t);
    const responder: FakeResponder = (req, n) => { t += 41 * 60 * 1000; return placing(["career"], `T ${String(n)}`)(req, n); };
    assert.equal(await runIngest({ root: v.root, provider: provider(responder), now: clock, env: {} }), EXIT.ok);
    assert.equal(Ledger.readAll(path.join(v.root, LEDGER_REL)).filter((r) => r.event === "item").length, 1);
  } finally { v.done(); }
});

test("REQ-027: an interrupted item is rolled back and processed again; operator edits stop the run with one ask", async () => {
  const v = gitVault({});
  try {
    v.write("00-inbox/capture/agentic-post.md", POST);
    const stateDir = path.join(v.root, ".state/ingest-inbox");
    mkdirSync(stateDir, { recursive: true });
    const j = new Journal(v.root, stateDir);
    const txn = await j.begin({ run: "2026-09-30T06:00:00Z", item: "agentic-post.md", itemSha: "x" }, [{ op: "create", path: "30-resources/half.md", content: "half\n" }]);
    await j.apply(txn);
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, env: {} }), EXIT.ok);
    assert.equal(existsSync(path.join(v.root, "30-resources/half.md")), false);
    const outcomes = Ledger.readAll(path.join(v.root, LEDGER_REL)).flatMap((r) => (r.event === "item" ? [r.outcome] : []));
    assert.deepEqual(outcomes, ["recovered", "ingested"]);
    // Conflict: the half-written file was edited after the crash.
    v.write("00-inbox/capture/other.md", POST);
    const txn2 = await j.begin({ run: "2026-09-30T07:00:00Z", item: "other.md", itemSha: "y" }, [{ op: "create", path: "30-resources/half2.md", content: "half\n" }]);
    await j.apply(txn2);
    writeFileSync(path.join(v.root, "30-resources/half2.md"), "operator edit\n");
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => NOW, env: {} }), EXIT.abort);
    assert.equal(readFileSync(path.join(v.root, "30-resources/half2.md"), "utf8"), "operator edit\n");
    const ask = readFileSync(path.join(v.root, "00-inbox/2026-10-01-ingest-other.md"), "utf8");
    assert.match(ask, /interrupted mid-run/);
    assert.match(ask, /30-resources\/half2\.md/);
    // The next run stops again but doesn't raise a second ask.
    assert.equal(await runIngest({ root: v.root, provider: provider(byItem), now: () => new Date("2026-10-02T06:00:00Z"), env: {} }), EXIT.abort);
    assert.equal(readdirSync(path.join(v.root, "00-inbox")).filter((n) => n.includes("ingest-other")).length, 1);
  } finally { v.done(); }
});

test("injected material: denied reads and the injection flag reach the daily note", async () => {
  const v = gitVault({});
  try {
    v.write("00-inbox/capture/a.md", POST);
    const responder: FakeResponder = (req) => structured({
      canary: canaryOf(req), decision: "place", title: "Agentic workflows", description: "d", summary: "s", takeaways: ["t"], targets: ["career"], injection_suspected: true,
    }, { toolCalls: [{ tool: "Read", path: "control/estate.local.yaml", allowed: false }, { tool: "Read", path: "20-areas/career.md", allowed: true }] });
    assert.equal(await runIngest({ root: v.root, provider: provider(responder), now: () => NOW, env: {} }), EXIT.ok);
    const daily = readFileSync(path.join(v.root, "daily/2026-10-01.md"), "utf8");
    assert.ok(daily.includes("- Needs a look: [[agentic-workflows]] (blocked tool calls: 1; possible injection)"));
    const rec = Ledger.readAll(path.join(v.root, LEDGER_REL)).find((r) => r.event === "item");
    assert.deepEqual(rec?.event === "item" ? [rec.reads, rec.denied, rec.injectionSuspected] : [], [1, 1, true]);
  } finally { v.done(); }
});

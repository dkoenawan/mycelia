// DES-003: the use cases on in-memory ports (REQ-010 to REQ-015).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ESLint, Linter } from "eslint";
import { currentGoals, saveDraft, signOff, validateNote, type DraftBody } from "../../src/goals/application/use-cases.ts";
import { parse } from "../../src/goals/domain/parse.ts";
import { validate } from "../../src/goals/domain/validate.ts";
import { REPO_ROOT } from "../../src/lib/paths.ts";
import { FakeProbe, FixedClock, MapReader, MemoryVault, StaticAreas } from "./fakes.ts";
import { noteText } from "./fixtures.ts";

const DRAFT = "00-inbox/2027-goals.md";
const CURRENT = "01-vision/2027-goals.md";

const body: DraftBody = {
  mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", areas: ["health"], actions: ["Run four times a week"] }, { name: "Strength", areas: [], actions: [] }, { name: "Recovery", areas: ["career"], actions: [] }] }],
  secondaryGoals: [{ text: "Read 24 books", areas: [] }],
};

function deps(vault: MemoryVault, date = "2026-12-20", probe = new FakeProbe()) {
  return { vault, probe, clock: new FixedClock(date), areas: new StaticAreas(["health", "career"]) };
}

test("REQ-010: saveDraft writes exactly one draft for the year in the inbox root, status draft, valid", async () => {
  const vault = new MemoryVault();
  const r = await saveDraft(2027, body, deps(vault));
  assert.equal(r.ok, true);
  assert.deepEqual([...vault.files.keys()], [DRAFT]);
  const text = vault.files.get(DRAFT) ?? "";
  assert.equal(parse(text).status, "draft");
  assert.deepEqual(validate(text, null).filter((d) => d.severity === "error"), []);
  assert.deepEqual(parse(text).mainGoals, body.mainGoals);
});

test("REQ-011: saving after each step overwrites the draft, keeping created and the last step", async () => {
  const vault = new MemoryVault();
  await saveDraft(2027, { mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [] }], secondaryGoals: [] }, deps(vault, "2026-12-01"));
  const r = await saveDraft(2027, { mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", areas: [], actions: [] }, { name: "Strength", areas: [], actions: [] }] }], secondaryGoals: [] }, deps(vault, "2026-12-02"));
  assert.equal(r.ok, true);
  const text = vault.files.get(DRAFT) ?? "";
  assert.match(text, /created: 2026-12-01\nupdated: 2026-12-02/);
  assert.deepEqual(parse(text).mainGoals[0]?.pillars.map((p) => p.name), ["Endurance", "Strength"]);
});

test("saveDraft refuses an empty model, changing nothing", async () => {
  const vault = new MemoryVault();
  const r = await saveDraft(2027, { mainGoals: [], secondaryGoals: [] }, deps(vault));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.kind, "refused");
  assert.equal(vault.files.size, 0);
});

test("saveDraft refuses when the year's inbox file isn't a draft, changing nothing", async () => {
  const signed = noteText({ status: "signed-off", secondary: ["Read"] });
  const vault = new MemoryVault({ [DRAFT]: signed });
  const r = await saveDraft(2027, body, deps(vault));
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.message : "", /isn't a draft/);
  assert.equal(vault.files.get(DRAFT), signed);
  assert.deepEqual(vault.ops, []);
});

test("saveDraft reports area warnings but still saves", async () => {
  const r = await saveDraft(2027, { mainGoals: [], secondaryGoals: [{ text: "Sail", areas: ["sailing"] }] }, deps(new MemoryVault()));
  assert.equal(r.ok, true);
  assert.match(r.ok ? (r.diagnostics[0]?.message ?? "") : "", /"sailing"/);
});

test("REQ-012: with a draft in the inbox and nothing in 01-vision/, currentGoals returns no goals", async () => {
  const vault = new MemoryVault({ [DRAFT]: noteText({ secondary: ["Read"] }) });
  const r = await currentGoals(2027, { vault });
  assert.deepEqual(r, { none: true, reason: "no signed-off year-goals note exists for 2027 in 01-vision/" });
});

test("REQ-012: a note in 01-vision/ that isn't signed off isn't current goals", async () => {
  const r = await currentGoals(2027, { vault: new MemoryVault({ [CURRENT]: noteText({ status: "draft", secondary: ["Read"] }) }) });
  assert.equal(r.none, true);
  assert.match(r.none ? r.reason : "", /isn't signed off/);
});

test("REQ-013: signing off with no current goals moves the draft to 01-vision/, signed off today", async () => {
  const vault = new MemoryVault();
  await saveDraft(2027, body, deps(vault, "2026-12-14"));
  const r = await signOff(2027, deps(vault, "2026-12-20"));
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.archived, null);
  assert.deepEqual([...vault.files.keys()], [CURRENT]);
  const cur = await currentGoals(2027, { vault });
  assert.equal(cur.none, false);
  if (!cur.none) {
    assert.equal(cur.goals.status, "signed-off");
    assert.equal(cur.goals.signedOff, "2026-12-20");
    assert.deepEqual(cur.goals.mainGoals, body.mainGoals);
  }
  assert.match(vault.files.get(CURRENT) ?? "", /updated: 2026-12-20/);
});

test("REQ-014: re-signing off replaces the goals, carries the earlier changes plus one dated entry, and archives the earlier note unchanged", async () => {
  const earlier = noteText({ status: "signed-off", signedOff: "2026-12-20", main: [{ centre: "Old goal", pillars: [{ name: "P", actions: 1 }] }], changes: ["2027-02-01: dropped a pillar"] });
  const draft = noteText({ status: "draft", main: [{ centre: "New goal", pillars: [{ name: "Q", actions: 2 }] }] });
  const vault = new MemoryVault({ [CURRENT]: earlier, [DRAFT]: draft });
  const r = await signOff(2027, deps(vault, "2027-04-02"));
  assert.equal(r.ok, true);
  const archive = "40-archive/vision/2027-goals-replaced-2027-04-02.md";
  assert.equal(r.ok && r.archived, archive);
  assert.equal(vault.files.get(archive), earlier);
  assert.deepEqual([...vault.files.keys()].sort(), [CURRENT, archive]);
  const cur = await currentGoals(2027, { vault });
  assert.equal(cur.none, false);
  if (!cur.none) {
    assert.deepEqual(cur.goals.mainGoals.map((g) => g.centre), ["New goal"]);
    assert.deepEqual(cur.goals.changes.map((c) => c.date), ["2027-02-01", "2027-04-02"]);
    assert.equal(cur.goals.changes[0]?.text, "dropped a pillar");
    assert.match(cur.goals.changes[1]?.text ?? "", /re-signed off.*2026-12-20/);
  }
});

test("DES-003: sign-off writes the temp file, then the archive copy, then the rename, then removes the draft", async () => {
  const vault = new MemoryVault({ [CURRENT]: noteText({ status: "signed-off", secondary: ["Old"] }), [DRAFT]: noteText({ secondary: ["New"] }) });
  await signOff(2027, deps(vault, "2027-04-02"));
  assert.deepEqual(vault.ops, [
    "writeCurrentTemp 01-vision/2027-goals.md.tmp",
    "archiveCurrent 40-archive/vision/2027-goals-replaced-2027-04-02.md",
    "commitCurrent 01-vision/2027-goals.md",
    "removeDraft 00-inbox/2027-goals.md",
  ]);
});

test("DES-003: the first sign-off writes no archive copy", async () => {
  const vault = new MemoryVault({ [DRAFT]: noteText({ secondary: ["New"] }) });
  await signOff(2027, deps(vault));
  assert.deepEqual(vault.ops, ["writeCurrentTemp 01-vision/2027-goals.md.tmp", "commitCurrent 01-vision/2027-goals.md", "removeDraft 00-inbox/2027-goals.md"]);
});

test("REQ-013: sign-off refuses a draft with errors and changes nothing", async () => {
  const bad = noteText({ year: "27", secondary: ["Read"] });
  const vault = new MemoryVault({ [DRAFT]: bad });
  const r = await signOff(2027, deps(vault));
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.diagnostics.some((d) => d.severity === "error"));
  assert.deepEqual(vault.ops, []);
  assert.equal(vault.files.get(DRAFT), bad);
});

test("sign-off refuses with no draft, a signed-off inbox file, or a different year", async () => {
  assert.match(await signOff(2027, deps(new MemoryVault())).then((r) => (r.ok ? "" : r.message)), /no draft for 2027/);
  assert.match(await signOff(2027, deps(new MemoryVault({ [DRAFT]: noteText({ status: "signed-off", secondary: ["R"] }) }))).then((r) => (r.ok ? "" : r.message)), /isn't a draft/);
  assert.match(await signOff(2027, deps(new MemoryVault({ [DRAFT]: noteText({ year: "2028", secondary: ["R"] }) }))).then((r) => (r.ok ? "" : r.message)), /for year 2028/);
});

test("REQ-015: sign-off and save probe every write path first, and write nothing if one isn't ignored", async () => {
  const probe = new FakeProbe([CURRENT]);
  const vault = new MemoryVault({ [DRAFT]: noteText({ secondary: ["New"] }) });
  const r = await signOff(2027, deps(vault, "2026-12-20", probe));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.kind, "cant-start");
  assert.deepEqual(vault.ops, []);
  assert.ok(probe.probed[0]?.includes("40-archive/vision/2027-goals-replaced-2026-12-20.md"));
  const s = await saveDraft(2027, body, deps(vault, "2026-12-20", new FakeProbe([DRAFT])));
  assert.equal(!s.ok && s.kind, "cant-start");
  assert.deepEqual(vault.ops, []);
});

test("REQ-015: the vault port's write paths never include 20-areas/", () => {
  assert.ok(new MemoryVault().writePaths(2027, "2026-12-20").every((p) => !p.startsWith("20-areas/")));
});

test("validateNote returns diagnostics and the parse, or unreadable", async () => {
  const reader = new MapReader({ "a.md": noteText({ secondary: ["Read Areas: [[sailing]]"] }) });
  const r = await validateNote("a.md", { reader, areas: new StaticAreas(["health"]) });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.diagnostics.length, 1);
  assert.equal(r.ok && r.goals.secondaryGoals.length, 1);
  const missing = await validateNote("b.md", { reader });
  assert.equal(!missing.ok && missing.kind, "unreadable");
});

/** Lint `code` as if it were `file`, with only the layer rule that the repo config applies to `file`. */
async function layerRuleMessages(file: string, code: string): Promise<string[]> {
  const cfg = (await new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile(path.join(REPO_ROOT, file))) as { rules?: Record<string, unknown> };
  const rule = cfg.rules?.["no-restricted-imports"];
  assert.ok(rule, `no layer rule applies to ${file}`);
  const linter = new Linter({ configType: "flat" });
  return linter
    .verify(code, [{ files: ["**/*.ts"], languageOptions: { sourceType: "module" }, rules: { "no-restricted-imports": rule as Linter.RuleEntry } }], { filename: file })
    .map((m) => m.message);
}

test("DES-003: ESLint fails if application/ imports adapters/", async () => {
  const msgs = await layerRuleMessages("src/goals/application/use-cases.ts", 'import { FsVisionVault } from "../adapters/vault.ts";\nexport const v = FsVisionVault;\n');
  assert.ok(msgs.some((m) => /application\/ may not import adapters\//.test(m)), msgs.join("; "));
  assert.deepEqual(await layerRuleMessages("src/goals/application/use-cases.ts", 'import { parse } from "../domain/parse.ts";\nexport const p = parse;\n'), []);
});

test("DES-001: ESLint fails if domain/ does I/O or reaches outside src/goals/", async () => {
  const file = "src/goals/domain/parse.ts";
  assert.ok((await layerRuleMessages(file, 'import { readFileSync } from "node:fs";\nexport const r = readFileSync;\n')).some((m) => /domain\/ is pure/.test(m)));
  assert.ok((await layerRuleMessages(file, 'import { REPO_ROOT } from "../../lib/paths.ts";\nexport const r = REPO_ROOT;\n')).some((m) => /outside src\/goals\//.test(m)));
  assert.ok((await layerRuleMessages(file, 'import { signOff } from "../application/use-cases.ts";\nexport const s = signOff;\n')).some((m) => /domain\/ may not import/.test(m)));
});

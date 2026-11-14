// DES-009: the format reference, template and example (REQ-001, REQ-006).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../src/lib/paths.ts";
import { parse } from "../../src/goals/domain/parse.ts";
import { validate } from "../../src/goals/domain/validate.ts";
import { EXAMPLE, defaultAreas } from "./fixtures.ts";

const DOCS = path.join(REPO_ROOT, "docs", "reference", "year-goals");
const TEMPLATE = readFileSync(path.join(DOCS, "template.md"), "utf8");
const FORMAT = readFileSync(path.join(DOCS, "format.md"), "utf8");

test("REQ-001: the example passes with 0 errors and 0 warnings against the default areas", () => {
  assert.deepEqual(validate(EXAMPLE, defaultAreas()), []);
});

test("REQ-001: the example has 2 main goals (8 and 3 pillars, one pillar with 8 actions), 2 secondary goals, 1 change", () => {
  const m = parse(EXAMPLE);
  assert.deepEqual(m.mainGoals.map((g) => g.pillars.length), [8, 3]);
  assert.ok(m.mainGoals.flatMap((g) => g.pillars).some((p) => p.actions.length === 8));
  assert.equal(m.secondaryGoals.length, 2);
  assert.equal(m.changes.length, 1);
});

test("REQ-006: the parser reads the example's year, status, sign-off date, goals in order, areas and changes", () => {
  const m = parse(EXAMPLE);
  assert.equal(m.year, 2027);
  assert.equal(m.status, "signed-off");
  assert.equal(m.signedOff, "2026-12-20");
  assert.deepEqual(m.mainGoals.map((g) => g.centre), ["Run a marathon under 3:30", "Ship a side project"]);
  assert.deepEqual(m.mainGoals[0]?.pillars.map((p) => p.actions.length), [8, 3, 2, 2, 2, 1, 1, 2]);
  assert.deepEqual(m.mainGoals[1]?.pillars.map((p) => [p.name, p.actions.length, p.areas]), [
    ["Build", 2, ["career"]],
    ["Launch", 1, ["career"]],
    ["Learn", 1, ["personal-growth", "career"]],
  ]);
  assert.deepEqual(m.mainGoals[0]?.pillars[2]?.areas, ["health", "recreation"]);
  assert.deepEqual(m.secondaryGoals, [
    { text: "Read 24 books", areas: ["personal-growth"] },
    { text: "Learn conversational Spanish", areas: [] },
  ]);
  assert.deepEqual(m.changes.map((c) => c.date), ["2027-02-01"]);
});

test("REQ-001: the example uses only default area slugs", () => {
  const m = parse(EXAMPLE);
  const used = [...m.mainGoals.flatMap((g) => g.pillars.flatMap((p) => p.areas)), ...m.secondaryGoals.flatMap((s) => s.areas)];
  const defaults = defaultAreas();
  assert.ok(used.length > 0);
  assert.deepEqual(used.filter((a) => !defaults.has(a)), []);
});

test("REQ-001: the template is a valid note with 0 errors", () => {
  assert.deepEqual(validate(TEMPLATE, null).filter((d) => d.severity === "error"), []);
  assert.equal(parse(TEMPLATE).status, "draft");
});

test("REQ-001: format.md documents every element of REQ-002, REQ-004, REQ-007 and REQ-020", () => {
  for (const s of [
    "## Main goal:", "### Pillar:", "centre goal", "Up to 8 per main goal", "Up to 8 per pillar", "Action",
    "## Secondary goals", "Areas: [[", "## Changes", "YYYY-MM-DD", "oldest first",
    "Extra content", "quarterly", "sub-goals",
    "`year`", "`status`", "`signed_off`", "`type`", "`vision`",
  ]) {
    assert.ok(FORMAT.includes(s), `format.md should mention ${s}`);
  }
});

test("REQ-001: format.md documents each command with its exit codes, and the file locations", () => {
  for (const s of ["goals validate <path>", "goals session <year>", "goals save-draft <year>", "goals sign-off <year>", "00-inbox/<year>-goals.md", "01-vision/<year>-goals.md", "40-archive/vision/<year>-goals-replaced-<date>.md"]) {
    assert.ok(FORMAT.includes(s), `format.md should mention ${s}`);
  }
  assert.doesNotMatch(FORMAT, /task goals:/);
});

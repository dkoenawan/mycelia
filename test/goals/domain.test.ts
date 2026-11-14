// DES-001: model, parser and validator. One named test per REQ-018 item and per
// acceptance case of REQ-002 to REQ-007 and REQ-019 to REQ-021.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "../../src/goals/domain/parse.ts";
import { hasErrors, validate } from "../../src/goals/domain/validate.ts";
import type { Diagnostic } from "../../src/goals/domain/model.ts";
import { FULL_CHART, REQ002, noteText } from "./fixtures.ts";

const errors = (d: Diagnostic[]): Diagnostic[] => d.filter((x) => x.severity === "error");
const warnings = (d: Diagnostic[]): Diagnostic[] => d.filter((x) => x.severity === "warning");

test("REQ-002: several main goals, a full and an empty pillar, are accepted with no error", () => {
  const d = validate(REQ002, null);
  assert.deepEqual(errors(d), []);
  const m = parse(REQ002);
  assert.equal(m.mainGoals.length, 2);
  assert.deepEqual(m.mainGoals.map((g) => g.centre), ["Run a marathon under 3:30", "Ship a side project"]);
  assert.deepEqual(m.mainGoals[0]?.pillars.map((p) => [p.name, p.actions.length]), [["Endurance", 5], ["Strength", 8], ["Recovery", 0]]);
  assert.deepEqual(m.mainGoals[1]?.pillars.map((p) => [p.name, p.actions.length]), [["Build", 2], ["Launch", 1]]);
});

test("REQ-018: a full 8 x 8 chart is accepted with no error and no warning", () => {
  assert.deepEqual(validate(FULL_CHART, null), []);
  const m = parse(FULL_CHART);
  assert.equal(m.mainGoals[0]?.pillars.length, 8);
  assert.ok(m.mainGoals[0]?.pillars.every((p) => p.actions.length === 8));
});

test("REQ-018: a partly filled chart (centre goal and 2 pillars, no actions) is accepted", () => {
  const text = noteText({ main: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance" }, { name: "Strength" }] }] });
  assert.deepEqual(errors(validate(text, null)), []);
  assert.deepEqual(parse(text).mainGoals[0]?.pillars.map((p) => p.actions.length), [0, 0]);
});

test("REQ-003: invalid year and an empty action are two errors, each named with where it is", () => {
  const text = noteText({ year: "27", main: [{ centre: "Get strong", pillars: [{ name: "Strength", actions: ["Squat", ""] }] }] });
  const e = errors(validate(text, null));
  assert.equal(e.length, 2);
  assert.match(e[0]?.message ?? "", /invalid year "27"/);
  assert.equal(e[0]?.where, "frontmatter: year");
  assert.match(e[1]?.message ?? "", /action 2 under pillar "Strength" has empty text/);
  assert.match(e[1]?.where ?? "", /^line \d+ \(main goal "Get strong" > pillar "Strength"\)$/);
});

test("REQ-003: a missing year is an error", () => {
  const text = noteText({ frontmatter: "name: 2027-goals\ntype: vision\nstatus: draft", secondary: ["Read 24 books"] });
  assert.match(errors(validate(text, null))[0]?.message ?? "", /missing year/);
});

test("REQ-003: a status other than draft or signed-off is an error", () => {
  const e = errors(validate(noteText({ status: "final", secondary: ["Read 24 books"] }), null));
  assert.equal(e.length, 1);
  assert.match(e[0]?.message ?? "", /invalid status "final"/);
});

test("REQ-003: a missing status is an error", () => {
  const e = errors(validate(noteText({ frontmatter: "name: 2027-goals\ntype: vision\nyear: 2027", secondary: ["Read 24 books"] }), null));
  assert.equal(e.length, 1);
  assert.match(e[0]?.message ?? "", /missing status/);
  assert.equal(e[0]?.where, "frontmatter: status");
});

test("REQ-003: a note with no goal at all is an error", () => {
  const e = errors(validate(noteText({}), null));
  assert.equal(e.length, 1);
  assert.match(e[0]?.message ?? "", /no goal at all/);
});

test("REQ-003: empty main goal, pillar and secondary goal texts are errors", () => {
  const text = noteText({ main: [{ centre: "", pillars: [{ name: "", actions: 1 }] }], secondary: [""] });
  const e = errors(validate(text, null)).map((x) => x.message);
  assert.equal(e.length, 3);
  assert.match(e[0] ?? "", /main goal with empty text/);
  assert.match(e[1] ?? "", /pillar with empty text/);
  assert.match(e[2] ?? "", /secondary goal with empty text/);
});

test("REQ-003: missing or unparseable frontmatter is an error", () => {
  const missing = errors(validate(noteText({ frontmatter: null, secondary: ["Read"] }), null));
  assert.equal(missing.length, 1);
  assert.match(missing[0]?.message ?? "", /missing frontmatter/);
  const broken = errors(validate(noteText({ frontmatter: "year: [2027", secondary: ["Read"] }), null));
  assert.equal(broken.length, 1);
  assert.match(broken[0]?.message ?? "", /unparseable frontmatter/);
});

test("REQ-004: secondary goals parse with their areas touched", () => {
  const text = noteText({
    main: [{ centre: "Ship a side project", pillars: [{ name: "Build", actions: 1 }] }],
    secondary: ["Read 24 books Areas: [[reading]]", "Learn conversational Spanish"],
  });
  assert.deepEqual(errors(validate(text, null)), []);
  assert.deepEqual(parse(text).secondaryGoals, [
    { text: "Read 24 books", areas: ["reading"] },
    { text: "Learn conversational Spanish", areas: [] },
  ]);
});

test("REQ-005: an area with no 20-areas/ note is one warning naming the pillar and the area", () => {
  const text = noteText({ main: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Recovery", areas: ["health", "sailing"], actions: 1 }] }] });
  const d = validate(text, new Set(["health"]));
  assert.deepEqual(errors(d), []);
  const w = warnings(d);
  assert.equal(w.length, 1);
  assert.match(w[0]?.message ?? "", /pillar "Recovery" names area "sailing"/);
});

test("REQ-005: a secondary goal's unknown area is a warning naming the goal", () => {
  const w = warnings(validate(noteText({ secondary: ["Read 24 books Areas: [[reading]]"] }), new Set(["health"])));
  assert.equal(w.length, 1);
  assert.match(w[0]?.message ?? "", /secondary goal "Read 24 books" names area "reading"/);
});

test("REQ-006: the parser returns year, status, sign-off date, goals in order and changes", () => {
  const text = noteText({
    status: "signed-off",
    signedOff: "2026-12-20",
    main: [
      { centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", areas: ["health"], actions: 3 }] },
      { centre: "Ship a side project", pillars: [{ name: "Build", areas: ["career", "personal-growth"], actions: 2 }] },
    ],
    secondary: ["Read 24 books Areas: [[personal-growth]]"],
    changes: ["2027-01-15: renamed a pillar"],
  });
  const m = parse(text);
  assert.equal(m.year, 2027);
  assert.equal(m.status, "signed-off");
  assert.equal(m.signedOff, "2026-12-20");
  assert.deepEqual(m.mainGoals[1], { centre: "Ship a side project", pillars: [{ name: "Build", areas: ["career", "personal-growth"], actions: ["Action 1", "Action 2"] }] });
  assert.deepEqual(m.changes, [{ date: "2027-01-15", text: "renamed a pillar" }]);
});

test("REQ-007: changes entries parse oldest first", () => {
  const text = noteText({
    status: "signed-off",
    secondary: ["Learn conversational Spanish"],
    changes: ["2027-06-01: main goal 'Run a marathon under 3:30' achieved early", "2027-03-10: abandoned secondary goal 'Learn conversational Spanish'"],
  });
  assert.deepEqual(errors(validate(text, null)), []);
  assert.deepEqual(parse(text).changes.map((c) => c.date), ["2027-03-10", "2027-06-01"]);
  assert.equal(parse(text).changes[1]?.text, "main goal 'Run a marathon under 3:30' achieved early");
});

test("REQ-007: a changes entry with an invalid date is an error naming the entry", () => {
  const text = noteText({ secondary: ["Read"], changes: ["2027-06-01: a", "2027-03-10: b", "2027-13-01: c"] });
  const e = errors(validate(text, null));
  assert.equal(e.length, 1);
  assert.match(e[0]?.message ?? "", /"2027-13-01" is not a valid YYYY-MM-DD date/);
  assert.match(e[0]?.where ?? "", /changes entry "2027-13-01: c"/);
});

test("REQ-007: a changes entry with no date, or no description, is an error", () => {
  const e = errors(validate(noteText({ secondary: ["Read"], changes: ["sometime: x", "no date at all", "2027-01-01:"] }), null));
  assert.equal(e.length, 3);
  assert.match(e[0]?.message ?? "", /"sometime" is not a valid/);
  assert.match(e[1]?.message ?? "", /has no date/);
  assert.match(e[2]?.message ?? "", /no description/);
});

test("REQ-019: 4 main goals is exactly one warning suggesting pillars, sub-goals or secondary goals", () => {
  const main = ["A", "B", "C", "D"].map((c) => ({ centre: `Goal ${c}`, pillars: [{ name: "P", actions: 1 }] }));
  const d = validate(noteText({ main }), null);
  assert.deepEqual(errors(d), []);
  const w = warnings(d);
  assert.equal(w.length, 1);
  assert.equal(w[0]?.severity, "warning");
  assert.match(w[0]?.message ?? "", /4 main goals is above the recommended 3/);
  assert.match(w[0]?.message ?? "", /pillars, sub-goals or secondary goals/);
  assert.equal(hasErrors(d), false);
});

test("REQ-019: 3 main goals gives no warning", () => {
  const main = ["A", "B", "C"].map((c) => ({ centre: `Goal ${c}`, pillars: [{ name: "P", actions: 1 }] }));
  assert.deepEqual(validate(noteText({ main }), null), []);
});

test("REQ-020: unrecognised content (a quarterly breakdown) is left alone, with no error and the same goals", () => {
  const plain = noteText({ main: [{ centre: "Ship a side project", pillars: [{ name: "Build", actions: 2 }, { name: "Launch", actions: 1 }] }] });
  const extra = [
    "### Quarterly breakdown",
    "",
    "- Q1: prototype, Q2: beta",
    "  - nested detail",
    "",
    "```",
    "## Main goal: not a goal, it's in a code block",
    "```",
  ].join("\n");
  const withBreakdown = noteText({ main: [{ centre: "Ship a side project", extra, pillars: [{ name: "Build", actions: 2 }, { name: "Launch", actions: 1 }] }] });
  const noisy = withBreakdown.replace("- Action 1\n", "- Action 1\n  - a nested sub-goal\nSome paragraph.\n") + "\n## Notes\n\n- not a goal\n";
  assert.deepEqual(errors(validate(noisy, null)), []);
  assert.deepEqual(parse(noisy).mainGoals, parse(plain).mainGoals);
  assert.deepEqual(parse(noisy).secondaryGoals, []);
});

test("REQ-021: 9 pillars and no pillars are two warnings naming each goal", () => {
  const text = noteText({
    main: [
      { centre: "Run a marathon under 3:30", pillars: Array.from({ length: 9 }, (_, i) => ({ name: `P${i + 1}`, actions: 1 })) },
      { centre: "Write more" },
    ],
  });
  const d = validate(text, null);
  assert.deepEqual(errors(d), []);
  assert.deepEqual(warnings(d).map((w) => w.message), [
    "\"Run a marathon under 3:30\": 9 pillars, above the chart's 8",
    "\"Write more\": no pillars, consider making it a secondary goal",
  ]);
});

test("REQ-021: a pillar with 9 actions is a warning naming the pillar", () => {
  const w = warnings(validate(noteText({ main: [{ centre: "Get strong", pillars: [{ name: "Strength", actions: 9 }] }] }), null));
  assert.equal(w.length, 1);
  assert.match(w[0]?.message ?? "", /pillar "Strength": 9 actions, above the chart's 8/);
});

test("parse: wikilinks with aliases or headings give the bare slug", () => {
  const text = noteText({ secondary: ["Run Areas: [[health|Health]], [[career#Now]], [[health]]"] });
  assert.deepEqual(parse(text).secondaryGoals[0]?.areas, ["health", "career"]);
});

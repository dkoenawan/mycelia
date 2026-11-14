// DES-002: the renderer and the text-preserving sign-off edits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applySignOff, mergeChanges, setFrontmatterKeys } from "../../src/goals/domain/edit.ts";
import type { YearGoals } from "../../src/goals/domain/model.ts";
import { parse } from "../../src/goals/domain/parse.ts";
import { renderDraft } from "../../src/goals/domain/render.ts";
import { validate } from "../../src/goals/domain/validate.ts";
import { EXAMPLE, noteText } from "./fixtures.ts";

const DATES = { created: "2026-12-01", updated: "2026-12-02" };
const documented = (m: YearGoals): Omit<YearGoals, "status" | "signedOff"> => ({
  year: m.year, mainGoals: m.mainGoals, secondaryGoals: m.secondaryGoals, changes: m.changes,
});

test("DES-002: round trip, parse(renderDraft(parse(example))) equals parse(example) on the documented elements", () => {
  const once = parse(EXAMPLE);
  const again = parse(renderDraft(once, DATES));
  assert.deepEqual(documented(again), documented(once));
});

test("REQ-010: renderDraft writes a draft the validator accepts, with the vault frontmatter", () => {
  const text = renderDraft(parse(EXAMPLE), DATES);
  assert.deepEqual(validate(text, null).filter((d) => d.severity === "error"), []);
  assert.match(text, /^---\nname: 2027-goals\ndescription: .+\ntype: vision\nyear: 2027\nstatus: draft\ncreated: 2026-12-01\nupdated: 2026-12-02\n---\n/);
  assert.equal(parse(text).status, "draft");
  assert.doesNotMatch(text, /signed_off/);
});

test("REQ-011: a partial model (one centre goal, 2 pillars, no actions) renders as a valid draft", () => {
  const model: YearGoals = {
    year: 2027, status: null, signedOff: null, secondaryGoals: [], changes: [],
    mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", areas: [], actions: [] }, { name: "Strength", areas: ["health"], actions: [] }] }],
  };
  const text = renderDraft(model, DATES);
  assert.deepEqual(validate(text, null).filter((d) => d.severity === "error"), []);
  assert.deepEqual(parse(text).mainGoals, model.mainGoals);
  assert.doesNotMatch(text, /## Secondary goals|## Changes/);
});

test("renderDraft keeps each text on one line", () => {
  const model: YearGoals = {
    year: 2027, status: null, signedOff: null, changes: [],
    mainGoals: [{ centre: "Run\na marathon", pillars: [{ name: "Endu\r\nrance", areas: [], actions: ["Run\n\nfour times"] }] }],
    secondaryGoals: [{ text: "Read\n24 books", areas: ["personal-growth"] }],
  };
  const m = parse(renderDraft(model, DATES));
  assert.equal(m.mainGoals[0]?.centre, "Run a marathon");
  assert.equal(m.mainGoals[0]?.pillars[0]?.name, "Endu rance");
  assert.deepEqual(m.mainGoals[0]?.pillars[0]?.actions, ["Run four times"]);
  assert.deepEqual(m.secondaryGoals, [{ text: "Read 24 books", areas: ["personal-growth"] }]);
});

const BREAKDOWN = ["Quarterly breakdown, kept as written:", "", "- Q1: prototype", "  - pick the stack", "- Q2: beta", "", "### Notes", "", "- not an action"].join("\n");
const WITH_EXTRA = noteText({
  main: [{ centre: "Ship a side project", extra: BREAKDOWN, pillars: [{ name: "Build", actions: 2 }] }],
  secondary: ["Read 24 books"],
}) + "\n## Retro notes\n\nFree text the format doesn't define.\n";

test("DES-002: a sign-off edit on a note with a quarterly breakdown keeps the breakdown byte for byte", () => {
  const out = applySignOff(WITH_EXTRA, "2026-12-20", [{ date: "2026-12-20", text: "signed off" }]);
  assert.ok(out.includes(BREAKDOWN));
  assert.ok(out.includes("\n## Retro notes\n\nFree text the format doesn't define.\n"));
  // Every original body line is still there, in order; only frontmatter keys and the new section were added.
  const body = (s: string): string => s.slice(s.indexOf("\n---\n") + 5);
  assert.ok(body(out).startsWith(body(WITH_EXTRA)));
  assert.equal(body(out).slice(body(WITH_EXTRA).length), "\n## Changes\n\n- 2026-12-20: signed off\n");
  const m = parse(out);
  assert.equal(m.status, "signed-off");
  assert.equal(m.signedOff, "2026-12-20");
  assert.deepEqual(m.mainGoals, parse(WITH_EXTRA).mainGoals);
});

test("setFrontmatterKeys replaces keys in place and appends missing ones before the closing fence", () => {
  const text = "---\nname: x\nstatus: draft\ntags:\n  - a\n  - b\nupdated: 2026-01-01\n---\n\nbody\n";
  const out = setFrontmatterKeys(text, [["status", "signed-off"], ["tags", "none"], ["signed_off", "2026-12-20"], ["updated", "2026-12-20"]]);
  assert.equal(out, "---\nname: x\nstatus: signed-off\ntags: none\nupdated: 2026-12-20\nsigned_off: 2026-12-20\n---\n\nbody\n");
});

test("setFrontmatterKeys keeps CRLF line endings", () => {
  const text = "---\r\nstatus: draft\r\n---\r\n\r\n## Secondary goals\r\n\r\n- Read\r\n";
  assert.equal(setFrontmatterKeys(text, [["status", "signed-off"]]), "---\r\nstatus: signed-off\r\n---\r\n\r\n## Secondary goals\r\n\r\n- Read\r\n");
});

test("mergeChanges appends after the last entry and deduplicates identical entries", () => {
  const text = noteText({ secondary: ["Read"], changes: ["2027-03-10: b", "2027-01-01: a"] }) + "\n## After\n\ntext\n";
  const out = mergeChanges(text, [{ date: "2027-01-01", text: "a" }, { date: "2027-04-02", text: "c" }, { date: "2027-04-02", text: "c" }]);
  assert.ok(out.includes("- 2027-03-10: b\n- 2027-01-01: a\n- 2027-04-02: c\n\n## After\n\ntext\n"));
  assert.deepEqual(parse(out).changes.map((c) => c.text), ["a", "b", "c"]);
  assert.equal(mergeChanges(out, [{ date: "2027-04-02", text: "c" }]), out);
});

test("mergeChanges fills an empty Changes section in place", () => {
  const text = "---\nyear: 2027\nstatus: draft\n---\n\n## Changes\n\n## Secondary goals\n\n- Read\n";
  const out = mergeChanges(text, [{ date: "2027-04-02", text: "c" }]);
  assert.equal(out, "---\nyear: 2027\nstatus: draft\n---\n\n## Changes\n\n- 2027-04-02: c\n\n## Secondary goals\n\n- Read\n");
});

test("mergeChanges fills a Changes heading that ends the note", () => {
  const text = "---\nyear: 2027\nstatus: draft\n---\n\n## Secondary goals\n\n- Read\n\n## Changes\n";
  assert.equal(mergeChanges(text, [{ date: "2027-04-02", text: "c" }]), "---\nyear: 2027\nstatus: draft\n---\n\n## Secondary goals\n\n- Read\n\n## Changes\n\n- 2027-04-02: c\n");
});

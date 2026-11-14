// Validator for the year-goals note (DES-001). Errors are kept for content that
// makes the note unreadable as a year-goals note (REQ-003, REQ-007, and missing
// or unparseable frontmatter). Every rule about how the operator structures
// their goals is a warning (REQ-005, REQ-019, REQ-021). The area set is passed
// in, so this does no I/O.
import { CHART_LIMIT, MAIN_GOALS_RECOMMENDED, STATUSES, asYear, isIsoDate, type Diagnostic } from "./model.ts";
import { parseDetailed, type LocatedMainGoal, type LocatedPillar } from "./parse.ts";

const q = (s: string): string => JSON.stringify(s);

function goalWhere(g: LocatedMainGoal): string {
  return `line ${g.line} (main goal ${q(g.text)})`;
}

function pillarWhere(g: LocatedMainGoal, p: LocatedPillar, line = p.line): string {
  return `line ${line} (main goal ${q(g.text)} > pillar ${q(p.text)})`;
}

function show(v: unknown): string {
  if (typeof v === "string") return q(v);
  if (typeof v === "number" || typeof v === "boolean") return q(String(v));
  return q(JSON.stringify(v));
}

/**
 * Check a year-goals note. `knownAreas` is the set of `20-areas/` note stems;
 * pass null to skip the area check.
 */
export function validate(text: string, knownAreas: ReadonlySet<string> | null): Diagnostic[] {
  const note = parseDetailed(text);
  const out: Diagnostic[] = [];
  const error = (where: string, message: string): void => { out.push({ severity: "error", where, message }); };
  const warn = (where: string, message: string): void => { out.push({ severity: "warning", where, message }); };

  // Frontmatter (REQ-003).
  const fm = note.frontmatter;
  if (!fm.present) {
    error("frontmatter", "missing frontmatter: a year-goals note starts with a --- YAML block holding at least year and status");
  } else if (fm.data === null) {
    error("frontmatter", `unparseable frontmatter: ${fm.error ?? "not a mapping"}`);
  } else {
    const year = fm.data["year"];
    if (year === undefined || year === null || year === "") error("frontmatter: year", "missing year: expected a four-digit year such as 2027");
    else if (asYear(year) === null) error("frontmatter: year", `invalid year ${show(year)}: expected a four-digit year such as 2027`);
    const status = fm.data["status"];
    if (status === undefined || status === null || status === "") error("frontmatter: status", "missing status: expected draft or signed-off");
    else if (typeof status !== "string" || !(STATUSES as readonly string[]).includes(status)) {
      error("frontmatter: status", `invalid status ${show(status)}: expected draft or signed-off`);
    }
  }

  // At least one goal (REQ-003).
  if (note.mainGoals.length === 0 && note.secondaryGoals.length === 0) {
    error("body", "no goal at all: add a `## Main goal: <centre goal>` heading or a `## Secondary goals` list");
  }

  // More than 3 main goals (REQ-019).
  if (note.mainGoals.length > MAIN_GOALS_RECOMMENDED) {
    warn(
      "body",
      `${note.mainGoals.length} main goals is above the recommended ${MAIN_GOALS_RECOMMENDED}: consider turning some into pillars, sub-goals or secondary goals instead`,
    );
  }

  const checkAreas = (where: string, what: string, areas: readonly string[]): void => {
    if (knownAreas === null) return;
    for (const a of areas) {
      if (!knownAreas.has(a)) warn(where, `${what} names area ${q(a)}, which has no note in 20-areas/`);
    }
  };

  for (const g of note.mainGoals) {
    if (g.text === "") error(`line ${g.line} (main goal)`, "main goal with empty text: write the centre goal after `## Main goal:`");
    if (g.pillars.length === 0) warn(goalWhere(g), `${q(g.text)}: no pillars, consider making it a secondary goal`);
    if (g.pillars.length > CHART_LIMIT) warn(goalWhere(g), `${q(g.text)}: ${g.pillars.length} pillars, above the chart's ${CHART_LIMIT}`);
    for (const p of g.pillars) {
      if (p.text === "") error(pillarWhere(g, p), `pillar with empty text under main goal ${q(g.text)}`);
      if (p.actions.length > CHART_LIMIT) warn(pillarWhere(g, p), `pillar ${q(p.text)}: ${p.actions.length} actions, above the chart's ${CHART_LIMIT}`);
      p.actions.forEach((a, i) => {
        if (a.text === "") error(pillarWhere(g, p, a.line), `action ${i + 1} under pillar ${q(p.text)} has empty text`);
      });
      checkAreas(pillarWhere(g, p), `pillar ${q(p.text)}`, p.areas);
    }
  }

  for (const s of note.secondaryGoals) {
    const where = `line ${s.line} (secondary goal ${q(s.text)})`;
    if (s.text === "") error(`line ${s.line} (secondary goals)`, "secondary goal with empty text");
    checkAreas(where, `secondary goal ${q(s.text)}`, s.areas);
  }

  // Changes (REQ-007).
  for (const c of note.changes) {
    if (c.valid) continue;
    const where = `line ${c.line} (changes entry ${q(c.raw)})`;
    if (c.date === null) error(where, "changes entry has no date: write it as `- YYYY-MM-DD: what changed`");
    else if (isIsoDate(c.date)) error(where, "changes entry has no description after its date");
    else error(where, `changes entry date ${q(c.date)} is not a valid YYYY-MM-DD date`);
  }

  return out;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

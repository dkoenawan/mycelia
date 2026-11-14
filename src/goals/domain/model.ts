// The year-goals note model (DES-001, D3). Pure types: what parse() returns and
// what the downstream goal-pursuit features (#37 to #42) import.

export const STATUSES = ["draft", "signed-off"] as const;
export type Status = (typeof STATUSES)[number];

/** One pillar of a main goal's Mandala Chart: up to 8 actions, plus the areas it touches. */
export interface Pillar {
  name: string;
  /** Area slugs from the pillar's `Areas:` line, in order. */
  areas: string[];
  actions: string[];
}

/** A main goal: the chart's centre goal and its pillars, in note order. */
export interface MainGoal {
  centre: string;
  pillars: Pillar[];
}

/** A one-line goal with no chart. */
export interface SecondaryGoal {
  text: string;
  areas: string[];
}

/** A dated entry in the `## Changes` section. */
export interface Change {
  /** YYYY-MM-DD. */
  date: string;
  text: string;
}

export interface YearGoals {
  /** Null when the frontmatter's year is missing or invalid. */
  year: number | null;
  /** Null when the frontmatter's status is missing or not a known status. */
  status: Status | null;
  /** The `signed_off` date (YYYY-MM-DD), or null. */
  signedOff: string | null;
  mainGoals: MainGoal[];
  secondaryGoals: SecondaryGoal[];
  /** Oldest first (REQ-007). */
  changes: Change[];
}

export type Severity = "error" | "warning";

/** One validator finding: errors reject the note, warnings never do. */
export interface Diagnostic {
  severity: Severity;
  /** Where it is in the note, e.g. `line 12 (main goal "X" > pillar "Y")` or `frontmatter: year`. */
  where: string;
  message: string;
}

/** The Mandala Chart's 8 pillars per goal and 8 actions per pillar (REQ-021). */
export const CHART_LIMIT = 8;
/** More main goals than this is strongly discouraged (REQ-019). */
export const MAIN_GOALS_RECOMMENDED = 3;

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** A frontmatter year as a number, or null unless it's a four-digit year. */
export function asYear(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1000 && v <= 9999) return v;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** The note file name for a year: `<year>-goals.md` (D6). */
export function noteFileName(year: number): string {
  return `${year}-goals.md`;
}

// Parser for the year-goals note (DES-001, D3). Reads the headings-and-lists
// layout and skips anything it doesn't recognise (REQ-020):
//
//   ## Main goal: <centre>         a main goal
//   ### Pillar: <name>             a pillar of the main goal above it
//   Areas: [[a]], [[b]]            the areas the pillar touches
//   - <action>                     an action (top-level list item)
//   ## Secondary goals             - <goal> Areas: [[a]]
//   ## Changes                     - YYYY-MM-DD: <text>
//
// Nested list items, paragraphs, code blocks and other headings are extra
// content. Another heading of level 3 or deeper ends the pillar; another
// heading of level 1 or 2 ends the section.
import { readFrontmatter, toLines, type NoteFrontmatter } from "./frontmatter.ts";
import { asYear, isIsoDate, STATUSES, type Status, type YearGoals } from "./model.ts";

export interface LocatedText {
  text: string;
  /** 1-based line number in the note. */
  line: number;
}

export interface LocatedPillar extends LocatedText {
  areas: string[];
  actions: LocatedText[];
}

export interface LocatedMainGoal extends LocatedText {
  pillars: LocatedPillar[];
}

export interface LocatedSecondary extends LocatedText {
  areas: string[];
}

export interface LocatedChange {
  line: number;
  /** The item text as written, after the list marker. */
  raw: string;
  /** The date as written before the first colon, or null when there's none. */
  date: string | null;
  text: string;
  valid: boolean;
}

/** The parse with line numbers, for the validator. */
export interface ParsedNote {
  frontmatter: NoteFrontmatter;
  mainGoals: LocatedMainGoal[];
  secondaryGoals: LocatedSecondary[];
  changes: LocatedChange[];
}

const HEADING = /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const LIST_ITEM = /^[-*+](?:[ \t]+(.*))?$/;
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const AREAS_LINE = /^Areas:[ \t]*(.*)$/i;
const WIKILINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

/** Area slugs from the `[[wikilinks]]` in a piece of text, in order, without duplicates. */
export function wikilinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WIKILINK)) {
    const slug = (m[1] ?? "").trim();
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

/** Split a secondary goal item into its statement and its `Areas:` suffix. */
export function splitSecondary(item: string): { text: string; areas: string[] } {
  const m = /^(.*?)(?:^|[ \t]+)Areas:[ \t]*(.*)$/i.exec(item);
  if (!m) return { text: item.trim(), areas: [] };
  return { text: (m[1] ?? "").trim(), areas: wikilinks(m[2] ?? "") };
}

function parseChange(raw: string, line: number): LocatedChange {
  const m = /^([^\s:]+):[ \t]*(.*)$/.exec(raw);
  if (!m) return { line, raw, date: null, text: raw, valid: false };
  const date = m[1] ?? "";
  const text = (m[2] ?? "").trim();
  return { line, raw, date, text, valid: isIsoDate(date) && text !== "" };
}

type Section = "none" | "main" | "secondary" | "changes";

export function parseDetailed(text: string): ParsedNote {
  const lines = toLines(text);
  const frontmatter = readFrontmatter(lines);
  const note: ParsedNote = { frontmatter, mainGoals: [], secondaryGoals: [], changes: [] };
  let section: Section = "none";
  let goal: LocatedMainGoal | null = null;
  let pillar: LocatedPillar | null = null;
  let fence: string | null = null;

  for (let i = frontmatter.bodyStart; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const n = i + 1;
    const f = FENCE.exec(line);
    if (fence !== null) {
      if (f && (f[1] ?? "").startsWith(fence)) fence = null;
      continue;
    }
    if (f) {
      fence = (f[1] ?? "").slice(0, 3);
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      const level = (h[1] ?? "").length;
      const title = (h[2] ?? "").trim();
      pillar = null;
      if (level === 2) {
        goal = null;
        const mg = /^main goal:(.*)$/i.exec(title);
        if (mg) {
          goal = { text: (mg[1] ?? "").trim(), line: n, pillars: [] };
          note.mainGoals.push(goal);
          section = "main";
        } else if (/^secondary goals$/i.test(title)) {
          section = "secondary";
        } else if (/^changes$/i.test(title)) {
          section = "changes";
        } else {
          section = "none";
        }
      } else if (level === 1) {
        section = "none";
        goal = null;
      } else if (section === "main" && goal !== null) {
        const p = level === 3 ? /^pillar:(.*)$/i.exec(title) : null;
        if (p) {
          pillar = { text: (p[1] ?? "").trim(), line: n, areas: [], actions: [] };
          goal.pillars.push(pillar);
        }
      } else {
        // A sub-heading under Secondary goals or Changes ends what we read there.
        section = "none";
      }
      continue;
    }

    const li = LIST_ITEM.exec(line);
    if (section === "main" && pillar !== null) {
      if (li) {
        pillar.actions.push({ text: (li[1] ?? "").trim(), line: n });
        continue;
      }
      const a = AREAS_LINE.exec(line);
      if (a) for (const slug of wikilinks(a[1] ?? "")) if (!pillar.areas.includes(slug)) pillar.areas.push(slug);
    } else if (section === "secondary" && li) {
      const s = splitSecondary(li[1] ?? "");
      note.secondaryGoals.push({ text: s.text, line: n, areas: s.areas });
    } else if (section === "changes" && li) {
      note.changes.push(parseChange((li[1] ?? "").trim(), n));
    }
  }
  return note;
}

function asStatus(v: unknown): Status | null {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v) ? (v as Status) : null;
}

function asDate(v: unknown): string | null {
  if (typeof v === "string" && isIsoDate(v.trim())) return v.trim();
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return null;
}

/** Read a year-goals note. Unrecognised content is skipped; missing values are null. */
export function parse(text: string): YearGoals {
  const d = parseDetailed(text);
  const fm = d.frontmatter.data ?? {};
  return {
    year: asYear(fm["year"]),
    status: asStatus(fm["status"]),
    signedOff: asDate(fm["signed_off"]),
    mainGoals: d.mainGoals.map((g) => ({
      centre: g.text,
      pillars: g.pillars.map((p) => ({ name: p.text, areas: [...p.areas], actions: p.actions.map((a) => a.text) })),
    })),
    secondaryGoals: d.secondaryGoals.map((s) => ({ text: s.text, areas: [...s.areas] })),
    changes: d.changes
      .filter((c) => c.valid && c.date !== null)
      .map((c) => ({ date: c.date ?? "", text: c.text }))
      // Array.prototype.sort is stable, so same-day entries keep note order.
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  };
}

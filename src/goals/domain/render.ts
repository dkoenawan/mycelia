// Renderer for a draft year-goals note in the D3 layout (DES-002). Pure.
import { stringify } from "yaml";
import type { YearGoals } from "./model.ts";

export interface NoteDates {
  /** YYYY-MM-DD. */
  created: string;
  updated: string;
}

/** One frontmatter line per key, YAML-quoted where needed. */
export function frontmatterLine(key: string, value: unknown): string {
  return stringify({ [key]: value }, { lineWidth: 0 }).trimEnd();
}

/** Collapse whitespace so a text stays on its one line. */
export function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const links = (areas: readonly string[]): string => areas.map((a) => `[[${a}]]`).join(", ");

/**
 * Render `model` as a draft note. The status is always `draft` and there's no
 * `signed_off`: sign-off sets those (edit.ts). Throws when the year is missing.
 */
export function renderDraft(model: YearGoals, dates: NoteDates): string {
  if (model.year === null) throw new Error("renderDraft: the model has no year");
  const year = model.year;
  const out: string[] = [
    "---",
    frontmatterLine("name", `${year}-goals`),
    frontmatterLine("description", `Year goals for ${year} — main goals as Mandala Charts, plus secondary goals`),
    frontmatterLine("type", "vision"),
    frontmatterLine("year", year),
    frontmatterLine("status", "draft"),
    frontmatterLine("created", dates.created),
    frontmatterLine("updated", dates.updated),
    "---",
    "",
    `# ${year} goals`,
    "",
  ];
  for (const g of model.mainGoals) {
    out.push(`## Main goal: ${oneLine(g.centre)}`, "");
    for (const p of g.pillars) {
      out.push(`### Pillar: ${oneLine(p.name)}`, "");
      if (p.areas.length > 0) out.push(`Areas: ${links(p.areas)}`, "");
      if (p.actions.length > 0) out.push(...p.actions.map((a) => `- ${oneLine(a)}`), "");
    }
  }
  if (model.secondaryGoals.length > 0) {
    out.push("## Secondary goals", "");
    for (const s of model.secondaryGoals) out.push(`- ${oneLine(s.text)}${s.areas.length > 0 ? ` Areas: ${links(s.areas)}` : ""}`);
    out.push("");
  }
  if (model.changes.length > 0) {
    out.push("## Changes", "");
    for (const c of model.changes) out.push(`- ${c.date}: ${oneLine(c.text)}`);
    out.push("");
  }
  return out.join("\n");
}

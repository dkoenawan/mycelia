// Inline year-goals notes for the goals tests (DES-010). No .md fixtures (ADR-0007).
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "../../src/lib/paths.ts";

export interface PillarSpec {
  name: string;
  actions?: string[] | number;
  areas?: string[];
}

export interface GoalSpec {
  centre: string;
  pillars?: PillarSpec[];
  extra?: string;
}

export interface NoteSpec {
  year?: string;
  status?: string;
  signedOff?: string;
  main?: GoalSpec[];
  secondary?: string[];
  changes?: string[];
  frontmatter?: string | null;
}

function actions(a: PillarSpec["actions"]): string[] {
  if (typeof a === "number") return Array.from({ length: a }, (_, i) => `Action ${i + 1}`);
  return a ?? [];
}

/** Build a note in the D3 layout. */
export function noteText(spec: NoteSpec = {}): string {
  const fm =
    spec.frontmatter !== undefined
      ? spec.frontmatter
      : [
          "name: 2027-goals",
          "description: Year goals for 2027",
          "type: vision",
          `year: ${spec.year ?? "2027"}`,
          `status: ${spec.status ?? "draft"}`,
          ...(spec.signedOff ? [`signed_off: ${spec.signedOff}`] : []),
          "created: 2026-12-01",
          "updated: 2026-12-01",
        ].join("\n");
  const out: string[] = [];
  if (fm !== null) out.push("---", fm, "---", "");
  out.push(`# ${spec.year ?? "2027"} goals`, "");
  for (const g of spec.main ?? []) {
    out.push(`## Main goal: ${g.centre}`, "");
    if (g.extra) out.push(g.extra, "");
    for (const p of g.pillars ?? []) {
      out.push(`### Pillar: ${p.name}`, "");
      if (p.areas?.length) out.push(`Areas: ${p.areas.map((a) => `[[${a}]]`).join(", ")}`, "");
      for (const a of actions(p.actions)) out.push(a === "" ? "-" : `- ${a}`);
      out.push("");
    }
  }
  if (spec.secondary) {
    out.push("## Secondary goals", "");
    for (const s of spec.secondary) out.push(`- ${s}`);
    out.push("");
  }
  if (spec.changes) {
    out.push("## Changes", "");
    for (const c of spec.changes) out.push(`- ${c}`);
    out.push("");
  }
  return out.join("\n");
}

/** The REQ-002 note: two main goals, a full 8-action pillar and an empty one. */
export const REQ002 = noteText({
  main: [
    { centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", actions: 5 }, { name: "Strength", actions: 8 }, { name: "Recovery", actions: 0 }] },
    { centre: "Ship a side project", pillars: [{ name: "Build", actions: 2 }, { name: "Launch", actions: 1 }] },
  ],
});

/** A full 8 x 8 chart. */
export const FULL_CHART = noteText({
  main: [{ centre: "Run a marathon under 3:30", pillars: Array.from({ length: 8 }, (_, i) => ({ name: `Pillar ${i + 1}`, actions: 8 })) }],
});

/** The default area slugs, read from control/areas.example.yaml (commented entries excluded). */
export function defaultAreas(): ReadonlySet<string> {
  const doc = parse(readFileSync(path.join(REPO_ROOT, "control", "areas.example.yaml"), "utf8")) as { areas: { slug: string }[] };
  return new Set(doc.areas.map((a) => a.slug));
}

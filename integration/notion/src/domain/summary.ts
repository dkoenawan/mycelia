// The pull run's daily-note block (REQ-032): counts per outcome and wikilinks
// to each new resource note and ask. Pure.

export interface RunSummary {
  /** "HH:MM" UTC. */
  time: string;
  counts: Readonly<Record<string, number>>;
  /** Repo-relative paths of new resource notes. */
  resources: readonly string[];
  /** Repo-relative paths of new asks (the ingester's and the connector's). */
  asks: readonly string[];
}

const ORDER = ["ingested", "held", "failed", "stopped", "synced"] as const;

function link(rel: string): string {
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  return `[[${base.toLowerCase().endsWith(".md") ? base.slice(0, -3) : base}]]`;
}

export function renderSummary(s: RunSummary): string {
  const parts = ORDER.filter((k) => (s.counts[k] ?? 0) > 0 || k === "ingested").map((k) => `${String(s.counts[k] ?? 0)} ${k === "synced" ? "status caught up" : k}`);
  const lines = [`## Phone capture (${s.time} UTC)`, "", `- ${parts.join(", ")} from phone capture`];
  if (s.resources.length > 0) lines.push(`- Resources: ${s.resources.map(link).join(", ")}`);
  if (s.asks.length > 0) lines.push(`- Asks: ${[...new Set(s.asks)].map(link).join(", ")}`);
  return `${lines.join("\n")}\n`;
}

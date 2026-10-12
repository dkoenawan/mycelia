// Stopped-item ask (DES-010, REQ-018): one note in 00-inbox/ per stop
// episode, in the vault's note format. It never carries ingest_item
// frontmatter, so the ingester's scanAsks ignores it. Pure.
import type { SourceRow } from "./capture.ts";
import { slugify } from "./capture-item.ts";
import { STOPPED_REASON } from "./lifecycle.ts";

export function stoppedAskBase(date: string, title: string): string {
  return `${date}-notion-stopped-${slugify(title, 40) || "capture"}`;
}

function inline(s: string): string {
  return s.replace(/[`\r\n]+/g, " ").trim();
}

export function renderStoppedAsk(o: { stem: string; date: string; row: Pick<SourceRow, "id" | "title">; reason: string }): string {
  const title = inline(o.row.title) || "Untitled capture";
  const fm = [
    "---",
    `name: ${o.stem}`,
    `description: ${JSON.stringify(`Phone capture "${title}" couldn't be pulled from Notion 3 runs in a row`)}`,
    "type: reference",
    `created: ${o.date}`,
    `updated: ${o.date}`,
    "source: notion",
    `source_id: ${JSON.stringify(o.row.id)}`,
    "---",
  ].join("\n");
  const body = [
    `The phone capture \`${title}\` in the Notion capture inbox couldn't be pulled on 3 consecutive runs, so the pull has stopped retrying it.`,
    "",
    `Last reason: \`${inline(o.reason) || "unknown"}\``,
    "",
    "To resolve it:",
    "",
    "- Fix the cause in Notion if you can (for example, remove content the connector can't read).",
    "- Then set its Status to New to retry: the next pull treats it as new, with its failure count reset.",
    "- Or leave it, or delete the row in Notion, and delete this ask.",
    "",
    `Its Reason in Notion reads: \`${STOPPED_REASON}\`.`,
  ].join("\n");
  return `${fm}\n\n${body}\n`;
}

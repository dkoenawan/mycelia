// Capture item rendering (DES-006): a pulled source item as one Markdown file
// in the capture folder. Pure. The source item's ID sits only in frontmatter,
// which the ingester's URL extraction ignores, and the Notion page address is
// never written (REQ-024).
import type { Capture, SourceRow } from "./capture.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** A kebab-case slug of `text`, or "" if nothing usable is left. */
export function slugify(text: string, max = 48): string {
  const s = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, max).replace(/-+$/g, "");
}

/** The hint as a placement-target slug, or null when it can't be one (REQ-023). */
export function hintSlug(hint: string | null): string | null {
  if (!hint) return null;
  const s = hint.trim().toLowerCase();
  return SLUG.test(s) ? s : null;
}

/** Deterministic capture filename: the same row always gets the same name (REQ-013 recovery). */
export function captureName(row: Pick<SourceRow, "id" | "title">): string {
  const short = row.id.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8).toLowerCase();
  return `notion-${slugify(row.title) || "capture"}-${short}.md`;
}

function plural(label: string, n: number): string {
  return `${String(n)} ${label}${n === 1 ? "" : "s"}`;
}

/** "Left out: 1 image, 2 files." or "" when nothing was left out (REQ-012). */
export function omittedLine(omitted: Readonly<Record<string, number>>): string {
  const parts = Object.entries(omitted).filter(([, n]) => n > 0).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, n]) => plural(k, n));
  return parts.length > 0 ? `Left out: ${parts.join(", ")}.` : "";
}

function yamlString(s: string): string {
  return JSON.stringify(s);
}

/**
 * The capture item's content. `linkHint` is true only when the use case has
 * confirmed the hint names an existing area or project note.
 */
export function renderCaptureItem(row: SourceRow, capture: Capture, linkHint: boolean): string {
  const title = (capture.title || row.title).replace(/\s+/g, " ").trim() || "Untitled capture";
  const parts = [
    `---\nsource: notion\nsource_id: ${yamlString(row.id)}\ncaptured: ${yamlString(row.createdTime)}\n---`,
    `# ${title}`,
  ];
  if (capture.body.trim()) parts.push(capture.body.trim());
  if (capture.url) parts.push(`URL: ${capture.url}`);
  const left = omittedLine(capture.omitted);
  if (left) parts.push(left);
  const slug = linkHint ? hintSlug(capture.hint) : null;
  if (slug) parts.push(`Area or project: [[${slug}]]`);
  return `${parts.join("\n\n")}\n`;
}

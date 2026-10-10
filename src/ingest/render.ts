// Resource-note renderer, sanitiser and slugs (DES-013, injection layer 5).
// The ingester picks every path; model text is sanitised so the only live
// links in a resource note are the ones the renderer writes.
import { renderFrontmatter } from "./frontmatter.ts";

const MAX_SLUG = 60;

export function slugify(s: string): string {
  let t = s
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (t.length > MAX_SLUG) {
    const cut = t.slice(0, MAX_SLUG + 1);
    const at = cut.lastIndexOf("-");
    t = (at > 0 ? cut.slice(0, at) : t.slice(0, MAX_SLUG)).replace(/-+$/g, "");
  }
  return t;
}

/** The resource slug base: from the title, else the item stem, else "capture". */
export function resourceSlugBase(title: string, itemStem: string): string {
  return slugify(title) || slugify(itemStem) || "capture";
}

/** A filesystem- and wikilink-safe archive base name for a capture item stem. */
export function archiveBase(itemStem: string): string {
  const t = itemStem.replace(/[[\]|#^\\/:*?"<>]/g, "-").trim();
  return t || "capture";
}

const BARE_URL = /\b(?:https?:\/\/|www\.)[^\s<>()[\]"'`]+/gi;
const MD_LINK = /(!\\)?\[([^\]\n]*)\]\(\s*<?([^)\s>]*)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

function trimUrl(u: string): string {
  return u.replace(/[.,;:!?]+$/, "");
}

/**
 * Sanitise model text (DES-013): strip control/format characters, escape
 * wikilinks and embeds, escape "<", and de-link every URL that isn't one of
 * the item's own extracted URLs (bare ones become inert code spans).
 */
export function sanitize(text: string, allowedUrls: readonly string[], opts: { singleLine?: boolean } = {}): string {
  const allowed = new Set(allowedUrls);
  // Private-use characters are removed too; one of them is the placeholder below.
  let t = text.replace(/\r\n?/g, "\n").replace(/[\p{Cf}\p{Co}]|(?![\n\t])\p{Cc}/gu, "");
  if (opts.singleLine) t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/\[\[/g, "\\[\\[").replace(/!\[/g, "!\\[");
  t = t.replace(/</g, "&lt;");
  // Reference-style definitions ("[x]: url") are broken so their URL is treated as bare text.
  t = t.replace(/^(\s{0,3})\[([^\]\n]+)\]:/gm, "$1\\[$2]:");
  const kept: string[] = [];
  t = t.replace(MD_LINK, (_m, image: string | undefined, label: string, url: string) => {
    if (!image && allowed.has(url)) {
      kept.push(`[${label}](${url})`);
      return `\uE000${String(kept.length - 1)}\uE000`;
    }
    return label;
  });
  t = t.replace(BARE_URL, (m) => {
    const u = trimUrl(m);
    const rest = m.slice(u.length);
    if (allowed.has(u)) return m;
    return `\`${u.replace(/`/g, "")}\`${rest}`;
  });
  return t.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => kept[Number(i)] ?? "");
}

export interface ResourceInput {
  slug: string;
  date: string;
  description: string;
  summary: string;
  takeaways: readonly string[];
  targets: readonly string[];
  /** Wikilink target for the archived original: stem for .md, full name for others. */
  archivedLinkTarget: string;
  urls: readonly string[];
}

export function renderResource(r: ResourceInput): string {
  const fm = renderFrontmatter([
    ["name", r.slug],
    ["description", sanitize(r.description, r.urls, { singleLine: true })],
    ["type", "resource"],
    ["created", r.date],
    ["updated", r.date],
  ]);
  const parts = [
    "## Summary",
    "",
    sanitize(r.summary, r.urls).trim(),
    "",
    "## Key takeaways",
    "",
    ...r.takeaways.map((t) => `- ${sanitize(t, r.urls, { singleLine: true })}`),
    "",
    "## Related",
    "",
    ...r.targets.map((t) => `- [[${t}]]`),
    "",
    "## Source",
    "",
    `- Original capture: [[${r.archivedLinkTarget}]]`,
    ...r.urls.map((u) => `- <${u}>`),
  ];
  return `${fm}\n${parts.join("\n")}\n`;
}

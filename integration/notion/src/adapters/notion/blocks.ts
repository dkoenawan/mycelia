// Converter (DES-006, D2): Notion blocks to Markdown. Paragraphs, headings
// 1-3, bulleted and numbered list items (nested by indent), to-dos and
// rich-text links (REQ-011); bookmarks and link previews become links. Every
// other block kind is left out and counted by kind (REQ-012). Rich-text
// styling is dropped and the text kept (design: annotations rejected, YAGNI).
import type { Json, NotionBlock } from "./http-client.ts";

/** Block kinds whose children the adapter fetches and renders. */
export const NESTABLE = new Set(["paragraph", "bulleted_list_item", "numbered_list_item", "to_do", "heading_1", "heading_2", "heading_3"]);

const LABELS: Readonly<Record<string, string>> = {
  image: "image", file: "file", pdf: "PDF", video: "video", audio: "audio", embed: "embed", code: "code block",
  quote: "quote", callout: "callout", toggle: "toggle", table: "table", divider: "divider", child_page: "subpage",
  child_database: "database", column_list: "column layout", equation: "equation", synced_block: "synced block",
  table_of_contents: "table of contents", breadcrumb: "breadcrumb", template: "template", link_to_page: "page link",
};

/** The kind label used in the "Left out" line. */
export function omittedLabel(type: string): string {
  return LABELS[type] ?? "unsupported block";
}

function obj(v: unknown): Json {
  return v && typeof v === "object" ? (v as Json) : {};
}

/** Rich text to Markdown: text kept, links as [text](url), styling dropped. */
export function richToMarkdown(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return (v as unknown[]).map((seg) => {
    const s = obj(seg);
    const content = obj(s["text"])["content"];
    const text = typeof s["plain_text"] === "string" ? s["plain_text"] : typeof content === "string" ? content : "";
    const href = typeof s["href"] === "string" ? s["href"] : obj(obj(s["text"])["link"])["url"];
    return typeof href === "string" && /^https?:\/\//.test(href) && text ? `[${text}](${href})` : text;
  }).join("");
}

function textOf(b: NotionBlock): string {
  return richToMarkdown(obj(b[b.type])["rich_text"]).replace(/\r?\n/g, " ").trimEnd();
}

interface Chunk {
  list: boolean;
  text: string;
}

function render(blocks: readonly NotionBlock[], depth: number, omitted: Record<string, number>): Chunk[] {
  const out: Chunk[] = [];
  const indent = "  ".repeat(depth);
  let number = 0;
  for (const b of blocks) {
    number = b.type === "numbered_list_item" ? number + 1 : 0;
    const content = obj(b[b.type]);
    let line: string | null = null;
    let list = false;
    switch (b.type) {
      case "paragraph":
        line = `${indent}${textOf(b)}`;
        break;
      case "heading_1":
      case "heading_2":
      case "heading_3":
        line = `${"#".repeat(Number(b.type.slice(-1)))} ${textOf(b)}`;
        break;
      case "bulleted_list_item":
        line = `${indent}- ${textOf(b)}`;
        list = true;
        break;
      case "numbered_list_item":
        line = `${indent}${String(number)}. ${textOf(b)}`;
        list = true;
        break;
      case "to_do":
        line = `${indent}- [${content["checked"] === true ? "x" : " "}] ${textOf(b)}`;
        list = true;
        break;
      case "bookmark":
      case "link_preview": {
        const url = content["url"];
        if (typeof url === "string" && /^https?:\/\//.test(url)) {
          const caption = richToMarkdown(content["caption"]).trim();
          line = `${indent}${caption ? `[${caption}](${url})` : url}`;
        } else {
          omitted[omittedLabel(b.type)] = (omitted[omittedLabel(b.type)] ?? 0) + 1;
        }
        break;
      }
      default: {
        const label = omittedLabel(b.type);
        omitted[label] = (omitted[label] ?? 0) + 1;
      }
    }
    if (line === null) continue;
    out.push({ list, text: line });
    if (b.children?.length) {
      const inner = render(b.children, list ? depth + 1 : depth, omitted);
      // Children of a list item stay in the list; others follow as their own blocks.
      out.push(...inner.map((c) => (list ? { list: true, text: c.text } : c)));
    }
  }
  return out;
}

/** Markdown body and the kinds left out, counted (REQ-011, REQ-012). */
export function blocksToMarkdown(blocks: readonly NotionBlock[]): { body: string; omitted: Record<string, number> } {
  const omitted: Record<string, number> = {};
  const chunks = render(blocks, 0, omitted);
  let body = "";
  chunks.forEach((c, i) => {
    const prev = chunks[i - 1];
    if (i > 0) body += prev?.list && c.list ? "\n" : "\n\n";
    body += c.text;
  });
  return { body: body.replace(/\n{3,}/g, "\n\n").trim(), omitted };
}

// HTML to plain text (DES-008, injection layer 1). parse5 is a WHATWG parser,
// so the tree matches what a browser builds from the same tag soup. Hidden
// content, scripts, forms and comments are dropped; invisible characters are
// removed; the result is capped.
import { parse, type DefaultTreeAdapterTypes as T } from "parse5";

export const MAX_CHARS_PER_URL = 40_000;
export const MAX_CHARS_TOTAL = 60_000;
const MAX_TOKEN = 2_000;

const DROP = new Set([
  "script", "style", "noscript", "template", "svg", "math", "iframe", "object", "embed", "canvas",
  "form", "button", "select", "input", "textarea", "head",
]);
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt", "figcaption", "figure",
  "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre",
  "section", "summary", "table", "tr", "td", "th", "ul", "body", "html", "caption", "tbody", "thead", "tfoot",
]);

type Node = T.ChildNode | T.Document | T.DocumentFragment;

function attr(el: T.Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

export function isHidden(el: T.Element): boolean {
  if (attr(el, "hidden") !== undefined) return true;
  if ((attr(el, "aria-hidden") ?? "").trim().toLowerCase() === "true") return true;
  if ((attr(el, "type") ?? "").trim().toLowerCase() === "hidden") return true;
  const style = (attr(el, "style") ?? "").toLowerCase().replace(/\s+/g, "");
  return /display:none|visibility:hidden|font-size:0(?:px|em|rem|pt|%)?(?:[;!]|$)|opacity:0(?:\.0*)?(?:[;!]|$)/.test(style);
}

function isElement(n: Node): n is T.Element {
  return "tagName" in n;
}

function childrenOf(n: Node): T.ChildNode[] {
  return "childNodes" in n ? n.childNodes : [];
}

function walk(n: Node, out: string[]): void {
  if (n.nodeName === "#text") {
    out.push((n as T.TextNode).value);
    return;
  }
  if (n.nodeName === "#comment" || n.nodeName === "#documentType") return;
  if (isElement(n)) {
    const tag = n.tagName.toLowerCase();
    if (DROP.has(tag) || isHidden(n)) return;
    if (tag === "br") {
      out.push("\n");
      return;
    }
    const block = BLOCK.has(tag);
    if (block) out.push("\n\n");
    for (const c of childrenOf(n)) walk(c, out);
    if (block) out.push("\n\n");
    return;
  }
  for (const c of childrenOf(n)) walk(c, out);
}

function findAll(n: Node, tag: string, acc: T.Element[] = []): T.Element[] {
  if (isElement(n)) {
    if (n.tagName.toLowerCase() === tag) acc.push(n);
    if (n.tagName.toLowerCase() === "template") return acc;
  }
  for (const c of childrenOf(n)) findAll(c, tag, acc);
  return acc;
}

function textOf(n: Node): string {
  const out: string[] = [];
  for (const c of childrenOf(n)) if (c.nodeName === "#text") out.push((c as T.TextNode).value);
  return out.join("");
}

/** Title and description metadata, labelled. */
function metadata(doc: T.Document): string[] {
  const lines: string[] = [];
  const add = (label: string, v: string | undefined): void => {
    const t = normalizeText(v ?? "").replace(/\n+/g, " ").slice(0, 500);
    if (t && !lines.some((l) => l.endsWith(`: ${t}`))) lines.push(`${label}: ${t}`);
  };
  add("Title", findAll(doc, "title")[0] ? textOf(findAll(doc, "title")[0] as T.Element) : undefined);
  for (const m of findAll(doc, "meta")) {
    const key = (attr(m, "property") ?? attr(m, "name") ?? "").toLowerCase();
    if (key === "og:title") add("Title", attr(m, "content"));
    else if (key === "og:description" || key === "description") add("Description", attr(m, "content"));
  }
  return lines;
}

/** NFKC, strip format/control characters (keeping \n and \t), collapse whitespace, drop long unbroken runs. */
export function normalizeText(s: string): string {
  const t = s
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\p{Cf}]|(?![\n\t])\p{Cc}/gu, "")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((l) => l.split(" ").filter((w) => w.length <= MAX_TOKEN).join(" ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/** Cut at a paragraph boundary at or before `max` characters. */
export function capText(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  const para = head.lastIndexOf("\n\n");
  if (para > max / 2) return head.slice(0, para).trimEnd();
  const line = head.lastIndexOf("\n");
  return (line > max / 2 ? head.slice(0, line) : head).trimEnd();
}

export function htmlToText(html: string, max = MAX_CHARS_PER_URL): string {
  const doc = parse(html);
  const meta = metadata(doc);
  const out: string[] = [];
  walk(doc, out);
  const body = normalizeText(out.join(""));
  return capText([meta.join("\n"), body].filter(Boolean).join("\n\n"), max);
}

export function plainToText(text: string, max = MAX_CHARS_PER_URL): string {
  return capText(normalizeText(text), max);
}

/** The <meta charset> or http-equiv charset in the first bytes of a page, if any. */
export function sniffCharset(head: string): string | undefined {
  const m = /<meta[^>]+charset\s*=\s*["']?\s*([A-Za-z0-9_.:-]+)/i.exec(head);
  return m?.[1]?.toLowerCase();
}

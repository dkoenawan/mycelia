// YAML frontmatter: split, read (capped) and write one key at a time (DES-005,
// DES-007, DES-013). Uses `yaml` (YAML 1.2), which quotes strings that need it.
import { open } from "node:fs/promises";
import { parse, stringify } from "yaml";

export interface Split {
  /** The YAML between the fences, or null when the text has no frontmatter. */
  yaml: string | null;
  /** Everything after the closing fence's line (or the whole text). */
  body: string;
}

const OPEN = /^---\r?\n/;
const CLOSE = /^(?:---|\.\.\.)[ \t]*\r?$/m;

export function splitFrontmatter(text: string): Split {
  const m = OPEN.exec(text);
  if (!m) return { yaml: null, body: text };
  const rest = text.slice(m[0].length);
  const close = CLOSE.exec(rest);
  if (!close) return { yaml: null, body: text };
  const yaml = rest.slice(0, close.index);
  let after = rest.slice(close.index + close[0].length);
  if (after.startsWith("\n")) after = after.slice(1);
  return { yaml, body: after };
}

export type Frontmatter = Record<string, unknown>;

export interface ParsedFrontmatter {
  data: Frontmatter | null;
  error: string | null;
}

export function parseFrontmatter(yaml: string | null): ParsedFrontmatter {
  if (yaml === null) return { data: null, error: null };
  try {
    const v: unknown = parse(yaml);
    if (v === null || v === undefined) return { data: {}, error: null };
    if (typeof v !== "object" || Array.isArray(v)) return { data: null, error: "frontmatter is not a mapping" };
    return { data: v as Frontmatter, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message.split("\n")[0] ?? "parse error" : "parse error" };
  }
}

/** Frontmatter of a file, reading at most `capBytes` (DES-007: 8 KB). */
export async function readFrontmatter(file: string, capBytes = 8192): Promise<ParsedFrontmatter> {
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(capBytes);
    const { bytesRead } = await fh.read(buf, 0, capBytes, 0);
    const text = buf.subarray(0, bytesRead).toString("utf8");
    if (!OPEN.test(text)) return { data: null, error: null };
    const split = splitFrontmatter(text);
    if (split.yaml === null) return { data: null, error: `no closing --- within ${capBytes} bytes` };
    return parseFrontmatter(split.yaml);
  } finally {
    await fh.close();
  }
}

/** Render frontmatter one key at a time, in the given order. */
export function renderFrontmatter(entries: [string, unknown][]): string {
  let out = "---\n";
  for (const [k, v] of entries) out += stringify({ [k]: v }, { lineWidth: 0 });
  return `${out}---\n`;
}

/** A frontmatter value as a single trimmed line, or "" when absent or not a scalar. */
export function oneLine(v: unknown): string {
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

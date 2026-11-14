// Frontmatter split and read for year-goals notes (DES-001). Pure: works on
// text, with line numbers so diagnostics can say where things are.
import { parse } from "yaml";

export interface NoteFrontmatter {
  /** False when the text doesn't open with a `---` fence closed by `---` or `...`. */
  present: boolean;
  /** The parsed mapping, or null when absent or unparseable. */
  data: Record<string, unknown> | null;
  /** Why the YAML couldn't be read, or null. */
  error: string | null;
  /** 0-based index of the first body line in `lines`. */
  bodyStart: number;
}

/** Split text into lines, without their line endings. */
export function toLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function readFrontmatter(lines: readonly string[]): NoteFrontmatter {
  if (lines[0]?.trimEnd() !== "---") return { present: false, data: null, error: null, bodyStart: 0 };
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    const l = (lines[i] ?? "").trimEnd();
    if (l === "---" || l === "...") {
      close = i;
      break;
    }
  }
  if (close < 0) return { present: false, data: null, error: null, bodyStart: 0 };
  const yaml = lines.slice(1, close).join("\n");
  try {
    const v: unknown = parse(yaml);
    if (v === null || v === undefined) return { present: true, data: {}, error: null, bodyStart: close + 1 };
    if (typeof v !== "object" || Array.isArray(v)) return { present: true, data: null, error: "frontmatter is not a mapping", bodyStart: close + 1 };
    return { present: true, data: v as Record<string, unknown>, error: null, bodyStart: close + 1 };
  } catch (e) {
    const msg = e instanceof Error ? (e.message.split("\n")[0] ?? "parse error") : "parse error";
    return { present: true, data: null, error: msg, bodyStart: close + 1 };
  }
}

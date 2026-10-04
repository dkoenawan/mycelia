// Vault index (DES-006): mirrors what Obsidian indexes, so link resolution and
// unique names agree with what the operator sees. Built once per run, updated
// in memory as the run creates and moves files.
import { readdirSync } from "node:fs";
import path from "node:path";

export interface Wikilink {
  target: string;
  embed: boolean;
  raw: string;
}

const LINK = /(!?)\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Remove fenced code blocks and inline code spans, keeping line structure. */
export function stripCode(text: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of text.split("\n")) {
    const m = FENCE.exec(line);
    if (fence) {
      if (m?.[1] && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) fence = null;
      out.push("");
      continue;
    }
    if (m?.[1]) {
      fence = m[1];
      out.push("");
      continue;
    }
    out.push(line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (s) => " ".repeat(s.length)));
  }
  return out.join("\n");
}

export function parseWikilinks(text: string): Wikilink[] {
  const links: Wikilink[] = [];
  for (const m of stripCode(text).matchAll(LINK)) {
    const target = (m[2] ?? "").trim();
    if (target) links.push({ target, embed: m[1] === "!", raw: m[0] });
  }
  return links;
}

const EXT = /\.([A-Za-z0-9]{1,8})$/;

function stemOf(name: string): string {
  return name.toLowerCase().endsWith(".md") ? name.slice(0, -3) : name;
}

function addTo(map: Map<string, string[]>, key: string, rel: string): void {
  const list = map.get(key);
  if (list) {
    if (!list.includes(rel)) list.push(rel);
  } else map.set(key, [rel]);
}

function removeFrom(map: Map<string, string[]>, key: string, rel: string): void {
  const list = map.get(key);
  if (!list) return;
  const next = list.filter((p) => p !== rel);
  if (next.length > 0) map.set(key, next);
  else map.delete(key);
}

export class VaultIndex {
  readonly root: string;
  /** lower-cased stem -> repo-relative paths, for .md files */
  private readonly stems = new Map<string, string[]>();
  /** lower-cased filename -> repo-relative paths, for every other file */
  private readonly files = new Map<string, string[]>();

  private constructor(root: string) {
    this.root = root;
  }

  /** Walk every file under root except dot-directories; symlinked directories aren't followed. */
  static build(root: string): VaultIndex {
    const idx = new VaultIndex(root);
    const stack = [""];
    while (stack.length > 0) {
      const rel = stack.pop() ?? "";
      let entries;
      try {
        entries = readdirSync(path.join(root, rel), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (!e.name.startsWith(".")) stack.push(r);
        } else if (e.isFile() || e.isSymbolicLink()) {
          idx.add(r);
        }
      }
    }
    return idx;
  }

  static empty(root: string): VaultIndex {
    return new VaultIndex(root);
  }

  add(rel: string): void {
    const name = path.posix.basename(rel);
    if (name.toLowerCase().endsWith(".md")) addTo(this.stems, stemOf(name).toLowerCase(), rel);
    else addTo(this.files, name.toLowerCase(), rel);
  }

  remove(rel: string): void {
    const name = path.posix.basename(rel);
    if (name.toLowerCase().endsWith(".md")) removeFrom(this.stems, stemOf(name).toLowerCase(), rel);
    else removeFrom(this.files, name.toLowerCase(), rel);
  }

  /** Every path a wikilink target resolves to. A folder-qualified target must match the path's tail. */
  matches(target: string): string[] {
    const t = target.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
    const name = path.posix.basename(t);
    const qualified = t.includes("/");
    const tail = (paths: string[], suffix: string): string[] =>
      qualified ? paths.filter((p) => `/${p.toLowerCase()}`.endsWith(`/${suffix}`)) : paths;
    const ext = EXT.exec(name)?.[1]?.toLowerCase();
    if (ext && ext !== "md") {
      const byFile = tail(this.files.get(name) ?? [], t);
      if (byFile.length > 0) return byFile;
    }
    const stemTarget = ext === "md" ? t : `${t}.md`;
    return tail(this.stems.get(stemOf(name)) ?? [], stemTarget);
  }

  resolves(target: string): boolean {
    return this.matches(target).length > 0;
  }

  /** Paths of .md notes with this stem (case-insensitive). */
  stemPaths(stem: string): string[] {
    return this.stems.get(stem.toLowerCase()) ?? [];
  }

  /** `base` if no other note has that stem, else base-2, base-3, ... (REQ-022). */
  uniqueStem(base: string, exclude: string[] = []): string {
    const free = (s: string): boolean => this.stemPaths(s).every((p) => exclude.includes(p));
    if (free(base)) return base;
    for (let n = 2; ; n++) if (free(`${base}-${n}`)) return `${base}-${n}`;
  }

  /** Unique `<base>[-N].<ext>` for a non-.md file, against both filenames and note stems. */
  uniqueFileName(base: string, ext: string, exclude: string[] = []): string {
    if (ext.toLowerCase() === "md") return `${this.uniqueStem(base, exclude)}.md`;
    const free = (s: string): boolean =>
      (this.files.get(`${s}.${ext}`.toLowerCase()) ?? []).every((p) => exclude.includes(p)) &&
      this.stemPaths(`${s}.${ext}`).every((p) => exclude.includes(p));
    if (free(base)) return `${base}.${ext}`;
    for (let n = 2; ; n++) if (free(`${base}-${n}`)) return `${base}-${n}.${ext}`;
  }
}

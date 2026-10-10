// Capture listing, classification, holds and ordering (DES-004).
import { lstat, readFile, readdir, readlink, stat } from "node:fs/promises";
import path from "node:path";
import { splitFrontmatter } from "./frontmatter.ts";
import { sha256 } from "./journal.ts";
import type { OpenAsk } from "./asks.ts";

export const CAPTURE_DIR = "00-inbox/capture";
export const MAX_ITEMS_PER_RUN = 10;

const WORD = /\p{L}[\p{L}\p{N}'-]*|\p{N}+/gu;

export function countWords(text: string): number {
  return (text.match(WORD) ?? []).length;
}

export type Classification =
  | { kind: "supported"; ext: "md" | "txt"; text: string }
  | { kind: "unsupported"; detail: string }
  | { kind: "empty" };

export interface CaptureItem {
  /** Filename inside the capture folder. */
  name: string;
  /** Repo-relative path. */
  rel: string;
  mtimeNs: bigint;
  /** SHA-256 of the content, or of the link target for a symlink (never read through). */
  sha: string;
  classification: Classification;
}

/** "PDF captures aren't supported yet" style detail, or the symlink wording. */
function unsupportedDetail(name: string): string {
  const ext = path.extname(name).slice(1);
  return ext ? `${ext.toUpperCase()} captures aren't supported yet` : "files without a .md or .txt extension aren't supported yet";
}

export async function listCapture(root: string): Promise<CaptureItem[]> {
  const dir = path.join(root, CAPTURE_DIR);
  const items: CaptureItem[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "README.md" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) continue;
    const rel = `${CAPTURE_DIR}/${e.name}`;
    const abs = path.join(root, rel);
    const ls = await lstat(abs, { bigint: true });
    if (ls.isSymbolicLink() || !ls.isFile()) {
      const sha = ls.isSymbolicLink() ? sha256(`symlink:${await readlink(abs)}`) : sha256(`special:${e.name}`);
      items.push({ name: e.name, rel, mtimeNs: ls.mtimeNs, sha, classification: { kind: "unsupported", detail: "symlinks and special files aren't supported" } });
      continue;
    }
    const buf = await readFile(abs);
    const sha = sha256(buf);
    const ext = path.extname(e.name).slice(1).toLowerCase();
    if (ext !== "md" && ext !== "txt") {
      items.push({ name: e.name, rel, mtimeNs: ls.mtimeNs, sha, classification: { kind: "unsupported", detail: unsupportedDetail(e.name) } });
      continue;
    }
    const text = buf.toString("utf8");
    const body = splitFrontmatter(text).body;
    items.push({
      name: e.name, rel, mtimeNs: ls.mtimeNs, sha,
      classification: countWords(body) === 0 ? { kind: "empty" } : { kind: "supported", ext, text },
    });
  }
  return items;
}

export function isHeld(item: CaptureItem, asks: readonly OpenAsk[]): boolean {
  return asks.some((a) => a.item === item.name && a.sha === item.sha);
}

export interface Selection {
  selected: CaptureItem[];
  skippedHeld: number;
  /** Eligible items left for later runs (REQ-004). */
  deferred: number;
}

/** Eligible items oldest first by (mtime, name bytes), capped at 10 (REQ-003, REQ-004, REQ-005). */
export function select(items: readonly CaptureItem[], asks: readonly OpenAsk[], cap = MAX_ITEMS_PER_RUN): Selection {
  const eligible = items.filter((i) => !isHeld(i, asks));
  eligible.sort((a, b) => (a.mtimeNs < b.mtimeNs ? -1 : a.mtimeNs > b.mtimeNs ? 1 : Buffer.compare(Buffer.from(a.name), Buffer.from(b.name))));
  return { selected: eligible.slice(0, cap), skippedHeld: items.length - eligible.length, deferred: Math.max(0, eligible.length - cap) };
}

/** Current content hash of a capture item, or null if it's gone (D13 re-hash). */
export async function currentSha(root: string, item: CaptureItem): Promise<string | null> {
  const abs = path.join(root, item.rel);
  try {
    const ls = await lstat(abs);
    if (ls.isSymbolicLink()) return sha256(`symlink:${await readlink(abs)}`);
    if (!(await stat(abs)).isFile()) return sha256(`special:${item.name}`);
    return sha256(await readFile(abs));
  } catch {
    return null;
  }
}

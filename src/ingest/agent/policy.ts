// The agent's read policy (DES-010, D9). A deterministic function of the tool
// call and the read scope: the PreToolUse hook and canUseTool both call it, and
// it denies unless every rule for the tool passes.
//
// In scope: the resolved path (symlinks followed) is inside scope.root, not
// inside any scope.excluded directory, and no segment of its path relative to
// the root starts with "." (hidden folders at any depth, .git, .obsidian, ...).
// Searchable directory: in scope, and nothing beneath it is an excluded or
// hidden directory or a symlink, so a search tool can't walk anywhere the
// policy wouldn't allow a Read, whatever its own ignore rules are.
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import type { ReadScope, ToolDecision } from "./provider.ts";

export const MAX_READ_BYTES = 256 * 1024;
const MAX_WALK_ENTRIES = 50_000;
const READABLE_EXT = /\.(md|txt)$/i;

function deny(p: string, reason: string): ToolDecision {
  return { allowed: false, path: p, reason };
}

function str(input: unknown, key: string): string | undefined {
  if (input && typeof input === "object") {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

function isInside(child: string, parent: string): boolean {
  const r = path.relative(parent, child);
  return r === "" || (!r.startsWith("..") && !path.isAbsolute(r));
}

function display(scope: ReadScope, real: string): string {
  return isInside(real, scope.root) ? path.relative(scope.root, real).split(path.sep).join("/") || "." : real;
}

/** Resolve a path the agent supplied. Only absolute paths are accepted. */
function resolve(raw: string): string | null {
  if (!path.isAbsolute(raw)) return null;
  try {
    return realpathSync(raw);
  } catch {
    return null;
  }
}

export function inScope(real: string, scope: ReadScope): boolean {
  if (!isInside(real, scope.root)) return false;
  if (scope.excluded.some((ex) => isInside(real, ex))) return false;
  const rel = path.relative(scope.root, real);
  return rel === "" || !rel.split(path.sep).some((seg) => seg.startsWith("."));
}

/** True when `dir` is in scope and contains no excluded/hidden directory or symlink beneath it. */
export function searchable(dir: string, scope: ReadScope): boolean {
  if (!inScope(dir, scope)) return false;
  let seen = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    if (d === undefined) break;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      if (++seen > MAX_WALK_ENTRIES) return false;
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) return false;
      if (e.isDirectory()) {
        if (e.name.startsWith(".") || scope.excluded.some((ex) => isInside(ex, p) || isInside(p, ex))) return false;
        stack.push(p);
      }
    }
  }
  return true;
}

/** Glob rules: relative, no "..", no segment (or brace alternative) starting with ".", no "~". */
export function safePattern(pattern: string): boolean {
  if (pattern === "" || path.isAbsolute(pattern) || pattern.startsWith("~")) return false;
  if (pattern.includes("..")) return false;
  if (/(^|[/{,])\./.test(pattern)) return false;
  return !pattern.includes("\\");
}

function decideRead(input: unknown, scope: ReadScope): ToolDecision {
  const raw = str(input, "file_path");
  if (raw === undefined) return deny("", "no file_path");
  const real = resolve(raw);
  if (!real) return deny(raw, "path is not absolute or doesn't exist");
  const shown = display(scope, real);
  if (!inScope(real, scope)) return deny(shown, "outside the read scope");
  if (!READABLE_EXT.test(real)) return deny(shown, "only .md and .txt files may be read");
  const st = statSync(real);
  if (!st.isFile()) return deny(shown, "not a regular file");
  if (st.size > MAX_READ_BYTES) return deny(shown, "file larger than 256 KB");
  return { allowed: true, path: shown, reason: "ok" };
}

function decideSearch(input: unknown, scope: ReadScope, globKey: "pattern" | "glob", required: boolean): ToolDecision {
  const raw = str(input, "path");
  if (raw === undefined) return deny("", "path is required");
  const real = resolve(raw);
  if (!real) return deny(raw, "path is not absolute or doesn't exist");
  const shown = display(scope, real);
  let isDir: boolean;
  try {
    isDir = lstatSync(real).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) return deny(shown, "path is not a directory");
  if (!searchable(real, scope)) return deny(shown, "search would reach excluded or hidden folders");
  const pattern = str(input, globKey);
  if (pattern === undefined ? required : !safePattern(pattern)) return deny(shown, `unsafe ${globKey}`);
  return { allowed: true, path: shown, reason: "ok" };
}

export function decide(tool: string, input: unknown, scope: ReadScope): ToolDecision {
  switch (tool) {
    case "Read":
      return decideRead(input, scope);
    case "Glob":
      return decideSearch(input, scope, "pattern", true);
    case "Grep":
      return decideSearch(input, scope, "glob", false);
    default:
      return deny(str(input, "file_path") ?? str(input, "path") ?? "", `tool ${tool} is not allowed`);
  }
}

// Text-preserving edits for sign-off (DES-002, REQ-020): set frontmatter keys
// and merge entries into `## Changes`. Every other line stays as it was, byte
// for byte, including the note's line endings. Pure.
import { readFrontmatter } from "./frontmatter.ts";
import type { Change } from "./model.ts";
import { parseDetailed } from "./parse.ts";
import { frontmatterLine, oneLine } from "./render.ts";

interface Lines {
  lines: string[];
  eol: string;
}

function split(text: string): Lines {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { lines: text.split(/\r?\n/), eol };
}

const join = (l: Lines): string => l.lines.join(l.eol);

/**
 * Set frontmatter keys, in place where they already are (replacing any
 * continuation lines of their old value), otherwise added before the closing
 * fence in the order given. Throws if the note has no frontmatter.
 */
export function setFrontmatterKeys(text: string, entries: readonly (readonly [string, unknown])[]): string {
  const l = split(text);
  const fm = readFrontmatter(l.lines);
  if (!fm.present) throw new Error("setFrontmatterKeys: the note has no frontmatter");
  let close = fm.bodyStart - 1;
  for (const [key, value] of entries) {
    const line = frontmatterLine(key, value);
    const keyRe = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*:`);
    const at = l.lines.slice(1, close).findIndex((s) => keyRe.test(s));
    if (at < 0) {
      l.lines.splice(close, 0, line);
      close++;
      continue;
    }
    const i = at + 1;
    let end = i + 1;
    while (end < close && /^([ \t]|-[ \t]|-$)/.test(l.lines[end] ?? "")) end++;
    l.lines.splice(i, end - i, line);
    close -= end - i - 1;
  }
  return join(l);
}

const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const TOP_ITEM = /^[-*+](?:[ \t]|$)/;

/** The first `## Changes` section: its heading's index and where new items go, or null. */
function changesSection(lines: readonly string[], bodyStart: number): { heading: number; insertAt: number; hasItems: boolean } | null {
  let fence: string | null = null;
  let heading = -1;
  let lastItem = -1;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const f = FENCE.exec(line);
    if (fence !== null) {
      if (f && (f[1] ?? "").startsWith(fence)) fence = null;
      continue;
    }
    if (f) {
      fence = (f[1] ?? "").slice(0, 3);
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      if (heading >= 0) break; // any heading ends the part of the section that's read
      if ((h[1] ?? "").length === 2 && /^changes$/i.test((h[2] ?? "").trim())) heading = i;
      continue;
    }
    if (heading < 0) continue;
    if (TOP_ITEM.test(line)) lastItem = i;
    else if (lastItem >= 0 && /^[ \t]+\S/.test(line) && lastItem === i - 1) lastItem = i; // the item's continuation
  }
  if (heading < 0) return null;
  return lastItem >= 0 ? { heading, insertAt: lastItem + 1, hasItems: true } : { heading, insertAt: heading + 1, hasItems: false };
}

const changeKey = (c: Change): string => `${c.date}: ${oneLine(c.text)}`;

/**
 * Add `entries` to the note's `## Changes` section, after its last entry,
 * skipping any identical to an entry already there (or to an earlier one in
 * `entries`). Creates the section at the end of the note if it's absent.
 */
export function mergeChanges(text: string, entries: readonly Change[]): string {
  const seen = new Set(parseDetailed(text).changes.filter((c) => c.valid).map((c) => changeKey({ date: c.date ?? "", text: c.text })));
  const add: string[] = [];
  for (const e of entries) {
    const k = changeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    add.push(`- ${k}`);
  }
  if (add.length === 0) return text;
  const l = split(text);
  const fm = readFrontmatter(l.lines);
  const sec = changesSection(l.lines, fm.bodyStart);
  if (sec === null) {
    const endsWithNewline = l.lines.length > 0 && l.lines[l.lines.length - 1] === "";
    if (endsWithNewline) l.lines.pop();
    while (l.lines.length > 0 && l.lines[l.lines.length - 1]?.trim() === "") l.lines.pop();
    l.lines.push("", "## Changes", "", ...add, "");
    return join(l);
  }
  l.lines.splice(sec.insertAt, 0, ...(sec.hasItems ? add : ["", ...add]));
  // Keep a blank line between the new entries and a following heading or paragraph.
  const after = l.lines[sec.insertAt + (sec.hasItems ? add.length : add.length + 1)];
  if (!sec.hasItems && after !== undefined && after.trim() !== "") l.lines.splice(sec.insertAt + add.length + 1, 0, "");
  return join(l);
}

/** The sign-off edit: carry `changes` into the note, then set status, signed_off and updated. */
export function applySignOff(text: string, date: string, changes: readonly Change[]): string {
  return setFrontmatterKeys(mergeChanges(text, changes), [["status", "signed-off"], ["signed_off", date], ["updated", date]]);
}

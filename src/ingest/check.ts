// Per-item check (DES-016, REQ-024): runs after apply and before commit, and
// collects every problem. Any problem rolls the item back.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { checkBacklinkDiff } from "./backlinks.ts";
import { parseFrontmatter, splitFrontmatter } from "./frontmatter.ts";
import { sha256File, writtenPaths, type JournalOp } from "./journal.ts";
import { scanAsks } from "./asks.ts";
import { parseWikilinks, type VaultIndex } from "./vault.ts";

export interface IngestCheck {
  kind: "ingest";
  root: string;
  runDate: string;
  vault: VaultIndex;
  itemRel: string;
  itemName: string;
  itemSha: string;
  resourceRel: string;
  archivedRel: string;
  archivedLinkTarget: string;
  urls: readonly string[];
  /** Chosen targets: slug and path. */
  targets: readonly { slug: string; relPath: string }[];
  /** Pre-image of each modified target note. */
  pre: ReadonlyMap<string, Buffer>;
  resourceSlug: string;
  ops: readonly JournalOp[];
  allowed: ReadonlySet<string>;
}

export interface HoldCheck {
  kind: "hold";
  root: string;
  itemRel: string;
  itemName: string;
  itemSha: string;
  askRel: string;
  ops: readonly JournalOp[];
  allowed: ReadonlySet<string>;
}

function section(body: string, heading: string): string | null {
  const re = new RegExp(`^## ${heading}\\s*$`, "m");
  const m = re.exec(body);
  if (!m) return null;
  const rest = body.slice(m.index + m[0].length);
  const next = /^## /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function writeSet(ops: readonly JournalOp[], allowed: ReadonlySet<string>): string[] {
  return writtenPaths(ops).filter((p) => !allowed.has(p)).map((p) => `write outside the allowed set: ${p}`);
}

export async function checkIngest(c: IngestCheck): Promise<string[]> {
  const problems: string[] = [];
  const abs = (rel: string): string => path.join(c.root, rel);
  let text = "";
  try {
    text = await readFile(abs(c.resourceRel), "utf8");
  } catch {
    problems.push(`resource ${c.resourceRel} is missing`);
  }
  // 1. REQ-013 frontmatter.
  const split = splitFrontmatter(text);
  const fm = parseFrontmatter(split.yaml);
  const d = fm.data ?? {};
  if (!fm.data) problems.push(`resource frontmatter doesn't parse${fm.error ? ` (${fm.error})` : ""}`);
  else {
    if (d["name"] !== c.resourceSlug) problems.push("resource name doesn't equal its filename stem");
    const desc = d["description"];
    if (typeof desc !== "string" || desc.trim() === "" || /[\r\n]/.test(desc)) problems.push("resource description isn't one non-empty line");
    if (d["type"] !== "resource") problems.push("resource type isn't resource");
    if (d["created"] !== c.runDate || d["updated"] !== c.runDate) problems.push("resource created/updated aren't the run date");
  }
  // 2. REQ-014 and REQ-015 structure.
  const body = split.body;
  const summary = section(body, "Summary");
  if (!summary || summary.trim() === "") problems.push("resource has no summary");
  const takeaways = section(body, "Key takeaways");
  if (!takeaways || !/^- \S/m.test(takeaways)) problems.push("resource has no key takeaway");
  const source = section(body, "Source") ?? "";
  if (!source.includes(`[[${c.archivedLinkTarget}]]`)) problems.push("source section doesn't link the archived original");
  for (const u of c.urls) if (!source.includes(`<${u}>`)) problems.push(`source section doesn't list ${u}`);
  const related = section(body, "Related") ?? "";
  if (c.targets.length === 0 || !c.targets.every((t) => related.includes(`[[${t.slug}]]`))) problems.push("resource doesn't link every placement target");
  // 3. Links resolve (the vault as it is after apply).
  for (const l of parseWikilinks(body)) if (!c.vault.resolves(l.target)) problems.push(`unresolved [[${l.target}]]`);
  if (!c.vault.resolves(c.resourceSlug)) problems.push(`unresolved [[${c.resourceSlug}]]`);
  // 4. Item state.
  if ((await sha256File(abs(c.itemRel))) !== null) problems.push(`${c.itemName} is still in the capture folder`);
  if ((await sha256File(abs(c.archivedRel))) !== c.itemSha) problems.push(`archived ${c.archivedRel} doesn't have the item's original hash`);
  const archivedMatches = c.vault.matches(c.archivedLinkTarget);
  if (archivedMatches.length !== 1 || archivedMatches[0] !== c.archivedRel) problems.push("the source link doesn't resolve to exactly the archived original");
  // 5. Exact diffs.
  for (const t of c.targets) {
    const pre = c.pre.get(t.relPath);
    if (!pre) continue; // already linked: nothing written
    const post = await readFile(abs(t.relPath), "utf8").catch(() => "");
    const problem = checkBacklinkDiff(pre.toString("utf8"), post, c.resourceSlug);
    if (problem) problems.push(`${t.relPath}: ${problem}`);
  }
  // 6. Write set.
  problems.push(...writeSet(c.ops, c.allowed));
  return problems;
}

export async function checkHold(c: HoldCheck): Promise<string[]> {
  const problems: string[] = [];
  if ((await sha256File(path.join(c.root, c.itemRel))) !== c.itemSha) problems.push(`${c.itemName} isn't in place with its original hash`);
  const asks = (await scanAsks(c.root)).filter((a) => a.item === c.itemName && a.sha === c.itemSha);
  if (asks.length !== 1 || asks[0]?.rel !== c.askRel) problems.push(`expected exactly one open ask for ${c.itemName}, found ${String(asks.length)}`);
  problems.push(...writeSet(c.ops, c.allowed));
  return problems;
}

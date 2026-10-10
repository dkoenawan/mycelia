// Ask notes and hold state (DES-005, D5). An ask is the operator's one queue
// entry for one capture item; its frontmatter is the visible hold state.
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readFrontmatter, renderFrontmatter } from "./frontmatter.ts";
import type { Ledger } from "./ledger.ts";
import type { PlanOp } from "./journal.ts";
import type { VaultIndex } from "./vault.ts";

export const INBOX_DIR = "00-inbox";
export const ARCHIVE_CAPTURE_DIR = "40-archive/capture";

export type AskReason = "no-fit" | "empty" | "fetch-failed" | "unsupported" | "check-failed";

export interface OpenAsk {
  rel: string;
  item: string;
  sha: string;
  reason: string;
  created: string;
}

/** Asks in 00-inbox/ (directly, not the capture folder). Reads frontmatter only (REQ-002). */
export async function scanAsks(root: string): Promise<OpenAsk[]> {
  const asks: OpenAsk[] = [];
  for (const e of await readdir(path.join(root, INBOX_DIR), { withFileTypes: true })) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith(".md") || e.name === "README.md") continue;
    const rel = `${INBOX_DIR}/${e.name}`;
    const fm = await readFrontmatter(path.join(root, rel));
    const d = fm.data;
    if (!d || typeof d["ingest_item"] !== "string" || typeof d["ingest_sha256"] !== "string") continue;
    asks.push({
      rel,
      item: d["ingest_item"],
      sha: d["ingest_sha256"],
      reason: typeof d["ingest_reason"] === "string" ? d["ingest_reason"] : "",
      created: typeof d["created"] === "string" ? d["created"] : "",
    });
  }
  return asks.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

/** Open asks for this item that the ingester may modify or move: carry ingest_item and the ledger shows it created them. */
export function ownedAsks(item: string, asks: readonly OpenAsk[], ledger: Ledger): OpenAsk[] {
  return asks.filter((a) => a.item === item && ledger.ownsAsk(a.rel));
}

export function itemStem(name: string): string {
  const ext = path.extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/** A link to the capture item, or an inert code span when its name can't be a wikilink. */
export function itemLink(name: string): string {
  if (/[[\]|#^`\n]/.test(name)) return `\`${name.replace(/`/g, "'")}\``;
  return name.toLowerCase().endsWith(".md") ? `[[${itemStem(name)}]]` : `[[${name}]]`;
}

function codeSpan(s: string): string {
  return `\`${s.replace(/[`\r\n]+/g, " ").trim()}\``;
}

export interface AskDetails {
  reason: AskReason;
  /** no-fit: up to 3 slugs the agent named as closest. */
  closest?: string[];
  /** fetch-failed: each URL with its failure. */
  failures?: { url: string; error: string }[];
  /** unsupported: the detail line. */
  detail?: string;
  /** check-failed: the last failure reason. */
  lastFailure?: string;
  /** check-failed: raised by recovery, because an interrupted run couldn't be undone safely. */
  interrupted?: boolean;
}

const RESOLVE_PLACE = [
  "Add an `[[area-or-project]]` link to the capture, naming where it belongs.",
  "Or create the area or project note it needs, then delete this ask.",
  "Or delete the capture to discard it.",
];

export function askDescription(name: string, d: AskDetails): string {
  switch (d.reason) {
    case "no-fit": return `Capture ${name} needs a home: no area or project fitted`;
    case "empty": return `Capture ${name} is empty: nothing to ingest`;
    case "fetch-failed": return `Capture ${name} couldn't be ingested: a link in it couldn't be fetched`;
    case "unsupported": return `Capture ${name} wasn't ingested: ${d.detail ?? "unsupported file type"}`;
    case "check-failed":
      return d.interrupted ? `Capture ${name} was interrupted mid-run and couldn't be undone safely` : `Capture ${name} failed its check on 3 consecutive runs`;
  }
}

export function askBody(name: string, d: AskDetails): string {
  const link = itemLink(name);
  const lines: string[] = [];
  switch (d.reason) {
    case "no-fit":
      lines.push(`Capture ${link} couldn't be placed: no area or project fitted.`, "", "To resolve it:", "", ...RESOLVE_PLACE.map((r) => `- ${r}`));
      if (d.closest && d.closest.length > 0) lines.push("", `Closest matches: ${d.closest.slice(0, 3).map(codeSpan).join(", ")}`);
      break;
    case "empty":
      lines.push(`Capture ${link} is empty, so there was nothing to ingest. No area or project fitted an empty note.`, "", "To resolve it:", "", ...RESOLVE_PLACE.map((r) => `- ${r}`));
      break;
    case "fetch-failed":
      lines.push(`Capture ${link} couldn't be ingested: a link in it couldn't be fetched.`, "");
      for (const f of d.failures ?? []) lines.push(`- ${codeSpan(f.url)}: ${f.error}`);
      lines.push("", "To resolve it:", "", "- Paste the text into the capture.", "- Or fix the URL.", "- Or delete the capture to discard it.");
      break;
    case "unsupported":
      lines.push(`Capture ${link} wasn't ingested: ${d.detail ?? "unsupported file type"}.`, "", "To resolve it:", "",
        "- Convert it to a `.md` or `.txt` file in the capture folder (file captures are planned, #17).", "- Or delete it.");
      break;
    case "check-failed":
      if (d.interrupted) {
        lines.push(`Capture ${link} was interrupted mid-run, and the ingester couldn't undo it safely because files it had written were edited afterwards. Nothing was overwritten, and the ingester stops until this is resolved.`, "",
          `Details: ${codeSpan(d.lastFailure ?? "unknown")}`, "", "To resolve it:", "",
          "- Check the files named above, and keep or delete the half-written changes yourself.",
          "- Then delete `.state/ingest-inbox/journal.json` and this ask.");
        break;
      }
      lines.push(`Capture ${link} failed its check on 3 consecutive runs, so it's held until you act.`, "",
        `Last failure: ${codeSpan(d.lastFailure ?? "unknown")}`, "", "To resolve it:", "", "- Edit the capture.", "- Or delete this ask to retry it as it is.");
      break;
  }
  return `${lines.join("\n")}\n`;
}

export function renderAsk(o: { stem: string; created: string; updated: string; item: string; sha: string; details: AskDetails }): string {
  const fm = renderFrontmatter([
    ["name", o.stem],
    ["description", askDescription(o.item, o.details)],
    ["type", "reference"],
    ["created", o.created],
    ["updated", o.updated],
    ["ingest_item", o.item],
    ["ingest_sha256", o.sha],
    ["ingest_reason", o.details.reason],
  ]);
  return `${fm}\n${askBody(o.item, o.details)}`;
}

/**
 * Plan the one ask for a held item (D5): rewrite the owned open ask in place
 * (keeping created:), or create a new one with a vault-unique name.
 */
export function planAsk(o: {
  item: string; sha: string; runDate: string; details: AskDetails;
  asks: readonly OpenAsk[]; ledger: Ledger; vault: VaultIndex;
}): { op: PlanOp; rel: string } {
  const owned = ownedAsks(o.item, o.asks, o.ledger)[0];
  if (owned) {
    const stem = path.posix.basename(owned.rel, ".md");
    const content = renderAsk({ stem, created: owned.created || o.runDate, updated: o.runDate, item: o.item, sha: o.sha, details: o.details });
    return { op: { op: "modify", path: owned.rel, content }, rel: owned.rel };
  }
  const stem = o.vault.uniqueStem(`${o.runDate}-ingest-${itemStem(o.item)}`);
  const rel = `${INBOX_DIR}/${stem}.md`;
  const content = renderAsk({ stem, created: o.runDate, updated: o.runDate, item: o.item, sha: o.sha, details: o.details });
  return { op: { op: "create", path: rel, content }, rel };
}

/** Move each owned open ask for an ingested item to 40-archive/capture/, unchanged (REQ-023). */
export function planResolvedAsks(item: string, asks: readonly OpenAsk[], ledger: Ledger, vault: VaultIndex): { ops: PlanOp[]; dsts: string[] } {
  const ops: PlanOp[] = [];
  const dsts: string[] = [];
  for (const a of ownedAsks(item, asks, ledger)) {
    const stem = vault.uniqueStem(path.posix.basename(a.rel, ".md"), [a.rel]);
    const dst = `${ARCHIVE_CAPTURE_DIR}/${stem}.md`;
    ops.push({ op: "move", src: a.rel, dst });
    dsts.push(dst);
    vault.remove(a.rel);
    vault.add(dst);
  }
  return { ops, dsts };
}

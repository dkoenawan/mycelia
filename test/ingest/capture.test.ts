import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, utimesSync } from "node:fs";
import path from "node:path";
import { listCapture, select } from "../../src/ingest/capture.ts";
import { itemLink, planAsk, planResolvedAsks, renderAsk, scanAsks } from "../../src/ingest/asks.ts";
import { Ledger } from "../../src/ingest/ledger.ts";
import { parseFrontmatter, splitFrontmatter } from "../../src/ingest/frontmatter.ts";
import { VaultIndex } from "../../src/ingest/vault.ts";
import { tempVault } from "../helpers/vault.ts";

const contentOf = (op: { op: string } & Partial<{ content: string | Buffer }>): string => String(op.content ?? "");
const T = (s: string): Date => new Date(`2026-10-01T${s}:00Z`);

test("REQ-001/003: only capture items, oldest first, ties by name bytes", async () => {
  const v = tempVault({
    "00-inbox/2026-10-01-renew-cert.md": "---\nname: x\n---\ndecision",
    "00-inbox/capture/b.md": "bee text",
    "00-inbox/capture/a.md": "ay text",
    "00-inbox/capture/c.md": "see text",
    "00-inbox/capture/.hidden.md": "x",
    "00-inbox/capture/sub/nested.md": "x",
  });
  try {
    utimesSync(path.join(v.root, "00-inbox/capture/b.md"), T("09:00"), T("09:00"));
    utimesSync(path.join(v.root, "00-inbox/capture/a.md"), T("10:00"), T("10:00"));
    utimesSync(path.join(v.root, "00-inbox/capture/c.md"), T("10:00"), T("10:00"));
    const items = await listCapture(v.root);
    assert.deepEqual(items.map((i) => i.name).sort(), ["a.md", "b.md", "c.md"]);
    assert.deepEqual(select(items, []).selected.map((i) => i.name), ["b.md", "a.md", "c.md"]);
  } finally { v.done(); }
});

test("REQ-004: at most 10 per run, the rest deferred", async () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 12; i++) files[`00-inbox/capture/item-${String(i).padStart(2, "0")}.md`] = `item ${i}`;
  const v = tempVault(files);
  try {
    for (let i = 0; i < 12; i++) {
      const t = new Date(Date.UTC(2026, 9, 1, 6, i));
      utimesSync(path.join(v.root, `00-inbox/capture/item-${String(i).padStart(2, "0")}.md`), t, t);
    }
    const s = select(await listCapture(v.root), []);
    assert.equal(s.selected.length, 10);
    assert.equal(s.deferred, 2);
    assert.deepEqual(s.selected.map((i) => i.name).at(-1), "item-09.md");
  } finally { v.done(); }
});

test("REQ-007 and DES-004: unsupported types, symlinks and empty notes are classified", async () => {
  const v = tempVault({
    "00-inbox/capture/slides.pdf": "%PDF",
    "00-inbox/capture/blank.md": "---\nname: blank\n---\n\n  \n",
    "00-inbox/capture/notes.TXT": "some text",
    "control/estate.local.yaml": "secret",
  });
  try {
    symlinkSync(path.join(v.root, "control/estate.local.yaml"), path.join(v.root, "00-inbox/capture/link.md"));
    const byName = Object.fromEntries((await listCapture(v.root)).map((i) => [i.name, i.classification]));
    assert.deepEqual(byName["slides.pdf"], { kind: "unsupported", detail: "PDF captures aren't supported yet" });
    assert.equal(byName["link.md"]?.kind, "unsupported");
    assert.deepEqual(byName["blank.md"], { kind: "empty" });
    assert.equal(byName["notes.TXT"]?.kind, "supported");
  } finally { v.done(); }
});

test("REQ-005/006: a held item is skipped and not counted; an edit or a removed ask makes it eligible", async () => {
  const v = tempVault({ "00-inbox/capture/thin-post.md": "https://example.org/x", "00-inbox/capture/other.md": "other text" });
  try {
    const items = await listCapture(v.root);
    const thin = items.find((i) => i.name === "thin-post.md");
    assert.ok(thin);
    const asks = [{ rel: "00-inbox/2026-10-01-ingest-thin-post.md", item: "thin-post.md", sha: thin.sha, reason: "fetch-failed", created: "2026-10-01" }];
    const s = select(items, asks, 1);
    assert.deepEqual(s.selected.map((i) => i.name), ["other.md"]);
    assert.equal(s.skippedHeld, 1);
    v.write("00-inbox/capture/thin-post.md", "https://example.org/x [[recreation]]");
    assert.equal(select(await listCapture(v.root), asks).skippedHeld, 0);
    assert.equal(select(items, []).skippedHeld, 0);
  } finally { v.done(); }
});

test("asks: rendering, scanning, rewrite in place, ownership, archive on resolve", async () => {
  const v = tempVault({ "00-inbox/2026-10-01-renew-cert.md": "---\nname: renew\ningest_item: sourdough.md\ningest_sha256: aaa\n---\nnot ours" });
  try {
    mkdirSync(path.join(v.root, ".state"), { recursive: true });
    const ledger = new Ledger(path.join(v.root, ".state/ledger.jsonl"));
    const vault = VaultIndex.build(v.root);
    const details = { reason: "no-fit" as const, closest: ["career", "health"] };
    const first = planAsk({ item: "sourdough.md", sha: "s1", runDate: "2026-10-01", details, asks: await scanAsks(v.root), ledger, vault });
    assert.equal(first.rel, "00-inbox/2026-10-01-ingest-sourdough.md");
    assert.equal(first.op.op, "create");
    const content = contentOf(first.op);
    const fm = parseFrontmatter(splitFrontmatter(content).yaml).data ?? {};
    assert.equal(fm["description"], "Capture sourdough.md needs a home: no area or project fitted");
    assert.equal(fm["ingest_reason"], "no-fit");
    assert.match(content, /\[\[sourdough\]\]/);
    assert.match(content, /`\[\[area-or-project\]\]`/);
    assert.match(content, /delete this ask/);
    assert.match(content, /delete the capture/);
    assert.match(content, /Closest matches: `career`, `health`/);
    v.write(first.rel, content);
    vault.add(first.rel);
    // Not yet owned: the ledger has no record of creating it, so a new one is planned.
    const asks = await scanAsks(v.root);
    assert.equal(asks.length, 2, "the operator's note carrying ingest_ keys is still seen for holds");
    assert.equal(planAsk({ item: "sourdough.md", sha: "s2", runDate: "2026-10-02", details, asks, ledger, vault }).rel, "00-inbox/2026-10-02-ingest-sourdough.md");
    await ledger.append({ event: "item", run: "r", item: "sourdough.md", sha256: "s1", outcome: "held", reason: "no-fit", ask: first.rel });
    const again = planAsk({ item: "sourdough.md", sha: "s2", runDate: "2026-10-02", details: { reason: "empty" }, asks, ledger, vault });
    assert.equal(again.rel, first.rel);
    assert.equal(again.op.op, "modify");
    const rewritten = parseFrontmatter(splitFrontmatter(contentOf(again.op)).yaml).data ?? {};
    assert.equal(rewritten["created"], "2026-10-01");
    assert.equal(rewritten["updated"], "2026-10-02");
    assert.equal(rewritten["ingest_sha256"], "s2");
    const resolved = planResolvedAsks("sourdough.md", asks, ledger, vault);
    assert.deepEqual(resolved.ops, [{ op: "move", src: first.rel, dst: "40-archive/capture/2026-10-01-ingest-sourdough.md" }]);
  } finally { v.done(); }
});

test("ask wording per reason, and item links that can't be wikilinks", () => {
  const base = { stem: "s", created: "2026-10-01", updated: "2026-10-01", sha: "x" };
  assert.match(renderAsk({ ...base, item: "post.md", details: { reason: "fetch-failed", failures: [{ url: "https://example.org/gone", error: "HTTP 404" }] } }), /`https:\/\/example.org\/gone`: HTTP 404/);
  assert.match(renderAsk({ ...base, item: "slides.pdf", details: { reason: "unsupported", detail: "PDF captures aren't supported yet" } }), /\[\[slides\.pdf\]\] wasn't ingested: PDF captures aren't supported yet/);
  assert.match(renderAsk({ ...base, item: "odd.txt", details: { reason: "check-failed", lastFailure: "unresolved [[nonexistent-area]]" } }), /\[\[odd\.txt\]\][\s\S]*`unresolved \[\[nonexistent-area\]\]`/);
  assert.equal(itemLink("weird]]name.md"), "`weird]]name.md`");
});

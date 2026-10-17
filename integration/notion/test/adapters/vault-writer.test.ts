// Vault writer adapter (DES-010).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { scanAsks } from "../../../../src/ingest/asks.ts";
import { REPO_ROOT } from "../../../../src/lib/paths.ts";
import { tempVault } from "../../../../test/helpers/vault.ts";
import { FsVaultWriter } from "../../src/adapters/vault/vault-writer.ts";
import { renderStoppedAsk, stoppedAskBase } from "../../src/domain/stopped-ask.ts";

test("capture items are created exclusively and hashed", async () => {
  const v = tempVault();
  try {
    const w = new FsVaultWriter(v.root);
    assert.equal(await w.captureExists("a.md"), false);
    const sha = await w.writeCapture("a.md", "hello\n");
    assert.equal(sha, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03");
    assert.equal(await w.captureExists("a.md"), true);
    await assert.rejects(w.writeCapture("a.md", "again\n"), (e: unknown) => (e as NodeJS.ErrnoException).code === "EEXIST");
    await assert.rejects(w.writeCapture("../escape.md", "x"));
    assert.equal(readFileSync(path.join(v.root, "00-inbox/capture/a.md"), "utf8"), "hello\n");
  } finally { v.done(); }
});

test("a capture item's source_id is read from its frontmatter; null when missing or absent", async () => {
  const v = tempVault();
  try {
    const w = new FsVaultWriter(v.root);
    assert.equal(await w.captureSourceId("none.md"), null);
    await w.writeCapture("a.md", '---\nsource: notion\nsource_id: "row-1"\n---\n\n# A\n');
    assert.equal(await w.captureSourceId("a.md"), "row-1");
    await w.writeCapture("b.md", "hand-dropped, no frontmatter\n");
    assert.equal(await w.captureSourceId("b.md"), null);
  } finally { v.done(); }
});

test("hint targets: areas and projects only", async () => {
  const v = tempVault({ "20-areas/career.md": "x", "10-projects/garden.md": "x" });
  try {
    const w = new FsVaultWriter(v.root);
    assert.equal(await w.hintTargetExists("career"), true);
    assert.equal(await w.hintTargetExists("garden"), true);
    assert.equal(await w.hintTargetExists("health"), false);
    assert.equal(await w.hintTargetExists("../control/x"), false);
  } finally { v.done(); }
});

test("the stopped ask: unique name, note format, invisible to the ingester's ask scan (REQ-018)", async () => {
  const v = tempVault({ "00-inbox/README.md": "readme", "00-inbox/2026-10-12-notion-stopped-notes.md": "taken" });
  try {
    const w = new FsVaultWriter(v.root);
    const stem = await w.uniqueAskStem(stoppedAskBase("2026-10-12", "Notes"));
    assert.equal(stem, "2026-10-12-notion-stopped-notes-2");
    const rel = await w.writeAsk(stem, renderStoppedAsk({ stem, date: "2026-10-12", row: { id: "row-1", title: "Notes" }, reason: "couldn't read the row" }));
    const text = readFileSync(path.join(v.root, rel), "utf8");
    assert.ok(text.startsWith(`---\nname: ${stem}\n`));
    assert.ok(text.includes("source: notion\nsource_id: \"row-1\""));
    assert.ok(text.includes("set its Status to New to retry"));
    assert.ok(text.includes("couldn't read the row"));
    assert.deepEqual(await scanAsks(v.root), []);
    await assert.rejects(w.writeAsk(stem, "x"));
  } finally { v.done(); }
});

test("daily block appends; probes pass with the framework's .gitignore and fail without it", async () => {
  const v = tempVault();
  try {
    const w = new FsVaultWriter(v.root);
    await w.appendDaily("2026-10-12", "## Phone capture (06:00 UTC)\n");
    assert.ok(readFileSync(path.join(v.root, "daily/2026-10-12.md"), "utf8").endsWith("## Phone capture (06:00 UTC)\n"));
    execFileSync("git", ["init", "-q"], { cwd: v.root });
    assert.equal((await w.unignoredPaths()).length, 4);
    copyFileSync(path.join(REPO_ROOT, ".gitignore"), path.join(v.root, ".gitignore"));
    assert.deepEqual(await w.unignoredPaths(), []);
  } finally { v.done(); }
});

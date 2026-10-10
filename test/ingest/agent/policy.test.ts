import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { decide, safePattern } from "../../../src/ingest/agent/policy.ts";
import type { ReadScope } from "../../../src/ingest/agent/provider.ts";

// A throwaway vault: root/{20-areas,docs/sub,control,.state,.git,node_modules,30-resources/.hidden}
function vault(): { root: string; outside: string; scope: ReadScope; done: () => void } {
  const base = realpathSync(mkdtempSync(path.join(os.tmpdir(), "mycelia-policy-")));
  const root = path.join(base, "vault");
  const outside = path.join(base, "outside");
  const files: Record<string, string> = {
    "20-areas/career.md": "career",
    "20-areas/notes.txt": "text",
    "20-areas/image.png": "png",
    "docs/sub/guide.md": "guide",
    "control/estate.local.yaml": "secret",
    "control/notes.md": "secret note",
    ".state/ingest-inbox/ledger.jsonl": "{}",
    ".git/config": "[core]",
    "node_modules/pkg/README.md": "pkg",
    "30-resources/.hidden/x.md": "hidden",
    "30-resources/r.md": "resource",
    "10-projects/big.md": "x".repeat(256 * 1024 + 1),
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), body);
  }
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(outside, "secret.md"), "outside");
  mkdirSync(path.join(root, "40-archive"), { recursive: true });
  symlinkSync(path.join(root, "control", "notes.md"), path.join(root, "20-areas", "link-to-control.md"));
  symlinkSync(path.join(outside, "secret.md"), path.join(root, "docs", "link-outside.md"));
  symlinkSync(path.join(root, "control"), path.join(root, "40-archive", "ctl"));
  const scope: ReadScope = {
    root,
    excluded: ["control", ".state", "node_modules"].map((d) => path.join(root, d)),
  };
  return { root, outside, scope, done: () => { rmSync(base, { recursive: true, force: true }); } };
}

test("Read: in-scope .md and .txt notes are allowed", () => {
  const v = vault();
  try {
    assert.equal(decide("Read", { file_path: path.join(v.root, "20-areas/career.md") }, v.scope).allowed, true);
    assert.equal(decide("Read", { file_path: path.join(v.root, "20-areas/notes.txt") }, v.scope).allowed, true);
    assert.equal(decide("Read", { file_path: path.join(v.root, "docs/sub/guide.md") }, v.scope).path, "docs/sub/guide.md");
  } finally { v.done(); }
});

test("Read: excluded, hidden, outside, traversal, symlinked, non-note and oversize paths are denied", () => {
  const v = vault();
  try {
    const denied = (p: string): void => {
      assert.equal(decide("Read", { file_path: p }, v.scope).allowed, false, p);
    };
    denied(path.join(v.root, "control/estate.local.yaml"));
    denied(path.join(v.root, "control/notes.md"));
    denied(path.join(v.root, ".state/ingest-inbox/ledger.jsonl"));
    denied(path.join(v.root, ".git/config"));
    denied(path.join(v.root, "node_modules/pkg/README.md"));
    denied(path.join(v.root, "30-resources/.hidden/x.md"));
    denied(path.join(v.outside, "secret.md"));
    denied(path.join(v.root, "20-areas/../control/notes.md"));
    denied(path.join(v.root, "20-areas/link-to-control.md"));
    denied(path.join(v.root, "docs/link-outside.md"));
    denied(path.join(v.root, "40-archive/ctl/notes.md"));
    denied(path.join(v.root, "20-areas/image.png"));
    denied(path.join(v.root, "10-projects/big.md"));
    denied(path.join(v.root, "20-areas"));
    denied("20-areas/career.md");
    denied("~/secret.md");
    denied("/etc/passwd");
    assert.equal(decide("Read", {}, v.scope).allowed, false);
  } finally { v.done(); }
});

test("Glob and Grep: allowed only on searchable folders below the root", () => {
  const v = vault();
  try {
    assert.equal(decide("Glob", { pattern: "**/*.md", path: path.join(v.root, "20-areas") }, v.scope).allowed, false, "symlink beneath");
    assert.equal(decide("Glob", { pattern: "**/*.md", path: path.join(v.root, "docs/sub") }, v.scope).allowed, true);
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "docs/sub") }, v.scope).allowed, true);
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "docs/sub"), glob: "*.md" }, v.scope).allowed, true);
    // The repository root contains control/, .state/, .git/ and node_modules/.
    assert.equal(decide("Glob", { pattern: "**/*.md", path: v.root }, v.scope).allowed, false);
    assert.equal(decide("Grep", { pattern: "secret", path: v.root }, v.scope).allowed, false);
    // A folder with a hidden folder beneath it.
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "30-resources") }, v.scope).allowed, false);
    // A folder with a symlink into control/ beneath it.
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "40-archive") }, v.scope).allowed, false);
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "control") }, v.scope).allowed, false);
    assert.equal(decide("Grep", { pattern: "x", path: v.outside }, v.scope).allowed, false);
    assert.equal(decide("Grep", { pattern: "x" }, v.scope).allowed, false, "path is required");
    assert.equal(decide("Glob", { pattern: "*.md" }, v.scope).allowed, false, "path is required");
    assert.equal(decide("Glob", { pattern: "*.md", path: "docs" }, v.scope).allowed, false, "relative path");
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "docs/sub/guide.md") }, v.scope).allowed, false, "file, not a folder");
    assert.equal(decide("Grep", { pattern: "x", path: path.join(v.root, "docs/sub"), glob: "../control/*" }, v.scope).allowed, false);
  } finally { v.done(); }
});

test("Glob patterns: no traversal, hidden segments, absolute paths or ~", () => {
  for (const ok of ["*.md", "**/*.md", "sub/*.txt", "{a,b}/*.md"]) assert.equal(safePattern(ok), true, ok);
  for (const bad of ["../*.md", "a/../../b", ".git/*", "**/.obsidian/*", "{x,.git}/*", "/etc/*", "~/*.md", "", "a\\..\\b"]) {
    assert.equal(safePattern(bad), false, bad);
  }
});

test("every other tool is denied", () => {
  const v = vault();
  try {
    for (const tool of ["Bash", "Write", "Edit", "NotebookEdit", "WebFetch", "WebSearch", "Task", "Agent", "TodoWrite", "mcp__x__y", "StructuredOutput"]) {
      assert.equal(decide(tool, { file_path: path.join(v.root, "20-areas/career.md"), command: "ls" }, v.scope).allowed, false, tool);
    }
  } finally { v.done(); }
});

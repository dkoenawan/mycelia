import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { stamp } from "../../src/lib/log.ts";
import { utcDate, utcStamp, utcTime } from "../../src/lib/dates.ts";
import { resolveClaude } from "../../src/lib/claude-bin.ts";
import { REPO_ROOT, rel } from "../../src/lib/paths.ts";

test("log stamp matches common.sh's format", () => {
  assert.equal(stamp(new Date("2026-10-01T06:00:04.123Z")), "[2026-10-01 06:00:04 UTC]");
});

test("UTC date helpers", () => {
  const d = new Date("2026-10-01T23:59:58.900Z");
  assert.equal(utcDate(d), "2026-10-01");
  assert.equal(utcTime(d), "23:59");
  assert.equal(utcStamp(d), "2026-10-01T23:59:58Z");
});

test("REPO_ROOT is the repository root", () => {
  assert.equal(path.basename(path.join(REPO_ROOT, "Taskfile.yml")), "Taskfile.yml");
  assert.equal(rel(REPO_ROOT, path.join(REPO_ROOT, "a", "b.md")), "a/b.md");
});

test("resolveClaude follows common.sh's search order", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mycelia-claude-"));
  try {
    const mk = (p: string): string => {
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, "#!/bin/sh\n");
      chmodSync(p, 0o755);
      return p;
    };
    const explicit = mk(path.join(dir, "explicit", "claude"));
    const onPath = mk(path.join(dir, "bin", "claude"));
    const local = mk(path.join(dir, "home", ".local", "bin", "claude"));
    const home = path.join(dir, "home");
    assert.equal(resolveClaude({ CLAUDE_BIN: explicit, PATH: path.dirname(onPath), HOME: home }), explicit);
    assert.equal(resolveClaude({ PATH: path.dirname(onPath), HOME: home }), onPath);
    assert.equal(resolveClaude({ PATH: path.join(dir, "none"), HOME: home }), local);
    const missing = resolveClaude({ CLAUDE_BIN: path.join(dir, "nope"), PATH: "", HOME: path.join(dir, "empty") });
    assert.ok(missing === null || missing === "/usr/local/bin/claude");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

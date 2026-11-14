// DES-008: 01-vision/ ships its README only, and every goals note stays out of git (REQ-016).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../src/lib/paths.ts";

function ignored(rel: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", rel], { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

test("REQ-016: goals notes in 01-vision/, the inbox and the archive are gitignored", () => {
  for (const rel of ["01-vision/2027-goals.md", "01-vision/2027-goals.md.tmp", "00-inbox/2027-goals.md", "40-archive/vision/2027-goals-replaced-2027-04-02.md"]) {
    assert.equal(ignored(rel), true, `${rel} should be ignored`);
  }
});

test("REQ-016: 01-vision/README.md is not ignored, and is the only tracked file there", () => {
  assert.equal(ignored("01-vision/README.md"), false);
  const tracked = execFileSync("git", ["ls-files", "--cached", "01-vision/"], { cwd: REPO_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  assert.ok(tracked.every((f) => f === "01-vision/README.md"), `unexpected tracked files: ${tracked.join(", ")}`);
});

test("REQ-016: the README is a vault note that says what belongs there and how it gets there", () => {
  const text = readFileSync(path.join(REPO_ROOT, "01-vision", "README.md"), "utf8");
  assert.match(text, /^---\nname: vision-readme\ndescription: .+\ntype: reference\ncreated: \d{4}-\d{2}-\d{2}\nupdated: \d{4}-\d{2}-\d{2}\n---\n/);
  assert.match(text, /by sign-off only/);
  assert.match(text, /stays local/);
});

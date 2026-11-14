// DES-011: README.md and CLAUDE.md name 01-vision/ and the mycelia command, and
// link the format reference. No `task goals:*` target exists (D7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../src/lib/paths.ts";

const read = (f: string): string => readFileSync(path.join(REPO_ROOT, f), "utf8");

for (const file of ["README.md", "CLAUDE.md"]) {
  test(`DES-011: ${file} names 01-vision/ and the mycelia command, and links the format reference`, () => {
    const text = read(file);
    assert.ok(text.includes("01-vision/"));
    assert.match(text, /`(npx )?mycelia[ `]/);
    assert.ok(text.includes("](docs/reference/year-goals/format.md)"));
  });
}

test("DES-011: CLAUDE.md lists type vision and says runtime commands are mycelia groups", () => {
  const text = read("CLAUDE.md");
  assert.match(text, /^type: .*\| vision$/m);
  assert.match(text, /New runtime commands are subcommand groups of the one `mycelia` command/);
});

test("D7: no task goals:* target in the Taskfile or the docs", () => {
  for (const f of ["Taskfile.yml", "README.md", "CLAUDE.md", "docs/reference/year-goals/format.md", "01-vision/README.md"]) {
    assert.doesNotMatch(read(f), /task goals:/, f);
  }
});

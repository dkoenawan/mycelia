// ADR-0007's no-.md rule, extended to integration/ (DES-012): connector code
// must never show up as a vault note.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../../src/lib/paths.ts";

function mdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.name.toLowerCase().endsWith(".md")) out.push(path.relative(REPO_ROOT, p));
  }
  return out;
}

test("no .md file under integration/", () => {
  assert.deepEqual(mdFiles(path.join(REPO_ROOT, "integration")), []);
});

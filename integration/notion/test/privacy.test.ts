// Privacy guard (DES-016, REQ-040, REQ-041): the connector's committed files
// and the README carry no keys, workspace or page IDs, absolute home paths,
// or masculine pronouns for the operator. This repository is public.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../../src/lib/paths.ts";

/** The requirements' own fictional key (REQ-004, REQ-008, REQ-025), used by tests. */
const ALLOWED = new Set(["secret_TESTKEY0000"]);

export const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "UUID-shaped ID", re: /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi },
  { name: "Notion key prefix", re: new RegExp("\\b(?:secret|ntn)_[A-Za-z0-9]+", "g") },
  { name: "absolute home path", re: new RegExp("(?:\\/home\\/|\\/Users\\/|[A-Z]:\\\\Users\\\\)[A-Za-z0-9._-]+", "g") },
  // Written as h[e] etc. so this file doesn't match itself.
  { name: "masculine pronoun", re: new RegExp("\\b(?:h[e]|h[i]s|h[i]m)\\b", "gi") },
];

export function findings(text: string): string[] {
  const out: string[] = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) if (!ALLOWED.has(m[0])) out.push(`${p.name}: ${m[0]}`);
  }
  return out;
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else out.push(p);
  }
  return out;
}

test("integration/, the template and the README hold no private values (REQ-040, REQ-041)", () => {
  const scanned = [...files(path.join(REPO_ROOT, "integration")), path.join(REPO_ROOT, "README.md")];
  const problems = scanned.flatMap((f) => findings(readFileSync(f, "utf8")).map((x) => `${path.relative(REPO_ROOT, f)}: ${x}`));
  assert.deepEqual(problems, []);
});

test("the scan catches planted strings", () => {
  const planted = [
    ["0123abcd", "0123", "4567", "89ab", "0123456789ab"].join("-"),
    ["ntn", "abcdefGHIJ1234"].join("_"),
    ["", "home", "someone", "notes"].join("/"),
    "The operator said " + ["h", "e"].join("") + " would.",
  ];
  for (const p of planted) assert.equal(findings(p).length, 1, p);
  assert.deepEqual(findings("secret_TESTKEY0000 the theme"), []);
});

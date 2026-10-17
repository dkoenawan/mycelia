// Capture item rendering (DES-006): pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Capture, SourceRow } from "../../src/domain/capture.ts";
import { captureName, hintSlug, omittedLine, renderCaptureItem, slugify } from "../../src/domain/capture-item.ts";

const row: SourceRow = { id: "abcd1234-0000", title: "Interview prep", status: "New", createdTime: "2026-10-11T08:01:00.000Z" };
const cap: Capture = { title: "Interview prep", body: "Practise answers.", url: null, hint: "Career", omitted: {} };

test("the hint links only when the use case confirmed the target exists (REQ-023)", () => {
  assert.ok(renderCaptureItem(row, cap, true).includes("[[career]]"));
  assert.ok(!renderCaptureItem(row, cap, false).includes("[["));
  assert.equal(hintSlug("not a slug!"), null);
  assert.equal(hintSlug(null), null);
});

test("frontmatter carries source and identity; no URL line when unset", () => {
  const item = renderCaptureItem(row, cap, false);
  assert.ok(item.startsWith(`---\nsource: notion\nsource_id: "abcd1234-0000"\ncaptured: "2026-10-11T08:01:00.000Z"\n---\n\n# Interview prep\n\nPractise answers.\n`));
  assert.ok(!item.includes("URL:"));
});

test("names are deterministic and safe", () => {
  assert.equal(captureName(row), "notion-interview-prep-abcd12340000.md");
  assert.equal(captureName({ id: "ffff0000", title: "!!!" }), "notion-capture-ffff0000.md");
  assert.equal(slugify("Café déjà vu"), "cafe-deja-vu");
  assert.equal(omittedLine({ image: 2, file: 1 }), "Left out: 1 file, 2 images.");
  assert.equal(omittedLine({}), "");
});

test("same-title rows whose IDs share their leading digits get distinct names (the whole ID is used)", () => {
  const id = (tail: string): string => ["1e2f3a4b", "5c6d", "8000", "9000", tail.padStart(12, "0")].join("-");
  const a = captureName({ id: id("a"), title: "" });
  const b = captureName({ id: id("b"), title: "" });
  assert.notEqual(a, b);
  assert.equal(a, `notion-capture-${id("a").replace(/-/g, "")}.md`);
});

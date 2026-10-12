// The source inbox template (DES-003): five properties, Status in both forms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const file = path.join(import.meta.dirname, "..", "..", "template", "source-inbox.json");

test("the template declares the five properties and the three status options in both forms (REQ-002)", () => {
  const t = JSON.parse(readFileSync(file, "utf8")) as {
    title: string;
    properties: Record<string, Record<string, unknown>>;
    status: { property: string; forms: Record<string, Record<string, { options: { name: string }[] }>> };
    instructions: { title: string; paragraphs: string[] };
  };
  assert.equal(t.title, "Capture inbox");
  assert.deepEqual([...Object.keys(t.properties), t.status.property].sort(), ["Area or project", "Name", "Reason", "Status", "URL"]);
  for (const form of ["status", "select"]) {
    assert.deepEqual(t.status.forms[form]?.[form]?.options.map((o) => o.name), ["New", "Ingested", "Failed"]);
  }
  assert.ok(t.instructions.paragraphs.some((p) => p.includes("later edits to it are ignored")));
});

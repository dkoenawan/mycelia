// Daily-note block (REQ-032).
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSummary } from "../../src/domain/summary.ts";

test("REQ-032: counts per outcome and wikilinks to new resources and asks", () => {
  const block = renderSummary({ time: "06:00", counts: { ingested: 2, held: 1 }, resources: ["30-resources/a.md", "30-resources/b.md"], asks: ["00-inbox/2026-10-12-ingest-x.md"] });
  assert.equal(block, "## Phone capture (06:00 UTC)\n\n- 2 ingested, 1 held from phone capture\n- Resources: [[a]], [[b]]\n- Asks: [[2026-10-12-ingest-x]]\n");
});

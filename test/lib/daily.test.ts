// Pins src/lib/daily.ts to common.sh's append_daily, so the two can't drift (DES-001).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendDaily } from "../../src/lib/daily.ts";
import { utcDate } from "../../src/lib/dates.ts";
import { REPO_ROOT } from "../../src/lib/paths.ts";

test("daily note frontmatter and append match common.sh's append_daily", async () => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "mycelia-daily-")));
  try {
    const bashDaily = path.join(dir, "bash", "daily");
    execFileSync("bash", ["-c", `source "${REPO_ROOT}/scripts/lib/common.sh"; MYCELIA_DAILY="$1"; append_daily "first line"; append_daily "second line"`, "_", bashDaily]);
    const today = utcDate(new Date());
    await appendDaily(path.join(dir, "node"), today, "first line");
    await appendDaily(path.join(dir, "node"), today, "second line\n");
    assert.equal(readFileSync(path.join(dir, "node", "daily", `${today}.md`), "utf8"), readFileSync(path.join(bashDaily, `${today}.md`), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("block appends are separated by exactly one blank line", async () => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "mycelia-daily-")));
  try {
    await appendDaily(dir, "2026-10-01", "## A\n", { block: true });
    await appendDaily(dir, "2026-10-01", "a line");
    await appendDaily(dir, "2026-10-01", "## B\n", { block: true });
    const body = readFileSync(path.join(dir, "daily", "2026-10-01.md"), "utf8").split("---\n\n")[1];
    assert.equal(body, "## A\na line\n\n## B\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

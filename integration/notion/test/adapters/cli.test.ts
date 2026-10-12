// Composition root and tasks (DES-011, REQ-001).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "../../../../src/lib/paths.ts";

test("REQ-001: Taskfile exposes setup, pull and preflight behind deps:node", () => {
  const tf = parse(readFileSync(path.join(REPO_ROOT, "Taskfile.yml"), "utf8")) as { tasks: Record<string, { desc: string; deps?: string[]; cmds: string[]; interactive?: boolean }> };
  const setup = tf.tasks["notion:setup"];
  const pull = tf.tasks["notion:pull"];
  const pre = tf.tasks["notion:pull:preflight"];
  assert.match(setup?.desc ?? "", /^Connect the Notion capture inbox/);
  assert.match(pull?.desc ?? "", /^Pull the Notion capture inbox/);
  assert.equal(setup?.interactive, true);
  for (const t of [setup, pull, pre]) assert.deepEqual(t?.deps, ["deps:node"]);
  assert.ok(setup?.cmds[0]?.includes("{{.CLI_ARGS}}"));
  // REQ-008: the key never travels through argv or the environment.
  assert.equal(setup && "env" in setup, false);
  assert.ok(!/KEY|SECRET/.test(setup?.cmds.join(" ") ?? ""));
});

test("an unknown command prints usage and exits 2", () => {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, "integration/notion/src/cli.ts"), "bogus"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: .* setup <Notion page URL or ID> \| pull \[--preflight\]/);
});

// DES-007: the `mycelia` dispatcher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { dispatch, EXIT_UNEXPECTED, EXIT_USAGE, GROUPS, type GroupEntry } from "../src/mycelia.ts";
import { REPO_ROOT } from "../src/lib/paths.ts";

function fakeGroups(code: number, seen: string[][], loads: string[] = []): Record<string, GroupEntry> {
  return {
    alpha: { summary: "the alpha group", load: () => { loads.push("alpha"); return Promise.resolve({ run: (a) => { seen.push(a); return Promise.resolve(code); } }); } },
    beta: { summary: "the beta group", load: () => { loads.push("beta"); return Promise.reject(new Error("must not load")); } },
  };
}

test("DES-007: an unknown group prints the groups and exits 2", async () => {
  const err: string[] = [];
  assert.equal(await dispatch(["nope", "x"], fakeGroups(0, []), (l) => err.push(l)), EXIT_USAGE);
  assert.match(err[0] ?? "", /unknown group "nope"/);
  assert.match(err[1] ?? "", /usage: mycelia <group> <command>[\s\S]*alpha +the alpha group[\s\S]*beta/);
});

test("DES-007: `mycelia` and `mycelia help` print the groups and exit 2", async () => {
  for (const argv of [[], ["help"], ["--help"]]) {
    const err: string[] = [];
    assert.equal(await dispatch(argv, fakeGroups(0, []), (l) => err.push(l)), EXIT_USAGE);
    assert.equal(err.length, 1);
    assert.match(err[0] ?? "", /^usage: mycelia/);
  }
});

test("DES-007: the group's exit code passes through, with the rest of the arguments", async () => {
  for (const code of [0, 1, 2, 7]) {
    const seen: string[][] = [];
    assert.equal(await dispatch(["alpha", "cmd", "--flag", "x"], fakeGroups(code, seen), () => undefined), code);
    assert.deepEqual(seen, [["cmd", "--flag", "x"]]);
  }
});

test("DES-007: only the named group is imported", async () => {
  const loads: string[] = [];
  await dispatch(["alpha"], fakeGroups(0, [], loads), () => undefined);
  assert.deepEqual(loads, ["alpha"]);
});

test("DES-007: an unexpected failure is caught, printed and exits 3", async () => {
  const err: string[] = [];
  assert.equal(await dispatch(["beta"], fakeGroups(0, []), (l) => err.push(l)), EXIT_UNEXPECTED);
  assert.match(err[0] ?? "", /unexpected failure: Error: must not load/);
  assert.equal(await dispatch(["constructor"], fakeGroups(0, []), () => undefined), EXIT_USAGE);
});

test("DES-007: goals is the one group, and its module exposes run(args)", async () => {
  assert.deepEqual(Object.keys(GROUPS), ["goals"]);
  const g = await GROUPS["goals"]?.load();
  assert.equal(typeof g?.run, "function");
});

test("DES-007: package.json exposes the bin and the script, and the entry point is an executable Node script", () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as { bin?: Record<string, string>; scripts?: Record<string, string> };
  assert.deepEqual(pkg.bin, { mycelia: "src/mycelia.ts" });
  assert.equal(pkg.scripts?.["mycelia"], "node src/mycelia.ts");
  const file = path.join(REPO_ROOT, "src", "mycelia.ts");
  assert.ok(readFileSync(file, "utf8").startsWith("#!/usr/bin/env node\n"));
  assert.ok((statSync(file).mode & 0o111) !== 0, "src/mycelia.ts should be executable");
});

test("DES-007: run as a process, `mycelia goals validate <example>` exits 0 and an unknown group exits 2", () => {
  const example = path.join(REPO_ROOT, "docs", "reference", "year-goals", "example-2027-goals.md");
  const ok = spawnSync(process.execPath, [path.join(REPO_ROOT, "src", "mycelia.ts"), "goals", "validate", example], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /found 2 main goals/);
  const bad = spawnSync(process.execPath, [path.join(REPO_ROOT, "src", "mycelia.ts"), "nope"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(bad.status, 2);
});

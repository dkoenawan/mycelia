// Connector config adapter (DES-004): guard, 0600 atomic write, round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "../../../../src/lib/paths.ts";
import { ConfigUnsafe, type ConnectorConfig } from "../../src/application/ports.ts";
import { CONFIG_REL, ConfigInvalid, YamlConfigStore } from "../../src/adapters/config/yaml-config.ts";

const CFG: ConnectorConfig = {
  version: 1, api_key: "secret_TESTKEY0000", database_id: "db-1", data_source_id: "ds-1", instructions_page_id: null, status_property: "select",
};

function gitDir(gitignore: boolean): { root: string; done: () => void } {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "mycelia-cfg-")));
  execFileSync("git", ["init", "-q"], { cwd: root });
  if (gitignore) copyFileSync(path.join(REPO_ROOT, ".gitignore"), path.join(root, ".gitignore"));
  return { root, done: () => { rmSync(root, { recursive: true, force: true }); } };
}

test("write: mode 0600, round trip keeps every field, no temp file left", async () => {
  const d = gitDir(true);
  try {
    const store = new YamlConfigStore(d.root);
    assert.equal(await store.read(), null);
    await store.guard();
    await store.write(CFG);
    assert.equal(statSync(path.join(d.root, CONFIG_REL)).mode & 0o777, 0o600);
    assert.deepEqual(await store.read(), CFG);
    await store.write({ ...CFG, instructions_page_id: "row-1", status_property: "status" });
    assert.deepEqual(await store.read(), { ...CFG, instructions_page_id: "row-1", status_property: "status" });
    assert.deepEqual(readdirSync(path.join(d.root, "control")), ["notion.local.yaml"]);
    assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: d.root, encoding: "utf8" }), "?? .gitignore\n");
  } finally { d.done(); }
});

test("guard: a path that isn't gitignored fails and nothing is written (REQ-005)", async () => {
  const d = gitDir(false);
  try {
    const store = new YamlConfigStore(d.root);
    await assert.rejects(store.guard(), (e: unknown) => e instanceof ConfigUnsafe && e.message.includes(CONFIG_REL));
    await assert.rejects(store.write(CFG), ConfigUnsafe);
    assert.equal(existsSync(path.join(d.root, "control")), false);
  } finally { d.done(); }
});

test("guard: a path inside the agent's read scope fails even if ignored", async () => {
  const d = gitDir(true);
  try {
    await assert.rejects(new YamlConfigStore(d.root, "daily/notion.local.yaml").guard(), (e: unknown) => e instanceof ConfigUnsafe && e.message.includes("read scope"));
  } finally { d.done(); }
});

test("read: a malformed file is reported, not guessed at", async () => {
  const d = gitDir(true);
  try {
    execFileSync("mkdir", ["-p", path.join(d.root, "control")]);
    writeFileSync(path.join(d.root, CONFIG_REL), "version: 2\n");
    await assert.rejects(new YamlConfigStore(d.root).read(), ConfigInvalid);
  } finally { d.done(); }
});

test("the framework's .gitignore ignores the config path on a fresh clone", () => {
  execFileSync("git", ["check-ignore", "-q", "--no-index", CONFIG_REL], { cwd: REPO_ROOT });
});

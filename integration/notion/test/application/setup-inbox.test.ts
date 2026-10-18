// Setup use case (DES-005) against fakes: FakeNotion behind the provisioner,
// an in-memory config and a static key prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NotionProvisioner, parsePageId } from "../../src/adapters/notion/source-inbox.ts";
import { loadTemplate } from "../../src/adapters/notion/template.ts";
import { setupInbox, type SetupDeps } from "../../src/application/setup-inbox.ts";
import { FakeNotion } from "../fakes/fake-notion.ts";
import { MemoryConfig, StaticPrompt, logSink } from "../fakes/ports.ts";

const KEY = "secret_TESTKEY0000";
const PAGE = "0123456789abcdef".repeat(2);
const PAGE_ID = parsePageId(PAGE) ?? "";

function world(): { api: FakeNotion; config: MemoryConfig; prompt: StaticPrompt; out: ReturnType<typeof logSink>; deps: SetupDeps } {
  const api = new FakeNotion();
  api.sharedPages.add(PAGE_ID);
  const config = new MemoryConfig();
  const prompt = new StaticPrompt(KEY);
  const out = logSink();
  const template = loadTemplate();
  return { api, config, prompt, out, deps: { config, prompt, connect: () => new NotionProvisioner(api, template), parsePage: parsePageId, log: out.log } };
}

test("REQ-002/003/004: one source inbox, five properties, one instructions row with status New, config holds key and IDs", async () => {
  const w = world();
  assert.equal(await setupInbox(w.deps, `https://www.notion.so/Capture-${PAGE}`), 0, w.out.lines.join("\n"));
  assert.equal(w.api.dataSources.size, 1);
  const [dsId, ds] = [...w.api.dataSources.entries()][0] ?? [];
  assert.deepEqual(Object.keys(ds?.properties ?? {}).sort(), ["Area or project", "Name", "Reason", "Status", "URL"]);
  assert.equal(ds?.form, "status");
  assert.equal(ds?.rows.length, 1);
  assert.equal(ds?.rows[0]?.status, "New");
  assert.deepEqual(w.config.value, { version: 1, api_key: KEY, database_id: ds?.databaseId, data_source_id: dsId, instructions_page_id: ds?.rows[0]?.id, status_property: "status" });
  assert.ok(!w.out.lines.join("\n").includes(KEY));
});

test("D4: when the native status form is refused, setup uses a select", async () => {
  const w = world();
  w.api.refuseNativeStatus = true;
  assert.equal(await setupInbox(w.deps, PAGE), 0);
  assert.equal(w.config.value?.status_property, "select");
  assert.equal([...w.api.dataSources.values()][0]?.form, "select");
  assert.ok(w.out.lines.some((l) => l.includes("blank status means New")));
});

test("REQ-005: an unsafe config path stops setup before anything is created", async () => {
  const w = world();
  w.config.safe = false;
  assert.equal(await setupInbox(w.deps, PAGE), 2);
  assert.equal(w.prompt.calls, 0);
  assert.equal(w.api.dataSources.size, 0);
  assert.ok(w.out.lines.some((l) => l.includes("control/notion.local.yaml")));
});

test("REQ-006: an unshared page names the fix, a rejected key says so; nothing created", async () => {
  const w = world();
  w.api.sharedPages.clear();
  assert.equal(await setupInbox(w.deps, PAGE), 2);
  assert.ok(w.out.lines.some((l) => l.includes("share the page with the integration")));
  w.api.keyValid = false;
  assert.equal(await setupInbox(w.deps, PAGE), 2);
  assert.ok(w.out.lines.some((l) => l.includes("rejected the key")));
  assert.equal(w.api.dataSources.size, 0);
  assert.equal(w.config.value, null);
});

test("a missing or malformed page argument is a usage error before the key prompt", async () => {
  const w = world();
  assert.equal(await setupInbox(w.deps, undefined), 2);
  assert.equal(await setupInbox(w.deps, "not-a-page"), 2);
  assert.equal(w.prompt.calls, 0);
  assert.ok(w.out.lines.every((l) => l.includes("task notion:setup")));
});

test("REQ-007: a second setup creates nothing and names the existing inbox", async () => {
  const w = world();
  await setupInbox(w.deps, PAGE);
  const writes = w.api.writes.length;
  assert.equal(await setupInbox(w.deps, PAGE), 0);
  assert.equal(w.api.writes.length, writes);
  assert.equal(w.prompt.calls, 1);
  assert.ok(w.out.lines.at(-1)?.includes(`database ${w.config.value?.database_id ?? "?"}`));
});

test("a config without its instructions row gets it finished", async () => {
  const w = world();
  await setupInbox(w.deps, PAGE);
  const cfg = w.config.value;
  assert.ok(cfg);
  w.config.value = { ...cfg, instructions_page_id: null };
  assert.equal(await setupInbox(w.deps, PAGE), 0);
  assert.ok(w.config.value.instructions_page_id);
  assert.equal([...w.api.dataSources.values()][0]?.rows.length, 2);
});

test("REQ-009: a config naming a deleted inbox says how to start over and creates nothing", async () => {
  const w = world();
  await setupInbox(w.deps, PAGE);
  w.api.dataSources.clear();
  assert.equal(await setupInbox(w.deps, PAGE), 2);
  const msg = w.out.lines.at(-1) ?? "";
  assert.ok(msg.includes(w.config.value?.database_id ?? "?") && msg.includes("delete `control/notion.local.yaml` and run setup again"), msg);
  assert.equal(w.api.dataSources.size, 0);
});

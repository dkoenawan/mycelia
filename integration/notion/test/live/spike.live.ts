// Notion API spike (DES-017): checks the design's assumptions A1-A5 against
// the live API before the connector relies on them. Not part of `npm test`.
//
// Run with: npm run test:live
// It needs a throwaway test workspace, never the operator's real one:
//   NOTION_TEST_KEY               key of an internal integration in the test workspace
//   NOTION_TEST_PAGE_ID           a page shared with that integration (Connections)
//   NOTION_TEST_UNSHARED_PAGE_ID  optional: a page NOT shared with it (A1 negative case)
//   NOTION_TEST_OLD_KEY           optional: a key since regenerated or revoked (A2)
//   NOTION_TEST_VERSION           optional: Notion-Version to try (default below)
// Every test skips when NOTION_TEST_KEY or NOTION_TEST_PAGE_ID is unset. The key
// is read from the environment only and is never printed. Databases the spike
// creates are moved to the trash at the end.
import { after, test } from "node:test";
import assert from "node:assert/strict";

const KEY = process.env["NOTION_TEST_KEY"] ?? "";
const PAGE = process.env["NOTION_TEST_PAGE_ID"] ?? "";
const UNSHARED = process.env["NOTION_TEST_UNSHARED_PAGE_ID"] ?? "";
const OLD_KEY = process.env["NOTION_TEST_OLD_KEY"] ?? "";
const VERSION = process.env["NOTION_TEST_VERSION"] ?? "2025-09-03";
const HOST = "https://api.notion.com";
const skip = !KEY || !PAGE ? "set NOTION_TEST_KEY and NOTION_TEST_PAGE_ID to run the Notion spike" : false;

interface Reply {
  status: number;
  retryAfter: string | null;
  body: Record<string, unknown>;
}

async function call(method: string, path: string, body?: unknown, key = KEY): Promise<Reply> {
  const res = await fetch(`${HOST}${path}`, {
    method,
    redirect: "error",
    headers: { Authorization: `Bearer ${key}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, retryAfter: res.headers.get("retry-after"), body: (parsed ?? {}) as Record<string, unknown> };
}

function finding(id: string, text: string): void {
  process.stdout.write(`FINDING ${id}: ${text}\n`);
}

const title = (s: string): unknown => [{ type: "text", text: { content: s } }];
const created: string[] = [];

function properties(statusForm: "status" | "select"): Record<string, unknown> {
  const options = [{ name: "New" }, { name: "Ingested" }, { name: "Failed" }];
  return {
    Name: { title: {} },
    Status: statusForm === "status" ? { status: { options } } : { select: { options } },
    URL: { url: {} },
    "Area or project": { rich_text: {} },
    Reason: { rich_text: {} },
  };
}

async function createDb(parent: string, statusForm: "status" | "select"): Promise<Reply> {
  const r = await call("POST", "/v1/databases", {
    parent: { type: "page_id", page_id: parent },
    title: title(`spike ${statusForm} ${new Date().toISOString()}`),
    initial_data_source: { properties: properties(statusForm) },
  });
  if (r.status === 200 && typeof r.body["id"] === "string") created.push(r.body["id"]);
  return r;
}

function dataSourceId(db: Record<string, unknown>): string {
  const ds = db["data_sources"];
  assert.ok(Array.isArray(ds) && ds.length > 0, "database response has no data_sources (A4)");
  const first: unknown = ds[0];
  assert.ok(first && typeof first === "object" && typeof (first as Record<string, unknown>)["id"] === "string");
  return (first as Record<string, string>)["id"] ?? "";
}

after(async () => {
  for (const id of created) await call("PATCH", `/v1/databases/${id}`, { in_trash: true });
});

test("A2: the key works, and a regenerated key gets 401", { skip }, async () => {
  const me = await call("GET", "/v1/users/me");
  assert.equal(me.status, 200, JSON.stringify(me.body));
  finding("A2", `users/me with the current key: ${String(me.status)} (type ${String(me.body["type"])})`);
  if (OLD_KEY) {
    const old = await call("GET", "/v1/users/me", undefined, OLD_KEY);
    finding("A2", `users/me with a regenerated key: ${String(old.status)} ${String(old.body["code"])}`);
    assert.equal(old.status, 401);
  } else {
    finding("A2", "NOTION_TEST_OLD_KEY unset; revoked-key behaviour not checked live");
  }
});

test("A1: database creation needs a shared parent page", { skip }, async () => {
  if (UNSHARED) {
    const r = await createDb(UNSHARED, "select");
    finding("A1", `create under an unshared page: ${String(r.status)} ${String(r.body["code"])}`);
    assert.equal(r.status, 404);
  } else {
    finding("A1", "NOTION_TEST_UNSHARED_PAGE_ID unset; negative case not checked");
  }
  const ok = await createDb(PAGE, "select");
  finding("A1", `create under the shared page: ${String(ok.status)}`);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test("A3 + A4: native status creation, data-source model, row defaults, query and update", { skip }, async () => {
  const native = await createDb(PAGE, "status");
  finding("A3", `create with a native status property: ${String(native.status)} ${native.status === 200 ? "" : String(native.body["message"])}`);
  const form = native.status === 200 ? "status" : "select";
  const db = native.status === 200 ? native : await createDb(PAGE, "select");
  assert.equal(db.status, 200, JSON.stringify(db.body));
  finding("D4", `status form to use: ${form}`);
  const ds = dataSourceId(db.body);
  finding("A4", `Notion-Version ${VERSION}: database response carries data_sources[0].id`);
  const row = await call("POST", "/v1/pages", { parent: { type: "data_source_id", data_source_id: ds }, properties: { Name: { title: title("test") } } });
  assert.equal(row.status, 200, JSON.stringify(row.body));
  const props = row.body["properties"] as Record<string, Record<string, unknown>>;
  const status = props["Status"]?.[form] as { name?: string } | null | undefined;
  finding("A3", `a row created with only a title has Status: ${status?.name ?? "(blank)"}`);
  const createdTime = String(row.body["created_time"]);
  finding("A5", `created_time ${createdTime} (rounded to the minute: ${String(/:00\.000Z$/.test(createdTime))})`);
  const q = await call("POST", `/v1/data_sources/${ds}/query`, {
    filter: { property: "Status", [form]: { does_not_equal: "Ingested" } },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
    page_size: 100,
  });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  const results = q.body["results"] as unknown[];
  finding("A4", `query through /v1/data_sources/{id}/query with a does_not_equal filter returns the blank-or-New row: ${String(results.length === 1)}`);
  const id = String(row.body["id"]);
  const upd = await call("PATCH", `/v1/pages/${id}`, { properties: { Status: { [form]: { name: "Failed" } }, Reason: { rich_text: title("x".repeat(2000)) } } });
  finding("A4", `update Status and a 2,000-character Reason: ${String(upd.status)}`);
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  const tooLong = await call("PATCH", `/v1/pages/${id}`, { properties: { Reason: { rich_text: title("x".repeat(2001)) } } });
  finding("A5", `a 2,001-character rich-text segment: ${String(tooLong.status)}`);
});

test("A5: a burst of requests meets 429 with Retry-After", { skip, timeout: 120_000 }, async () => {
  const replies = await Promise.all(Array.from({ length: 40 }, () => call("GET", "/v1/users/me")));
  const limited = replies.filter((r) => r.status === 429);
  finding("A5", `40 parallel requests: ${String(limited.length)} answered 429; Retry-After ${limited[0]?.retryAfter ?? "(none seen)"}; code ${JSON.stringify(limited[0]?.body["code"] ?? "-")}`);
});

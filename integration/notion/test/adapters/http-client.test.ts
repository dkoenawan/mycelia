// Notion HTTP client (DES-002) against a local recording server.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  HttpNotionApi, NOTION_VERSION, NotionAuthError, NotionItemError, NotionNoAccess, NotionUnavailable, RICH_TEXT_MAX,
} from "../../src/adapters/notion/http-client.ts";

const KEY = "secret_TESTKEY0000";

interface Seen {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

type Handler = (req: Seen, n: number) => { status: number; body?: unknown; headers?: Record<string, string> };

async function server(handler: Handler): Promise<{ base: string; seen: Seen[]; close: () => Promise<void> }> {
  const seen: Seen[] = [];
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => { body += c.toString(); });
    req.on("end", () => {
      const s: Seen = { method: req.method ?? "", url: req.url ?? "", headers: req.headers, body };
      seen.push(s);
      const r = handler(s, seen.length);
      res.writeHead(r.status, { "content-type": "application/json", ...r.headers });
      res.end(r.body === undefined ? "" : JSON.stringify(r.body));
    });
  });
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const port = (srv.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${String(port)}`, seen, close: () => new Promise((resolve) => { srv.close(() => { resolve(); }); }) };
}

const noSleep = { sleep: (): Promise<void> => Promise.resolve() };

test("three 429s in a row, then success: waits for Retry-After and records no failure (REQ-044)", async () => {
  const waits: number[] = [];
  const s = await server((_r, n) => (n <= 3 ? { status: 429, body: { code: "rate_limited" }, headers: { "retry-after": "2" } } : { status: 200, body: { object: "user" } }));
  try {
    await new HttpNotionApi(KEY, { baseUrl: s.base, sleep: (ms) => { waits.push(ms); return Promise.resolve(); } }).me();
    assert.deepEqual(waits, [2000, 2000, 2000]);
    assert.equal(s.seen.length, 4);
  } finally { await s.close(); }
});

test("rate-limit retries exhausted is NotionUnavailable", async () => {
  const s = await server(() => ({ status: 429, body: {} }));
  try {
    await assert.rejects(new HttpNotionApi(KEY, { baseUrl: s.base, ...noSleep, maxRateLimitRetries: 2 }).me(), NotionUnavailable);
    assert.equal(s.seen.length, 3);
  } finally { await s.close(); }
});

test("the key travels only in the Authorization header, with the pinned version (REQ-025)", async () => {
  const s = await server((r) => (r.url.startsWith("/v1/data_sources/") ? { status: 200, body: { results: [], has_more: false } } : { status: 200, body: { id: "p", properties: {} } }));
  try {
    const api = new HttpNotionApi(KEY, { baseUrl: s.base, ...noSleep });
    await api.getPage("p");
    await api.queryDataSource("ds", { property: "Status", select: { does_not_equal: "Ingested" } });
    await api.setStatus("p", "select", "Failed", "boom");
    for (const r of s.seen) {
      assert.equal(r.headers.authorization, `Bearer ${KEY}`);
      assert.equal(r.headers["notion-version"], NOTION_VERSION);
      assert.ok(!r.url.includes(KEY) && !r.body.includes(KEY));
      const others = Object.entries(r.headers).filter(([k]) => k !== "authorization").map(([, v]) => String(v));
      assert.ok(others.every((v) => !v.includes(KEY)));
    }
  } finally { await s.close(); }
});

test("setStatus sends only Status and Reason, the reason truncated to 2,000 characters (REQ-022)", async () => {
  const s = await server(() => ({ status: 200, body: { id: "p" } }));
  try {
    await new HttpNotionApi(KEY, { baseUrl: s.base, ...noSleep }).setStatus("p", "status", "Failed", "x".repeat(2500));
    const r = s.seen[0];
    assert.equal(r?.method, "PATCH");
    assert.equal(r?.url, "/v1/pages/p");
    const body = JSON.parse(r?.body ?? "{}") as { properties: Record<string, { rich_text?: { text: { content: string } }[]; status?: unknown }> };
    assert.deepEqual(Object.keys(body), ["properties"]);
    assert.deepEqual(Object.keys(body.properties).sort(), ["Reason", "Status"]);
    assert.deepEqual(body.properties["Status"]?.status, { name: "Failed" });
    const reason = body.properties["Reason"]?.rich_text?.[0]?.text.content ?? "";
    assert.equal(reason.length, RICH_TEXT_MAX);
    assert.ok(reason.endsWith("…"));
  } finally { await s.close(); }
});

test("a redirect is refused and not followed", async () => {
  const s = await server((r) => (r.url === "/elsewhere" ? { status: 200, body: {} } : { status: 302, headers: { location: "/elsewhere" } }));
  try {
    await assert.rejects(new HttpNotionApi(KEY, { baseUrl: s.base, ...noSleep }).me(), (e: unknown) => e instanceof NotionUnavailable && /redirect/.test(e.message));
    assert.deepEqual(s.seen.map((r) => r.url), ["/v1/users/me"]);
  } finally { await s.close(); }
});

test("errors are typed and never carry the key", async () => {
  const cases: [number, new (...a: never[]) => Error][] = [[401, NotionAuthError], [403, NotionNoAccess], [404, NotionNoAccess], [500, NotionUnavailable], [400, NotionItemError]];
  for (const [status, type] of cases) {
    const s = await server(() => ({ status, body: { code: "x", message: `bad ${KEY}`.replace(KEY, "request") } }));
    try {
      await assert.rejects(new HttpNotionApi(KEY, { baseUrl: s.base, ...noSleep }).me(), (e: unknown) => e instanceof type && !(e).message.includes(KEY));
    } finally { await s.close(); }
  }
  const dead = await server(() => ({ status: 200 }));
  await dead.close();
  await assert.rejects(new HttpNotionApi(KEY, { baseUrl: dead.base, ...noSleep }).me(), (e: unknown) => e instanceof NotionUnavailable && !(e).message.includes(KEY));
});

test("query and children follow pagination; createDatabase returns both IDs", async () => {
  const s = await server((r) => {
    if (r.url.endsWith("/query")) {
      const b = JSON.parse(r.body) as { start_cursor?: string; sorts: unknown };
      assert.deepEqual(b.sorts, [{ timestamp: "created_time", direction: "ascending" }]);
      return b.start_cursor ? { status: 200, body: { results: [{ id: "r2", created_time: "t", properties: {} }], has_more: false } } : { status: 200, body: { results: [{ id: "r1", created_time: "t", properties: {} }], has_more: true, next_cursor: "c1" } };
    }
    if (r.url.startsWith("/v1/blocks/")) {
      return r.url.includes("start_cursor=c") ? { status: 200, body: { results: [{ id: "b2", type: "paragraph", has_children: false }], has_more: false } } : { status: 200, body: { results: [{ id: "b1", type: "paragraph", has_children: true }], has_more: true, next_cursor: "c" } };
    }
    if (r.url === "/v1/databases") return { status: 200, body: { id: "db", data_sources: [{ id: "ds", name: "Capture inbox" }] } };
    return { status: 404, body: {} };
  });
  try {
    const api = new HttpNotionApi(KEY, { baseUrl: s.base, ...noSleep });
    assert.deepEqual((await api.queryDataSource("ds", {})).map((p) => p.id), ["r1", "r2"]);
    const kids = await api.listChildren("page");
    assert.deepEqual(kids.map((b) => [b.id, b.has_children]), [["b1", true], ["b2", false]]);
    assert.deepEqual(await api.createDatabase("parent", "Capture inbox", { Name: { title: {} } }), { databaseId: "db", dataSourceId: "ds" });
    const create = JSON.parse(s.seen.find((r) => r.url === "/v1/databases")?.body ?? "{}") as Record<string, unknown>;
    assert.deepEqual(create["parent"], { type: "page_id", page_id: "parent" });
    assert.deepEqual(create["initial_data_source"], { properties: { Name: { title: {} } } });
  } finally { await s.close(); }
});

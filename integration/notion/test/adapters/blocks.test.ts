// Converter (DES-006): Notion blocks to a capture, through the source-inbox adapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractUrls } from "../../../../src/ingest/fetch.ts";
import { blocksToMarkdown } from "../../src/adapters/notion/blocks.ts";
import { NotionSourceInbox } from "../../src/adapters/notion/source-inbox.ts";
import { SourceItemError, SourceUnavailable } from "../../src/application/ports.ts";
import { renderCaptureItem } from "../../src/domain/capture-item.ts";
import { FakeNotion, block, para, rich, unavailable } from "../fakes/fake-notion.ts";
import { NotionItemError } from "../../src/adapters/notion/http-client.ts";

test("REQ-011 fixture: heading, bullet, to-do, link and URL all reach the capture item", async () => {
  const api = new FakeNotion();
  const ds = api.addInbox();
  const row = api.addRow(ds, {
    title: "Agentic workflows", url: "https://example.org/agentic",
    blocks: [
      block("heading_2", { rich_text: [rich("Why")] }),
      block("bulleted_list_item", { rich_text: [rich("retries")] }),
      block("to_do", { rich_text: [rich("read later")], checked: false }),
      para(rich("See "), rich("the paper", "https://example.org/paper"), rich(".")),
    ],
  });
  const inbox = new NotionSourceInbox(api, { dataSourceId: ds, form: "select" });
  const [r] = await inbox.rowsNotIngested();
  assert.ok(r);
  const item = renderCaptureItem(r, await inbox.read(r), false);
  for (const s of ["Agentic workflows", "## Why", "- retries", "- [ ] read later", "[the paper](https://example.org/paper)", "https://example.org/agentic"]) {
    assert.ok(item.includes(s), `missing ${s} in:\n${item}`);
  }
  assert.ok(item.includes(`source_id: "${row.id}"`));
  // REQ-024: the ingester's URL extraction sees only the content URLs.
  assert.deepEqual(extractUrls(item), ["https://example.org/paper", "https://example.org/agentic"]);
});

test("REQ-012 fixture: an image is left out and counted", async () => {
  const api = new FakeNotion();
  const ds = api.addInbox();
  const row = api.addRow(ds, { title: "Pic", blocks: [para(rich("A paragraph.")), block("image", { type: "external", external: { url: "https://example.org/cat.png" } })] });
  const inbox = new NotionSourceInbox(api, { dataSourceId: ds, form: "select" });
  const cap = await inbox.read({ id: row.id, title: row.title, status: "New", createdTime: row.createdTime });
  const item = renderCaptureItem({ id: row.id, title: row.title, status: "New", createdTime: row.createdTime }, cap, false);
  assert.ok(item.includes("A paragraph."));
  assert.ok(!item.includes("cat.png"));
  assert.ok(item.includes("Left out: 1 image."));
});

test("nested lists indent, numbered lists count, and nested children are fetched", async () => {
  const api = new FakeNotion();
  const ds = api.addInbox();
  const row = api.addRow(ds, {
    title: "Lists",
    blocks: [
      block("numbered_list_item", { rich_text: [rich("one")] }, [block("bulleted_list_item", { rich_text: [rich("inner")] })]),
      block("numbered_list_item", { rich_text: [rich("two")] }),
      block("to_do", { rich_text: [rich("done")], checked: true }),
      block("heading_1", { rich_text: [rich("Top")] }),
      block("bookmark", { url: "https://example.org/b", caption: [] }),
      block("toggle", { rich_text: [rich("hidden")] }, [para(rich("x"))]),
      block("embed", { url: "https://example.org/e" }),
    ],
  });
  const cap = await new NotionSourceInbox(api, { dataSourceId: ds, form: "select" }).read({ id: row.id, title: "Lists", status: "New", createdTime: row.createdTime });
  assert.equal(cap.body, "1. one\n  - inner\n2. two\n- [x] done\n\n# Top\n\nhttps://example.org/b");
  assert.deepEqual(cap.omitted, { toggle: 1, embed: 1 });
});

test("a row-level error is a pull failure; an outage stops the run", async () => {
  const api = new FakeNotion();
  const ds = api.addInbox();
  const row = api.addRow(ds, { title: "x" });
  const inbox = new NotionSourceInbox(api, { dataSourceId: ds, form: "select" });
  const r = { id: row.id, title: "x", status: "New" as const, createdTime: row.createdTime };
  api.failOn("listChildren", () => new NotionItemError("bad block (validation_error)", 400, "validation_error"), { times: 1 });
  await assert.rejects(inbox.read(r), SourceItemError);
  api.failOn("getPage", unavailable, { times: 1 });
  await assert.rejects(inbox.read(r), SourceUnavailable);
  assert.deepEqual(blocksToMarkdown([]), { body: "", omitted: {} });
});

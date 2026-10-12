// Source inbox adapter (DES-002): Notion rows and errors mapped to domain types.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SourceAuthRejected, SourceNoAccess, SourceUnavailable, StatusFormRejected } from "../../src/application/ports.ts";
import { NotionSourceInbox, NotionProvisioner, parsePageId, type InboxTemplate } from "../../src/adapters/notion/source-inbox.ts";
import { FakeNotion, unavailable } from "../fakes/fake-notion.ts";

const TEMPLATE: InboxTemplate = {
  title: "Capture inbox",
  properties: { Name: { title: {} }, URL: { url: {} }, "Area or project": { rich_text: {} }, Reason: { rich_text: {} } },
  statusForms: { status: { status: { options: [{ name: "New" }] } }, select: { select: { options: [{ name: "New" }] } } },
  instructions: { title: "How to capture", paragraphs: ["one", "two"] },
};

test("rowsNotIngested: Ingested rows dropped, oldest first, ties by ID", async () => {
  const api = new FakeNotion();
  const ds = api.addInbox("select");
  const a = api.addRow(ds, { title: "a", createdTime: "2026-10-11T08:01:00.000Z", id: "bbbb" });
  api.addRow(ds, { title: "done", status: "Ingested" });
  const b = api.addRow(ds, { title: "b", createdTime: "2026-10-11T08:01:00.000Z", id: "aaaa", status: "" });
  const c = api.addRow(ds, { title: "c", createdTime: "2026-10-11T07:00:00.000Z", status: "Failed" });
  const rows = await new NotionSourceInbox(api, { dataSourceId: ds, form: "select" }).rowsNotIngested();
  assert.deepEqual(rows.map((r) => [r.id, r.title, r.status]), [[c.id, "c", "Failed"], [b.id, "b", ""], [a.id, "a", "New"]]);
});

test("check and setStatus map Notion errors to port errors", async () => {
  const api = new FakeNotion();
  const ds = api.addInbox("status");
  const inbox = new NotionSourceInbox(api, { dataSourceId: ds, form: "status" });
  await inbox.check();
  const row = api.addRow(ds, { title: "x" });
  await inbox.setStatus(row.id, "Failed", "boom");
  assert.deepEqual([row.status, row.reason], ["Failed", "boom"]);
  await assert.rejects(new NotionSourceInbox(api, { dataSourceId: "gone", form: "status" }).check(), SourceNoAccess);
  api.failOn("queryDataSource", unavailable, { times: 1 });
  await assert.rejects(inbox.rowsNotIngested(), SourceUnavailable);
  api.keyValid = false;
  await assert.rejects(inbox.check(), SourceAuthRejected);
});

test("provisioner: unshared parent names the fix; the native status form can be refused (D4)", async () => {
  const api = new FakeNotion();
  const prov = new NotionProvisioner(api, TEMPLATE);
  await prov.verifyKey();
  await assert.rejects(prov.verifyParent("unshared"), (e: unknown) => e instanceof SourceNoAccess && e.message.includes("share the page with the integration (page menu, Connections)"));
  api.sharedPages.add("page");
  await prov.verifyParent("page");
  api.refuseNativeStatus = true;
  await assert.rejects(prov.createInbox("page", "status"), StatusFormRejected);
  const ids = await prov.createInbox("page", "select");
  assert.equal(await prov.inboxAccessible(ids.dataSourceId), true);
  assert.equal(await prov.inboxAccessible("gone"), false);
  const created = api.dataSources.get(ids.dataSourceId);
  assert.deepEqual(Object.keys(created?.properties ?? {}).sort(), ["Area or project", "Name", "Reason", "Status", "URL"]);
  const rowId = await prov.createInstructionsRow(ids.dataSourceId, "select");
  assert.equal(api.row(rowId)?.status, "New");
  assert.equal(api.row(rowId)?.title, "How to capture");
});

test("parsePageId accepts a page URL or an ID, with or without dashes", () => {
  const hex = "0123456789abcdef0123456789abcdef";
  const dashed = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  assert.equal(parsePageId(hex), dashed);
  assert.equal(parsePageId(dashed), dashed);
  assert.equal(parsePageId(`https://www.notion.so/workspace/Capture-${hex}?pvs=4`), dashed);
  assert.equal(parsePageId("not a page"), null);
});

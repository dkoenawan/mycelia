// In-memory NotionApi (DES-002 test double): a tiny workspace with shared
// pages, data sources, rows and blocks. Records every write; failures can be
// injected per method and object ID.
import { randomUUID } from "node:crypto";
import {
  NotionAuthError, NotionItemError, NotionNoAccess, NotionUnavailable, truncate,
  type Json, type NotionApi, type NotionBlock, type NotionPage,
} from "../../src/adapters/notion/http-client.ts";
import type { StatusForm } from "../../src/application/ports.ts";

export interface FakeRow {
  id: string;
  title: string;
  status: string;
  reason: string;
  url: string | null;
  hint: string | null;
  createdTime: string;
  blocks: NotionBlock[];
}

interface Failure {
  method: keyof NotionApi;
  id?: string;
  error: () => Error;
  /** How many calls fail; Infinity by default. */
  times: number;
}

export class FakeNotion implements NotionApi {
  readonly sharedPages = new Set<string>();
  readonly dataSources = new Map<string, { databaseId: string; form: StatusForm; rows: FakeRow[]; properties: Json; parent: string }>();
  readonly writes: { method: string; id: string; body: unknown }[] = [];
  /** Set to false to simulate a rejected (revoked) key. */
  keyValid = true;
  /** The status form the fake workspace accepts at creation ("status" may be refused, A3). */
  refuseNativeStatus = false;
  private readonly failures: Failure[] = [];
  private clock = Date.parse("2026-10-11T08:00:00Z");

  failOn(method: keyof NotionApi, error: () => Error, opts: { id?: string; times?: number } = {}): void {
    this.failures.push({ method, error, times: opts.times ?? Infinity, ...(opts.id ? { id: opts.id } : {}) });
  }

  private gate(method: keyof NotionApi, id = ""): void {
    if (!this.keyValid) throw new NotionAuthError("Notion rejected the API key (unauthorized)");
    const f = this.failures.find((x) => x.method === method && x.times > 0 && (!x.id || x.id === id));
    if (f) {
      f.times--;
      throw f.error();
    }
  }

  /** A new data source, as if setup had run. */
  addInbox(form: StatusForm = "select"): string {
    const ds = randomUUID();
    this.dataSources.set(ds, { databaseId: randomUUID(), form, rows: [], properties: {}, parent: "" });
    return ds;
  }

  addRow(ds: string, r: Partial<FakeRow> & { title: string }): FakeRow {
    const inbox = this.dataSources.get(ds);
    if (!inbox) throw new Error("no such data source");
    this.clock += 60_000;
    const row: FakeRow = { id: randomUUID(), status: "New", reason: "", url: null, hint: null, createdTime: new Date(this.clock).toISOString(), blocks: [], ...r };
    inbox.rows.push(row);
    return row;
  }

  row(id: string): FakeRow | undefined {
    for (const ds of this.dataSources.values()) {
      const r = ds.rows.find((x) => x.id === id);
      if (r) return r;
    }
    return undefined;
  }

  private formOf(id: string): StatusForm {
    for (const ds of this.dataSources.values()) if (ds.rows.some((x) => x.id === id)) return ds.form;
    return "select";
  }

  private page(r: FakeRow, form: StatusForm): NotionPage {
    const rt = (s: string | null): Json[] => (s ? [{ type: "text", plain_text: s, text: { content: s } }] : []);
    return {
      id: r.id, created_time: r.createdTime,
      properties: {
        Name: { type: "title", title: rt(r.title) },
        Status: { type: form, [form]: r.status ? { name: r.status } : null },
        URL: { type: "url", url: r.url },
        "Area or project": { type: "rich_text", rich_text: rt(r.hint) },
        Reason: { type: "rich_text", rich_text: rt(r.reason) },
      },
    };
  }

  me(): Promise<void> {
    this.gate("me");
    return Promise.resolve();
  }

  getPage(id: string): Promise<NotionPage> {
    this.gate("getPage", id);
    const r = this.row(id);
    if (r) return Promise.resolve(this.page(r, this.formOf(id)));
    if (!this.sharedPages.has(id)) return Promise.reject(new NotionNoAccess("Could not find page (object_not_found)"));
    return Promise.resolve({ id, created_time: "", properties: {} });
  }

  createDatabase(parentPageId: string, title: string, properties: Json): Promise<{ databaseId: string; dataSourceId: string }> {
    this.gate("createDatabase", parentPageId);
    if (!this.sharedPages.has(parentPageId)) return Promise.reject(new NotionNoAccess("Could not find page (object_not_found)"));
    const status = properties["Status"] as Json | undefined;
    const form: StatusForm = status && "status" in status ? "status" : "select";
    if (form === "status" && this.refuseNativeStatus) return Promise.reject(new NotionItemError("Status is not supported for creation (validation_error)", 400, "validation_error"));
    const databaseId = randomUUID();
    const dataSourceId = randomUUID();
    this.dataSources.set(dataSourceId, { databaseId, form, rows: [], properties, parent: parentPageId });
    this.writes.push({ method: "createDatabase", id: parentPageId, body: { title, properties } });
    return Promise.resolve({ databaseId, dataSourceId });
  }

  getDataSource(id: string): Promise<void> {
    this.gate("getDataSource", id);
    return this.dataSources.has(id) ? Promise.resolve() : Promise.reject(new NotionNoAccess("Could not find data source (object_not_found)"));
  }

  queryDataSource(id: string, filter: Json): Promise<NotionPage[]> {
    this.gate("queryDataSource", id);
    const ds = this.dataSources.get(id);
    if (!ds) return Promise.reject(new NotionNoAccess("Could not find data source (object_not_found)"));
    const cond = (filter[ds.form] as Json | undefined)?.["does_not_equal"];
    const rows = ds.rows.filter((r) => cond === undefined || r.status !== cond);
    rows.sort((a, b) => (a.createdTime < b.createdTime ? -1 : a.createdTime > b.createdTime ? 1 : 0));
    return Promise.resolve(rows.map((r) => this.page(r, ds.form)));
  }

  listChildren(blockId: string): Promise<NotionBlock[]> {
    this.gate("listChildren", blockId);
    const r = this.row(blockId);
    if (r) return Promise.resolve(r.blocks.map(shallow));
    for (const row of this.dataSources.values()) {
      for (const x of row.rows) {
        const found = findBlock(x.blocks, blockId);
        if (found) return Promise.resolve((found.children ?? []).map(shallow));
      }
    }
    return Promise.reject(new NotionNoAccess("Could not find block (object_not_found)"));
  }

  createRow(dataSourceId: string, properties: Json, children?: Json[]): Promise<string> {
    this.gate("createRow", dataSourceId);
    const ds = this.dataSources.get(dataSourceId);
    if (!ds) return Promise.reject(new NotionNoAccess("Could not find data source (object_not_found)"));
    const title = ((properties["Name"] as Json)["title"] as { text: { content: string } }[])[0]?.text.content ?? "";
    const st = (properties["Status"] as Json | undefined)?.[ds.form] as { name?: string } | undefined;
    const row = this.addRow(dataSourceId, { title, status: st?.name ?? (ds.form === "status" ? "New" : "") });
    this.writes.push({ method: "createRow", id: dataSourceId, body: { properties, children } });
    return Promise.resolve(row.id);
  }

  setStatus(pageId: string, form: StatusForm, status: string, reason: string): Promise<void> {
    this.gate("setStatus", pageId);
    const r = this.row(pageId);
    if (!r) return Promise.reject(new NotionNoAccess("Could not find page (object_not_found)"));
    if (form !== this.formOf(pageId)) return Promise.reject(new NotionItemError("Status is expected to be select (validation_error)", 400, "validation_error"));
    r.status = status;
    r.reason = truncate(reason);
    this.writes.push({ method: "setStatus", id: pageId, body: { status, reason: r.reason } });
    return Promise.resolve();
  }
}

/** A block as the API returns it: children are fetched separately. */
function shallow(b: NotionBlock): NotionBlock {
  return Object.fromEntries(Object.entries(b).filter(([k]) => k !== "children")) as NotionBlock;
}

function findBlock(blocks: NotionBlock[], id: string): NotionBlock | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inner = findBlock(b.children ?? [], id);
    if (inner) return inner;
  }
  return undefined;
}

/** Block builders for fixtures. */
export const rich = (text: string, link?: string): Json => ({ type: "text", plain_text: text, text: { content: text, link: link ? { url: link } : null }, href: link ?? null });

export function block(type: string, content: Json = {}, children?: NotionBlock[]): NotionBlock {
  return { object: "block", id: randomUUID(), type, has_children: !!children?.length, [type]: content, ...(children ? { children } : {}) };
}

export const para = (...parts: Json[]): NotionBlock => block("paragraph", { rich_text: parts });
export const unavailable = (): Error => new NotionUnavailable("can't reach Notion (ECONNRESET)");

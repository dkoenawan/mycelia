// Source inbox adapter (DES-002, D8): implements the SourceInbox and
// InboxProvisioner ports on top of NotionApi, mapping Notion rows and errors
// into domain types so no Notion type crosses into application/.
import type { SourceRow, Status } from "../../domain/capture.ts";
import {
  SourceAuthRejected, SourceItemError, SourceNoAccess, SourceUnavailable, StatusFormRejected,
  type InboxProvisioner, type StatusForm,
} from "../../application/ports.ts";
import { NotionAuthError, NotionItemError, NotionNoAccess, NotionUnavailable, richText, type Json, type NotionApi, type NotionPage } from "./http-client.ts";

export const PROP = { title: "Name", status: "Status", url: "URL", hint: "Area or project", reason: "Reason" } as const;

/** The source inbox template (DES-003), as template.ts loads it. */
export interface InboxTemplate {
  title: string;
  /** Every property except Status, in Notion's create shape. */
  properties: Json;
  /** The Status property in each form. */
  statusForms: Record<StatusForm, Json>;
  instructions: { title: string; paragraphs: string[] };
}

/** Map a Notion error to the port's error types; anything else passes through. */
export function mapError(e: unknown, context: string): unknown {
  if (e instanceof NotionAuthError) return new SourceAuthRejected(`${context}: ${e.message}`);
  if (e instanceof NotionNoAccess) return new SourceNoAccess(`${context}: ${e.message}`);
  if (e instanceof NotionUnavailable) return new SourceUnavailable(`${context}: ${e.message}`);
  if (e instanceof NotionItemError) return new SourceItemError(`${context}: ${e.message}`);
  return e;
}

async function mapped<T>(context: string, f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    throw mapError(e, context);
  }
}

/** Concatenated plain text of a rich-text array. */
export function plainText(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return (v as unknown[]).map((t) => (t && typeof t === "object" && typeof (t as Json)["plain_text"] === "string" ? String((t as Json)["plain_text"]) : (t && typeof t === "object" ? textContent(t as Json) : ""))).join("");
}

function textContent(t: Json): string {
  const text = t["text"];
  return text && typeof text === "object" && typeof (text as Json)["content"] === "string" ? String((text as Json)["content"]) : "";
}

function prop(page: NotionPage, name: string): Json | undefined {
  return page.properties[name];
}

export function rowTitle(page: NotionPage): string {
  return plainText(prop(page, PROP.title)?.["title"]).trim();
}

export function rowStatus(page: NotionPage, form: StatusForm): Status {
  const v = prop(page, PROP.status)?.[form];
  const name = v && typeof v === "object" ? (v as Json)["name"] : undefined;
  return name === "New" || name === "Ingested" || name === "Failed" ? name : "";
}

export function rowUrl(page: NotionPage): string | null {
  const v = prop(page, PROP.url)?.["url"];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function rowHint(page: NotionPage): string | null {
  const v = plainText(prop(page, PROP.hint)?.["rich_text"]).trim();
  return v || null;
}

export function toRow(page: NotionPage, form: StatusForm): SourceRow {
  return { id: page.id, title: rowTitle(page), status: rowStatus(page, form), createdTime: page.created_time };
}

/** Oldest first by (createdTime, id): Notion rounds created_time to the minute (A5). */
export function byAge(a: SourceRow, b: SourceRow): number {
  if (a.createdTime !== b.createdTime) return a.createdTime < b.createdTime ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface InboxRef {
  dataSourceId: string;
  form: StatusForm;
}

/** The parts of SourceInbox that don't read content; read() arrives with the converter (DES-006). */
export class NotionInboxBase {
  protected readonly api: NotionApi;
  protected readonly ref: InboxRef;

  constructor(api: NotionApi, ref: InboxRef) {
    this.api = api;
    this.ref = ref;
  }

  check(): Promise<void> {
    return mapped("the source inbox", () => this.api.getDataSource(this.ref.dataSourceId));
  }

  async rowsNotIngested(): Promise<SourceRow[]> {
    const filter = { property: PROP.status, [this.ref.form]: { does_not_equal: "Ingested" } };
    const pages = await mapped("querying the source inbox", () => this.api.queryDataSource(this.ref.dataSourceId, filter));
    return pages.map((p) => toRow(p, this.ref.form)).filter((r) => r.status !== "Ingested").sort(byAge);
  }

  setStatus(id: string, status: Status, reason: string): Promise<void> {
    return mapped("setting a row's status", () => this.api.setStatus(id, this.ref.form, status, reason));
  }
}

const HEX32 = /([0-9a-f]{32})(?:[?#].*)?$/i;
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** A Notion page ID from a page URL or a bare ID (with or without dashes), or null. */
export function parsePageId(raw: string): string | null {
  const s = raw.trim();
  const dashed = UUID.exec(s);
  if (dashed?.[1]) return dashed[1].toLowerCase();
  const plain = HEX32.exec(s.replace(/-/g, ""));
  if (!plain?.[1]) return null;
  const h = plain[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export class NotionProvisioner implements InboxProvisioner {
  private readonly api: NotionApi;
  private readonly template: InboxTemplate;

  constructor(api: NotionApi, template: InboxTemplate) {
    this.api = api;
    this.template = template;
  }

  verifyKey(): Promise<void> {
    return mapped("checking the API key", () => this.api.me());
  }

  async verifyParent(pageId: string): Promise<void> {
    try {
      await this.api.getPage(pageId);
    } catch (e) {
      if (e instanceof NotionNoAccess) throw new SourceNoAccess("the parent page isn't accessible: share the page with the integration (page menu, Connections), then run setup again");
      throw mapError(e, "checking the parent page");
    }
  }

  async inboxAccessible(dataSourceId: string): Promise<boolean> {
    try {
      await this.api.getDataSource(dataSourceId);
      return true;
    } catch (e) {
      if (e instanceof NotionNoAccess) return false;
      throw mapError(e, "checking the existing source inbox");
    }
  }

  async createInbox(parentPageId: string, form: StatusForm): Promise<{ databaseId: string; dataSourceId: string }> {
    const properties = { ...this.template.properties, [PROP.status]: this.template.statusForms[form] };
    try {
      return await this.api.createDatabase(parentPageId, this.template.title, properties);
    } catch (e) {
      if (form === "status" && e instanceof NotionItemError && e.status === 400) throw new StatusFormRejected(e.message);
      throw mapError(e, "creating the source inbox");
    }
  }

  createInstructionsRow(dataSourceId: string, form: StatusForm): Promise<string> {
    const properties = { [PROP.title]: { title: richText(this.template.instructions.title) }, [PROP.status]: { [form]: { name: "New" } } };
    const children = this.template.instructions.paragraphs.map((p) => ({ object: "block", type: "paragraph", paragraph: { rich_text: richText(p) } }));
    return mapped("creating the instructions row", () => this.api.createRow(dataSourceId, properties, children));
  }
}

// Notion API client (DES-002, D2, D3). Built-in fetch, no SDK. Talks to one
// hard-coded host; the key goes only in the Authorization header; redirects
// are refused; environment proxies are ignored (fetch doesn't read them). A
// base URL can be injected through the constructor for tests only; the CLI
// never sets it.
//
// Live findings (DES-017, assumptions A1-A5): NOT YET RECORDED. The spike in
// test/live/spike.live.ts hasn't been run against a test workspace yet, so
// NOTION_VERSION below is provisional (the data-source model's first version,
// A4), and setup tries the native status form first and falls back to select
// when the API refuses it (A3, D4). Replace this paragraph with the findings
// once the spike has run.
import type { StatusForm } from "../../application/ports.ts";

export const NOTION_HOST = "https://api.notion.com";
/** Pinned API version (D3). Provisional until DES-017 confirms it. */
export const NOTION_VERSION = "2025-09-03";
export const PAGE_SIZE = 100;
/** Rich-text segment limit (A5); longer reasons are truncated with an ellipsis. */
export const RICH_TEXT_MAX = 2000;
export const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_RETRY_AFTER_S = 60;
const REQUEST_TIMEOUT_MS = 30_000;

/** 401: the key was rejected (revoked, regenerated or wrong). */
export class NotionAuthError extends Error {
  override name = "NotionAuthError";
}

/** 403/404: the object isn't shared with the integration, or doesn't exist. */
export class NotionNoAccess extends Error {
  override name = "NotionNoAccess";
}

/** Network fault, 5xx, a refused redirect, or rate-limit retries exhausted. */
export class NotionUnavailable extends Error {
  override name = "NotionUnavailable";
}

/** Any other error response, e.g. 400 validation_error. */
export class NotionItemError extends Error {
  override name = "NotionItemError";
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Json = Record<string, unknown>;

/** A page (a row of the source inbox) as Notion returns it. */
export interface NotionPage {
  id: string;
  created_time: string;
  properties: Record<string, Json>;
}

/** A block as Notion returns it; `children` is filled by the adapter for nested blocks. */
export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  children?: NotionBlock[];
  [type: string]: unknown;
}

export interface NotionApi {
  me(): Promise<void>;
  getPage(id: string): Promise<NotionPage>;
  createDatabase(parentPageId: string, title: string, properties: Json): Promise<{ databaseId: string; dataSourceId: string }>;
  getDataSource(id: string): Promise<void>;
  /** Every page matching the filter, sorted by created_time ascending; follows pagination. */
  queryDataSource(id: string, filter: Json): Promise<NotionPage[]>;
  /** Every child block; follows pagination. Not recursive. */
  listChildren(blockId: string): Promise<NotionBlock[]>;
  createRow(dataSourceId: string, properties: Json, children?: Json[]): Promise<string>;
  /** Writes Status and Reason only (REQ-022); the reason is truncated to 2,000 characters. */
  setStatus(pageId: string, form: StatusForm, status: string, reason: string): Promise<void>;
}

/** At most `max` UTF-16 units, ending in an ellipsis when cut; never splits a surrogate pair. */
export function truncate(text: string, max = RICH_TEXT_MAX): string {
  if (text.length <= max) return text;
  let cut = max - 1;
  const last = text.charCodeAt(cut - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut--;
  return `${text.slice(0, cut)}…`;
}

export function richText(content: string): Json[] {
  return content ? [{ type: "text", text: { content: truncate(content) } }] : [];
}

/** The body setStatus sends: Status and Reason, nothing else. */
export function statusBody(form: StatusForm, status: string, reason: string): Json {
  return { properties: { Status: { [form]: status ? { name: status } : null }, Reason: { rich_text: richText(reason) } } };
}

export interface HttpOptions {
  /** Tests only: point the client at a local server. */
  baseUrl?: string;
  /** Tests only: replace the Retry-After wait. */
  sleep?: (ms: number) => Promise<void>;
  maxRateLimitRetries?: number;
}

function causeOf(e: unknown): string {
  const c = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";
  return c || (e instanceof Error ? e.message : String(e));
}

export class HttpNotionApi implements NotionApi {
  readonly #key: string;
  private readonly base: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(apiKey: string, opts: HttpOptions = {}) {
    this.#key = apiKey;
    this.base = opts.baseUrl ?? NOTION_HOST;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRateLimitRetries ?? MAX_RATE_LIMIT_RETRIES;
  }

  private async request(method: "GET" | "POST" | "PATCH", path: string, body?: Json): Promise<Json> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${this.base}${path}`, {
          method,
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { Authorization: `Bearer ${this.#key}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (e) {
        const why = causeOf(e);
        throw new NotionUnavailable(/redirect/i.test(why) ? `Notion answered ${method} ${path} with a redirect, which the connector refuses` : `can't reach Notion (${why})`);
      }
      if (res.status === 429) {
        await res.body?.cancel();
        if (attempt >= this.maxRetries) throw new NotionUnavailable(`Notion is rate-limiting requests and ${String(this.maxRetries)} retries didn't clear it`);
        const after = Number(res.headers.get("retry-after"));
        await this.sleep(Math.min(Number.isFinite(after) && after > 0 ? after : 1, MAX_RETRY_AFTER_S) * 1000);
        continue;
      }
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel();
        throw new NotionUnavailable(`Notion answered ${method} ${path} with a redirect, which the connector refuses`);
      }
      const text = await res.text();
      let json: Json = {};
      try {
        const v: unknown = JSON.parse(text);
        if (v && typeof v === "object") json = v as Json;
      } catch {
        // non-JSON body; handled by status below
      }
      if (res.ok) return json;
      const code = typeof json["code"] === "string" ? json["code"] : "unknown";
      const msg = typeof json["message"] === "string" ? truncate(json["message"], 300) : `HTTP ${String(res.status)}`;
      if (res.status === 401) throw new NotionAuthError(`Notion rejected the API key (${code})`);
      if (res.status === 403 || res.status === 404) throw new NotionNoAccess(`${msg} (${code})`);
      if (res.status >= 500) throw new NotionUnavailable(`Notion is unavailable (HTTP ${String(res.status)}, ${code})`);
      throw new NotionItemError(`${msg} (${code})`, res.status, code);
    }
  }

  async me(): Promise<void> {
    await this.request("GET", "/v1/users/me");
  }

  async getPage(id: string): Promise<NotionPage> {
    return asPage(await this.request("GET", `/v1/pages/${encodeURIComponent(id)}`));
  }

  async createDatabase(parentPageId: string, title: string, properties: Json): Promise<{ databaseId: string; dataSourceId: string }> {
    const db = await this.request("POST", "/v1/databases", {
      parent: { type: "page_id", page_id: parentPageId },
      title: richText(title),
      initial_data_source: { properties },
    });
    const sources = db["data_sources"];
    const first: unknown = Array.isArray(sources) ? sources[0] : undefined;
    const dsId = first && typeof first === "object" ? (first as Json)["id"] : undefined;
    if (typeof db["id"] !== "string" || typeof dsId !== "string") throw new NotionItemError("Notion created a database but returned no data source ID", 200, "unexpected_response");
    return { databaseId: db["id"], dataSourceId: dsId };
  }

  async getDataSource(id: string): Promise<void> {
    await this.request("GET", `/v1/data_sources/${encodeURIComponent(id)}`);
  }

  async queryDataSource(id: string, filter: Json): Promise<NotionPage[]> {
    const out: NotionPage[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.request("POST", `/v1/data_sources/${encodeURIComponent(id)}/query`, {
        filter, sorts: [{ timestamp: "created_time", direction: "ascending" }], page_size: PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      for (const r of arrayOf(res["results"])) out.push(asPage(r));
      cursor = res["has_more"] === true && typeof res["next_cursor"] === "string" ? res["next_cursor"] : undefined;
    } while (cursor);
    return out;
  }

  async listChildren(blockId: string): Promise<NotionBlock[]> {
    const out: NotionBlock[] = [];
    let cursor: string | undefined;
    do {
      const q = new URLSearchParams({ page_size: String(PAGE_SIZE), ...(cursor ? { start_cursor: cursor } : {}) });
      const res = await this.request("GET", `/v1/blocks/${encodeURIComponent(blockId)}/children?${q.toString()}`);
      for (const b of arrayOf(res["results"])) out.push(asBlock(b));
      cursor = res["has_more"] === true && typeof res["next_cursor"] === "string" ? res["next_cursor"] : undefined;
    } while (cursor);
    return out;
  }

  async createRow(dataSourceId: string, properties: Json, children?: Json[]): Promise<string> {
    const page = await this.request("POST", "/v1/pages", {
      parent: { type: "data_source_id", data_source_id: dataSourceId }, properties, ...(children ? { children } : {}),
    });
    if (typeof page["id"] !== "string") throw new NotionItemError("Notion created a row but returned no ID", 200, "unexpected_response");
    return page["id"];
  }

  async setStatus(pageId: string, form: StatusForm, status: string, reason: string): Promise<void> {
    await this.request("PATCH", `/v1/pages/${encodeURIComponent(pageId)}`, statusBody(form, status, reason));
  }
}

function arrayOf(v: unknown): unknown[] {
  return Array.isArray(v) ? (v as unknown[]) : [];
}

function asPage(v: unknown): NotionPage {
  const o = (v && typeof v === "object" ? v : {}) as Json;
  if (typeof o["id"] !== "string") throw new NotionItemError("Notion returned a page with no ID", 200, "unexpected_response");
  const props = o["properties"];
  return {
    id: o["id"],
    created_time: typeof o["created_time"] === "string" ? o["created_time"] : "",
    properties: props && typeof props === "object" ? (props as Record<string, Json>) : {},
  };
}

function asBlock(v: unknown): NotionBlock {
  const o = (v && typeof v === "object" ? v : {}) as Json;
  if (typeof o["id"] !== "string" || typeof o["type"] !== "string") throw new NotionItemError("Notion returned a block with no ID or type", 200, "unexpected_response");
  return { ...o, id: o["id"], type: o["type"], has_children: o["has_children"] === true };
}

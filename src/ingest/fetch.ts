// URL extraction, thin detection and the fetcher (DES-008, D6, D11, REQ-010).
// GET only, fixed headers, no cookies or credentials, no environment proxy,
// http(s) only, at most 5 redirects each re-checked, private addresses refused
// at connect time (closing DNS rebinding), 15 s, 5 MB after decompression.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import { countWords } from "./capture.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { MAX_CHARS_TOTAL, capText, htmlToText, plainToText, sniffCharset } from "./html-text.ts";

export const MAX_URLS_FETCHED = 3;
export const MAX_REDIRECTS = 5;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const THIN_WORDS = 50;

const URL_RE = /https?:\/\/[^\s<>()[\]"'`]+/g;

/** Every http(s) URL outside frontmatter, trailing punctuation trimmed, de-duplicated in first-seen order. */
export function extractUrls(text: string): string[] {
  const body = splitFrontmatter(text).body;
  const seen: string[] = [];
  for (const m of body.matchAll(URL_RE)) {
    let u = m[0];
    for (;;) {
      if (/[.,;:!?]$/.test(u)) u = u.slice(0, -1);
      else if (u.endsWith(")") && (u.match(/\(/g) ?? []).length < (u.match(/\)/g) ?? []).length) u = u.slice(0, -1);
      else break;
    }
    if (u.length > "https://".length && !seen.includes(u)) seen.push(u);
  }
  return seen;
}

/** Thin: at least one URL and fewer than 50 words once frontmatter and URLs are removed. */
export function isThin(text: string): boolean {
  const body = splitFrontmatter(text).body;
  return extractUrls(text).length > 0 && countWords(body.replace(URL_RE, " ")) < THIN_WORDS;
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isBlockedAddress(addr: string): boolean {
  const fam = isIP(addr);
  if (fam === 4) return blocked.check(addr, "ipv4");
  if (fam === 6) return blocked.check(addr, "ipv6");
  return true;
}

export type FetchLevel = "connection" | "http";

export type FetchResult =
  | { ok: true; url: string; text: string }
  | { ok: false; url: string; error: string; level: FetchLevel };

class FetchFailure extends Error {
  readonly level: FetchLevel;
  constructor(message: string, level: FetchLevel) {
    super(message);
    this.level = level;
  }
}

const PRIVATE = "refused: resolves to a private address";

function allowPrivate(env: NodeJS.ProcessEnv): boolean {
  return env["MYCELIA_INGEST_ALLOW_PRIVATE"] === "1";
}

/** A DNS lookup that refuses any private, loopback or reserved address. */
function checkedLookup(env: NodeJS.ProcessEnv): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
      if (err) {
        callback(err, "", 4);
        return;
      }
      if (!allowPrivate(env) && addresses.some((a) => isBlockedAddress(a.address))) {
        callback(Object.assign(new Error(PRIVATE), { code: "EPRIVATE" }), "", 4);
        return;
      }
      if (options.all) (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
      else {
        const first = addresses[0];
        if (!first) callback(Object.assign(new Error("no address"), { code: "ENOTFOUND" }), "", 4);
        else callback(null, first.address, first.family);
      }
    });
  };
}

function classifyError(e: unknown): FetchFailure {
  if (e instanceof FetchFailure) return e;
  const err = e as NodeJS.ErrnoException & { name?: string };
  const code = err.code ?? "";
  if (code === "EPRIVATE" || err.message === PRIVATE) return new FetchFailure(PRIVATE, "http");
  if (err.name === "AbortError" || err.name === "TimeoutError" || code === "ABORT_ERR" || code === "ETIMEDOUT") return new FetchFailure("timeout", "connection");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_FAIL" || code === "EAI_NODATA") return new FetchFailure("DNS lookup failed", "connection");
  if (/^(ERR_TLS|ERR_SSL|CERT_|UNABLE_TO|DEPTH_ZERO|SELF_SIGNED|ERR_OSSL)/.test(code) || /certificate|tls|ssl/i.test(err.message)) return new FetchFailure("TLS error", "connection");
  return new FetchFailure("connection refused", "connection");
}

interface Response {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

async function readCapped(stream: Readable, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const b = chunk as Buffer;
    size += b.length;
    if (size > max) {
      stream.destroy();
      throw new FetchFailure("response too large", "http");
    }
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

function requestOnce(url: URL, signal: AbortSignal, env: NodeJS.ProcessEnv): Promise<Response> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, {
      method: "GET",
      headers: {
        "User-Agent": "mycelia-ingest/1",
        Accept: "text/html, text/plain, text/markdown;q=0.9",
        "Accept-Encoding": "gzip, br, deflate",
      },
      agent: false,
      lookup: checkedLookup(env),
      signal,
    });
    req.on("error", (e) => { reject(classifyError(e)); });
    req.on("response", (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new FetchFailure(`HTTP ${String(status)}`, "http"));
        return;
      }
      const enc = (res.headers["content-encoding"] ?? "").toLowerCase().trim();
      const stream: Readable =
        enc === "gzip" || enc === "x-gzip" ? res.pipe(createGunzip())
        : enc === "br" ? res.pipe(createBrotliDecompress())
        : enc === "deflate" ? res.pipe(createInflate())
        : res;
      readCapped(stream, MAX_BODY_BYTES)
        .then((body) => { resolve({ status, headers: res.headers, body }); })
        .catch((e: unknown) => { reject(e instanceof FetchFailure ? e : new FetchFailure("connection refused", "connection")); });
    });
    req.end();
  });
}

const TEXT_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain", "text/markdown"]);

function decode(body: Buffer, contentType: string, isHtml: boolean): string {
  let charset = /charset\s*=\s*"?([A-Za-z0-9_.:-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  if (!charset && isHtml) charset = sniffCharset(body.subarray(0, 2048).toString("latin1"));
  try {
    return new TextDecoder(charset ?? "utf-8", { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

/** Fetch one URL and return its cleaned text, or a stable failure text. */
export async function fetchUrl(raw: string, env: NodeJS.ProcessEnv = process.env): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, url: raw, error: "invalid URL", level: "http" };
  }
  try {
    for (let hop = 0; ; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchFailure(`unsupported scheme ${url.protocol.replace(":", "")}`, "http");
      if (url.username || url.password) throw new FetchFailure("URLs with credentials aren't fetched", "http");
      const host = url.hostname.replace(/^\[|\]$/g, "");
      if (isIP(host) && !allowPrivate(env) && isBlockedAddress(host)) throw new FetchFailure(PRIVATE, "http");
      const res = await requestOnce(url, AbortSignal.timeout(FETCH_TIMEOUT_MS), env);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.location;
        if (!loc) throw new FetchFailure(`HTTP ${String(res.status)}`, "http");
        if (hop >= MAX_REDIRECTS) throw new FetchFailure("too many redirects", "http");
        url = new URL(loc, url);
        continue;
      }
      const contentType = (res.headers["content-type"] ?? "").toLowerCase();
      const type = contentType.split(";")[0]?.trim() ?? "";
      if (!TEXT_TYPES.has(type)) throw new FetchFailure(`unsupported content type ${type || "unknown"}`, "http");
      const isHtml = type === "text/html" || type === "application/xhtml+xml";
      const decoded = decode(res.body, contentType, isHtml);
      return { ok: true, url: raw, text: isHtml ? htmlToText(decoded) : plainToText(decoded) };
    }
  } catch (e) {
    const f = classifyError(e);
    return { ok: false, url: raw, error: f.message, level: f.level };
  }
}

export interface SourcesResult {
  /** Cleaned text per fetched URL, in order. */
  sources: { url: string; text: string }[];
  failures: { url: string; error: string; level: FetchLevel }[];
}

/** Fetch at most the first 3 URLs (D11). Any failure holds the item (REQ-009). */
export async function fetchSources(urls: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<SourcesResult> {
  const sources: { url: string; text: string }[] = [];
  const failures: SourcesResult["failures"] = [];
  let budget = MAX_CHARS_TOTAL;
  for (const u of urls.slice(0, MAX_URLS_FETCHED)) {
    const r = await fetchUrl(u, env);
    if (!r.ok) {
      failures.push({ url: u, error: r.error, level: r.level });
      continue;
    }
    const text = capText(r.text, budget);
    budget -= text.length;
    sources.push({ url: u, text });
  }
  if (failures.length === 0 && countWords(sources.map((s) => s.text).join("\n")) < THIN_WORDS) {
    for (const s of sources) failures.push({ url: s.url, error: "no readable text", level: "http" });
    sources.length = 0;
  }
  return { sources, failures };
}

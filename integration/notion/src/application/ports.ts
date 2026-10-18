// Ports (DES-018, D8): the interfaces the two use cases need, shaped by them.
// Notion-only in practice (D7: no generic CaptureSource). Adapters implement
// these; the use cases import nothing else from outside application/ and
// domain/. Errors are part of a port's contract, so they live here too.
import type { Capture, ItemEvent, SourceRow, Status } from "../domain/capture.ts";

// --- Errors ----------------------------------------------------------------

/** The capture source can't be reached right now (network, 5xx, rate limit retries exhausted). Stops a run; no failure recorded. */
export class SourceUnavailable extends Error {
  override name = "SourceUnavailable";
}

/** The capture source rejected the key (401). */
export class SourceAuthRejected extends Error {
  override name = "SourceAuthRejected";
}

/** The page or source inbox isn't shared with the integration, or no longer exists (403/404). */
export class SourceNoAccess extends Error {
  override name = "SourceNoAccess";
}

/** One source item couldn't be read or converted: a pull failure (REQ-017). */
export class SourceItemError extends Error {
  override name = "SourceItemError";
}

/** The capture source refused the native Status form; setup falls back to select (D4). */
export class StatusFormRejected extends Error {
  override name = "StatusFormRejected";
}

/** The connector config's path isn't safe to hold the key (REQ-005). */
export class ConfigUnsafe extends Error {
  override name = "ConfigUnsafe";
}

/** The ingester can't start (its preflight failed). */
export class IngestNotReady extends Error {
  override name = "IngestNotReady";
}

/** Another pull run or ingester run holds the shared lock (REQ-030). */
export class RunLocked extends Error {
  override name = "RunLocked";
}

/** The ingester stopped the run (provider unavailable, rollback conflict). */
export class IngestAborted extends Error {
  override name = "IngestAborted";
}

// --- Capture source --------------------------------------------------------

export type StatusForm = "status" | "select";

/** The source inbox, as the pull run uses it. */
export interface SourceInbox {
  /** Throws SourceAuthRejected, SourceNoAccess or SourceUnavailable. Changes nothing. */
  check(): Promise<void>;
  /** Every row whose status isn't Ingested, oldest first by (createdTime, id). */
  rowsNotIngested(): Promise<SourceRow[]>;
  /** Read and convert one row's content. Throws SourceItemError for a pull failure. */
  read(row: SourceRow): Promise<Capture>;
  /** Write Status and Reason only (REQ-022). */
  setStatus(id: string, status: Status, reason: string): Promise<void>;
}

/** What setup needs from the capture source, for one key. */
export interface InboxProvisioner {
  /** Throws SourceAuthRejected. */
  verifyKey(): Promise<void>;
  /** Throws SourceNoAccess when the page isn't shared with the integration. */
  verifyParent(pageId: string): Promise<void>;
  /** True when the stored source inbox is still accessible with this key. */
  inboxAccessible(dataSourceId: string): Promise<boolean>;
  /** Create the source inbox from the template. Throws StatusFormRejected for the status form it can't create. */
  createInbox(parentPageId: string, form: StatusForm): Promise<{ databaseId: string; dataSourceId: string }>;
  /** Add the instructions row; returns its ID. */
  createInstructionsRow(dataSourceId: string, form: StatusForm): Promise<string>;
}

/** Builds a provisioner for a key read at setup time. */
export type ProvisionerFactory = (apiKey: string) => InboxProvisioner;

// --- Local state ------------------------------------------------------------

export interface ConnectorConfig {
  version: 1;
  api_key: string;
  database_id: string;
  data_source_id: string;
  instructions_page_id: string | null;
  status_property: StatusForm;
}

export interface ConfigStore {
  /** Repo-relative path, for messages. */
  readonly path: string;
  /** Throws ConfigUnsafe unless the path is gitignored and outside the agent's read scope (REQ-005). */
  guard(): Promise<void>;
  read(): Promise<ConnectorConfig | null>;
  write(config: ConnectorConfig): Promise<void>;
}

export interface RunEnd {
  counts: Record<string, number>;
  /** Run time outside ingestion (REQ-043). */
  pullMs: number;
  exit: number;
}

/** The connector's ledger (DES-007). Writes nothing until the run first changes something. */
export interface PullLedger {
  /** Remember the run; its run-start record is written before the first other record. */
  startRun(run: string): void;
  intent(id: string, capture: string): Promise<void>;
  pulled(id: string, capture: string, sha256: string): Promise<void>;
  item(event: ItemEvent): Promise<void>;
  /** Written only if this run wrote anything else. */
  runEnd(end: RunEnd): Promise<void>;
  isPulled(id: string): boolean;
  /** The capture name recorded for a pulled item. */
  captureOf(id: string): string | null;
  events(id: string): ItemEvent[];
  /** Intents with no pulled record (a crash between the two). */
  openIntents(): { id: string; capture: string }[];
  /** Pulled items not yet ingested or held, oldest pull first. */
  pending(): { id: string; capture: string }[];
  /** Every pulled item. */
  allPulled(): { id: string; capture: string }[];
}

// --- Vault ----------------------------------------------------------------

export interface VaultWriter {
  /** Paths the connector writes that aren't gitignored (an empty list means safe). */
  unignoredPaths(): Promise<string[]>;
  /** True if `00-inbox/capture/<name>` exists. */
  captureExists(name: string): Promise<boolean>;
  /** The `source_id` in that capture item's frontmatter, or null when it's missing, unreadable or has none. */
  captureSourceId(name: string): Promise<string | null>;
  /** Create `00-inbox/capture/<name>` exclusively; returns its SHA-256. Throws if it exists. */
  writeCapture(name: string, content: string): Promise<string>;
  /** True if `20-areas/<slug>.md` or `10-projects/<slug>.md` exists. */
  hintTargetExists(slug: string): Promise<boolean>;
  /** A free ask filename stem in `00-inbox/` starting with `base`. */
  uniqueAskStem(base: string): Promise<string>;
  /** Create `00-inbox/<stem>.md` exclusively; returns its repo-relative path. */
  writeAsk(stem: string, content: string): Promise<string>;
  /** Append a block to `daily/<date>.md`. */
  appendDaily(date: string, block: string): Promise<void>;
}

// --- Ingester -------------------------------------------------------------

export type IngestResult =
  | { kind: "ingested"; resource: string }
  | { kind: "held"; reason: string; ask: string }
  | { kind: "failed"; reason: string; ask?: string }
  /** Waiting on the network; resolved when the session closes. */
  | { kind: "deferred" }
  | { kind: "not-found" }
  | { kind: "already-held" };

export interface RunLock {
  release(): void;
}

/** One open ingest session (DES-001), driven item by item. */
export interface IngestRun {
  /** Throws IngestAborted to stop the run. */
  processOne(capture: string): Promise<IngestResult>;
  /** Resolves deferred items; returns their results by capture name. */
  close(): Promise<{ capture: string; result: IngestResult }[]>;
}

export interface Ingester {
  /** Throws IngestNotReady. Changes nothing. */
  preflight(): Promise<void>;
  /** Take the shared lock. Throws RunLocked. */
  lock(): Promise<RunLock>;
  /** Open a session under a lock the caller holds. */
  open(lock: RunLock): Promise<IngestRun>;
  /** True if the ingester's own ledger says this capture was ingested (REQ-020). */
  wasIngested(capture: string): boolean;
}

// --- Process --------------------------------------------------------------

export interface KeyPrompt {
  /** The API key from a hidden prompt or one line of stdin; never argv or env (REQ-008). */
  read(): Promise<string>;
}

export interface Clock {
  now(): Date;
}

export type Log = (message: string) => void;

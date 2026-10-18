// Setup use case (DES-005): connect the operator's Notion workspace by
// creating the source inbox from the template, idempotently. Nothing is
// created in Notion before step 7, and the key is never logged.
import {
  ConfigUnsafe, SourceAuthRejected, SourceNoAccess, SourceUnavailable, StatusFormRejected,
  type ConfigStore, type ConnectorConfig, type KeyPrompt, type Log, type ProvisionerFactory, type StatusForm,
} from "./ports.ts";

export const SETUP_USAGE = "usage: task notion:setup -- <Notion page URL or ID>";

export interface SetupDeps {
  config: ConfigStore;
  prompt: KeyPrompt;
  connect: ProvisionerFactory;
  /** A page ID from a page URL or ID, or null. */
  parsePage: (raw: string) => string | null;
  log: Log;
}

class SetupStop extends Error {
  override name = "SetupStop";
}

function why(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The message for an error setup stops on, or null for an unexpected one. */
function stopMessage(e: unknown): string | null {
  if (e instanceof SetupStop || e instanceof ConfigUnsafe || e instanceof SourceNoAccess) return e.message;
  if (e instanceof SourceAuthRejected) return "Notion rejected the key: copy the integration's secret again (Notion: Settings, Connections, Develop or manage integrations) and rerun setup. Nothing was created.";
  if (e instanceof SourceUnavailable) return `${why(e)}. Check the network and rerun setup.`;
  return null;
}

/** Returns the exit code: 0 done, 2 can't proceed (nothing created). */
export async function setupInbox(deps: SetupDeps, pageArg: string | undefined): Promise<number> {
  const { config, log } = deps;
  try {
    // (1) Path guard (REQ-005): before anything else.
    await config.guard();
    // (2) Existing config (REQ-007, REQ-009).
    const existing = await config.read();
    if (existing) return await reuse(deps, existing);
    // (4, checked before the prompt so a typo costs no key entry)
    const pageId = pageArg ? deps.parsePage(pageArg) : null;
    if (!pageId) throw new SetupStop(pageArg ? `"${pageArg}" isn't a Notion page URL or ID. ${SETUP_USAGE}` : SETUP_USAGE);
    // (3) The key, from the prompt only (REQ-008).
    const key = await deps.prompt.read();
    if (!key) throw new SetupStop("no key entered. Nothing was created.");
    const prov = deps.connect(key);
    // (5, 6) Key and parent page (REQ-006).
    await prov.verifyKey();
    await prov.verifyParent(pageId);
    // (7) Create from the template, native status form first (D4).
    let form: StatusForm = "status";
    let ids;
    try {
      ids = await prov.createInbox(pageId, "status");
    } catch (e) {
      if (!(e instanceof StatusFormRejected)) throw e;
      log(`Notion refused a native Status property (${e.message}); using a select, where a blank status means New`);
      form = "select";
      ids = await prov.createInbox(pageId, "select");
    }
    // (8) Config, then (9) the instructions row.
    const cfg: ConnectorConfig = { version: 1, api_key: key, database_id: ids.databaseId, data_source_id: ids.dataSourceId, instructions_page_id: null, status_property: form };
    await config.write(cfg);
    await config.write({ ...cfg, instructions_page_id: await prov.createInstructionsRow(ids.dataSourceId, form) });
    log(`Created the source inbox "Capture inbox" (database ${ids.databaseId}, status as ${form}); settings saved to ${config.path}. Add rows from the Notion app, then schedule task notion:pull.`);
    return 0;
  } catch (e) {
    const msg = stopMessage(e);
    if (msg === null) throw e;
    log(`ERROR: ${msg}`);
    return 2;
  }
}

async function reuse(deps: SetupDeps, cfg: ConnectorConfig): Promise<number> {
  const prov = deps.connect(cfg.api_key);
  let ok: boolean;
  try {
    ok = await prov.inboxAccessible(cfg.data_source_id);
  } catch (e) {
    if (e instanceof SourceAuthRejected) {
      throw new SetupStop(`Notion rejected the key stored in ${deps.config.path}. To start over, delete \`${deps.config.path}\` and run setup again. Nothing was created.`);
    }
    throw e;
  }
  if (!ok) {
    throw new SetupStop(`the source inbox in ${deps.config.path} (database ${cfg.database_id}) is no longer accessible: it was deleted or unshared. To start over, delete \`${deps.config.path}\` and run setup again. Nothing was created.`);
  }
  if (!cfg.instructions_page_id) {
    await deps.config.write({ ...cfg, instructions_page_id: await prov.createInstructionsRow(cfg.data_source_id, cfg.status_property) });
    deps.log("Added the missing instructions row.");
  }
  deps.log(`Already set up: the existing source inbox is database ${cfg.database_id} (settings in ${deps.config.path}). Nothing was created.`);
  return 0;
}

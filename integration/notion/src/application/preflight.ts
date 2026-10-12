// Can-start checks (DES-009 step 1, REQ-028, REQ-036): config, key, source
// inbox, gitignore probes and the ingester's readiness. Changes nothing.
import {
  IngestNotReady, SourceAuthRejected, SourceNoAccess, SourceUnavailable,
  type ConfigStore, type ConnectorConfig, type Ingester, type Log, type SourceInbox, type VaultWriter,
} from "./ports.ts";

export interface PreflightDeps {
  config: ConfigStore;
  /** Builds the source inbox for a config. */
  connect: (config: ConnectorConfig) => SourceInbox;
  ingester: Ingester;
  vault: VaultWriter;
  log: Log;
}

export type CanStart = { ok: true; config: ConnectorConfig; inbox: SourceInbox } | { ok: false; message: string };

function why(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function canStart(deps: PreflightDeps): Promise<CanStart> {
  const no = (message: string): CanStart => ({ ok: false, message: `${message} Nothing was changed.` });
  let config: ConnectorConfig | null;
  try {
    await deps.config.guard();
    config = await deps.config.read();
  } catch (e) {
    return no(why(e));
  }
  if (!config) return no(`the Notion connector isn't set up (no ${deps.config.path}): run \`task notion:setup -- <Notion page URL>\` first.`);
  const unignored = await deps.vault.unignoredPaths();
  if (unignored.length > 0) return no(`these paths aren't gitignored, so a pull could write a tracked file: ${unignored.join(", ")}. Restore the framework's .gitignore.`);
  const inbox = deps.connect(config);
  try {
    await inbox.check();
  } catch (e) {
    if (e instanceof SourceAuthRejected) return no(`Notion rejected the API key in ${deps.config.path}: it was regenerated or the integration was removed. Delete ${deps.config.path} and run \`task notion:setup\` again.`);
    if (e instanceof SourceNoAccess) return no(`the source inbox (database ${config.database_id}) isn't accessible: it was deleted, or unshared from the integration (page menu, Connections). ${why(e)}.`);
    if (e instanceof SourceUnavailable) return no(`can't check the source inbox: ${why(e)}.`);
    throw e;
  }
  try {
    await deps.ingester.preflight();
  } catch (e) {
    if (e instanceof IngestNotReady) return no(`the ingester can't start: ${why(e)}`);
    throw e;
  }
  return { ok: true, config, inbox };
}

/** `task notion:pull:preflight`: 0 ready, 2 not. */
export async function preflight(deps: PreflightDeps): Promise<number> {
  const r = await canStart(deps);
  if (!r.ok) {
    deps.log(`ERROR: ${r.message}`);
    return 2;
  }
  deps.log(`preflight ok: source inbox (database ${r.config.database_id}) reachable, ingester ready`);
  return 0;
}

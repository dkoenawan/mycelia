// Composition root (DES-011, D8): the only place that constructs adapters and
// hands them to the use cases.
//   node integration/notion/src/cli.ts setup <page URL or ID>
//   node integration/notion/src/cli.ts pull [--preflight]
// Called by `task notion:setup`, `task notion:pull` and `task notion:pull:preflight`.
// Never runs git. The API key is read from a prompt or stdin, never argv or env.
import path from "node:path";
import { ClaudeCodeProvider } from "../../../src/ingest/agent/claude-code.ts";
import { log } from "../../../src/lib/log.ts";
import { REPO_ROOT } from "../../../src/lib/paths.ts";
import { StdinKeyPrompt } from "./adapters/cli/key-prompt.ts";
import { YamlConfigStore } from "./adapters/config/yaml-config.ts";
import { SessionIngester } from "./adapters/ingest/session.ts";
import { JsonlPullLedger, PULL_LEDGER_REL } from "./adapters/ledger/jsonl-ledger.ts";
import { HttpNotionApi } from "./adapters/notion/http-client.ts";
import { NotionProvisioner, NotionSourceInbox, parsePageId } from "./adapters/notion/source-inbox.ts";
import { loadTemplate } from "./adapters/notion/template.ts";
import { FsVaultWriter } from "./adapters/vault/vault-writer.ts";
import { preflight } from "./application/preflight.ts";
import { EXIT, pullInbox } from "./application/pull-inbox.ts";
import { setupInbox } from "./application/setup-inbox.ts";
import type { ConnectorConfig } from "./application/ports.ts";

const USAGE = "usage: node integration/notion/src/cli.ts setup <Notion page URL or ID> | pull [--preflight]";

const config = new YamlConfigStore(REPO_ROOT);
const connect = (cfg: ConnectorConfig): NotionSourceInbox => new NotionSourceInbox(new HttpNotionApi(cfg.api_key), { dataSourceId: cfg.data_source_id, form: cfg.status_property });

async function main(args: string[]): Promise<number> {
  const [cmd, ...rest] = args;
  if (cmd === "setup" && rest.length <= 1) {
    const template = loadTemplate();
    return setupInbox({ config, prompt: new StdinKeyPrompt(), connect: (key) => new NotionProvisioner(new HttpNotionApi(key), template), parsePage: parsePageId, log }, rest[0]?.trim() || undefined);
  }
  if (cmd === "pull" && (rest.length === 0 || (rest.length === 1 && rest[0] === "--preflight"))) {
    const ingester = new SessionIngester({ root: REPO_ROOT, provider: new ClaudeCodeProvider(), log });
    const deps = {
      config, connect, ingester, log,
      vault: new FsVaultWriter(REPO_ROOT),
      ledger: new JsonlPullLedger(path.join(REPO_ROOT, PULL_LEDGER_REL)),
      clock: { now: () => new Date() },
    };
    if (rest[0] === "--preflight") return preflight(deps);
    const onSignal = (sig: NodeJS.Signals): void => {
      ingester.releaseAll();
      process.exit(sig === "SIGINT" ? 130 : 143);
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    return pullInbox(deps);
  }
  process.stderr.write(`${USAGE}\n`);
  return EXIT.cantStart;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  log(`ERROR: unexpected failure: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  process.exitCode = EXIT.abort;
}

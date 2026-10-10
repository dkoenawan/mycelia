// Entrypoint (DES-001): node src/ingest/cli.ts [--preflight]
// Called by `task ingest-inbox` and `task ingest-inbox:preflight`. Never runs
// git add, git commit or git checkout.
import { log } from "../lib/log.ts";
import { REPO_ROOT } from "../lib/paths.ts";
import type { AgentProvider } from "./agent/provider.ts";
import { ClaudeCodeProvider } from "./agent/claude-code.ts";
import { EXIT, runIngest } from "./run.ts";

/** The MVP's one provider; choosing one at install is #19. */
export function getProvider(): AgentProvider {
  return new ClaudeCodeProvider();
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--preflight")) {
  process.stderr.write("usage: node src/ingest/cli.ts [--preflight]\n");
  process.exit(EXIT.cantStart);
}

try {
  process.exitCode = await runIngest({ root: REPO_ROOT, provider: getProvider(), log, preflightOnly: args[0] === "--preflight", signals: true });
} catch (e) {
  log(`ERROR: unexpected failure: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  process.exitCode = EXIT.abort;
}

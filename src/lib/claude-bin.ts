// Port of common.sh's resolve_claude: $CLAUDE_BIN, PATH, ~/.local/bin,
// /usr/local/bin, in that order. Cron doesn't source a shell profile, so the CLI
// is often missing from PATH.
import { accessSync, constants, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function isExecutable(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveClaude(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env["CLAUDE_BIN"];
  if (explicit && isExecutable(explicit)) return explicit;
  for (const dir of (env["PATH"] ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "claude");
    if (isExecutable(candidate)) return candidate;
  }
  const home = env["HOME"] ?? os.homedir();
  for (const candidate of [path.join(home, ".local", "bin", "claude"), "/usr/local/bin/claude"]) {
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

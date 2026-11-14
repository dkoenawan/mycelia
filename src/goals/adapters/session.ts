// The goal-setting session launcher (DES-006, D1, D2):
//   mycelia goals session <year> [--continue]
// (1) checks the year; (2) resolves `claude` and runs ClaudeCodeProvider's
// preflight, so a missing or logged-out CLI fails before anything is written;
// (3) lists the areas; (4) refuses if the year already has an inbox draft,
// unless --continue, which passes that draft to the agent as its starting
// point; (5) spawns interactive Claude Code with the committed prompt and only
// the save step as a tool. When Claude Code exits, it validates the draft and
// prints the result and the sign-off command.
//
// Spike findings, verified on 2026-11-14 against Claude Code CLI 2.1.325 on
// Linux x64 (in `-p` mode with the same flags; the interactive launch drops
// `-p` and nothing else):
//
// - `--tools Bash` limits the built-in tool set to Bash. Read, Write, Edit and
//   the rest aren't offered.
// - `--allowedTools "Bash(<prefix>:*)"` with `--permission-mode dontAsk` runs a
//   command that starts with the prefix, without a prompt, and denies anything
//   else outright, with no prompt the operator could approve by mistake:
//   `touch x`, `<allowed> && touch x`, and the allowed command fed by a heredoc
//   or a pipe were all denied. A single quoted argument is allowed, including
//   JSON with spaces, double quotes, and an apostrophe written as '\''. So the
//   agent passes the draft as one argument (save-draft also reads stdin, for the
//   operator).
// - `--setting-sources ""` loads no user, project or local settings, so no
//   permission rule or hook from them can widen the tool set. The login still
//   works: it isn't a setting.
// - `--strict-mcp-config` with no `--mcp-config` gives no MCP servers.
// - `--system-prompt <text>` replaces the default system prompt, and a final
//   positional argument is the first user message of the interactive session.
//   `--allowedTools` and `--tools` take several values, so the positional
//   message must not follow one of them directly.
// - `--disable-slash-commands` isn't passed: it would also disable /exit, which
//   the prompt tells the operator to use. With only Bash allowed, the agent
//   can't invoke a skill itself.
import { spawn as nodeSpawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ClaudeCodeProvider } from "../../ingest/agent/claude-code.ts";
import { ProviderNotReady } from "../../ingest/agent/provider.ts";
import { resolveClaude } from "../../lib/claude-bin.ts";
import type { AreaIndex, IgnoreProbe, VisionVault } from "../application/ports.ts";
import { parse } from "../domain/parse.ts";
import { hasErrors, validate } from "../domain/validate.ts";

export const EXIT_SESSION = { ok: 0, noDraft: 1, cantStart: 2 } as const;

/** The one command the agent may run (D2). Relative to the repository root, the agent's cwd. */
export function saveCommand(year: number): string {
  return `node src/mycelia.ts goals save-draft ${year}`;
}

export function loadPromptTemplate(): string {
  return readFileSync(path.join(import.meta.dirname, "..", "session-prompt.txt"), "utf8");
}

export function renderPrompt(template: string, v: { year: number; areas: readonly string[]; draft: string | null }): string {
  const areas = v.areas.length > 0 ? v.areas.join(", ") : "(none yet: the operator has no notes in 20-areas/)";
  const draft = v.draft === null
    ? "There's no draft yet. Start with the first main goal's centre goal."
    : `Continue from this existing draft. Confirm it with the operator, then carry on from the first step that's missing. Your saves will rewrite it.\n\n${v.draft.trimEnd()}`;
  return template
    .replaceAll("{{year}}", String(v.year))
    .replaceAll("{{areas}}", areas)
    .replaceAll("{{save_command}}", saveCommand(v.year))
    .replaceAll("{{draft}}", draft);
}

/** The Claude Code arguments for the session (see the spike notes above). */
export function claudeArgs(year: number, systemPrompt: string, firstMessage: string): string[] {
  return [
    "--tools", "Bash",
    "--allowedTools", `Bash(${saveCommand(year)}:*)`,
    "--permission-mode", "dontAsk",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--system-prompt", systemPrompt,
    firstMessage,
  ];
}

export type Spawner = (bin: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv }) => Promise<number>;

export interface SessionDeps {
  root: string;
  env: NodeJS.ProcessEnv;
  resolveClaude(env: NodeJS.ProcessEnv): string | null;
  /** Throws ProviderNotReady with a message saying how to fix it. */
  preflight(): Promise<void>;
  areas: AreaIndex;
  vault: Pick<VisionVault, "readDraft" | "writePaths">;
  probe: IgnoreProbe;
  today(): string;
  spawn: Spawner;
  template: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

/** Run Claude Code in the foreground. The child gets the terminal; Ctrl+C is its to handle. */
export const spawnInteractive: Spawner = (bin, args, opts) =>
  new Promise((resolve, reject) => {
    const ignore = (): void => undefined;
    process.on("SIGINT", ignore);
    const child = nodeSpawn(bin, args, { cwd: opts.cwd, env: opts.env, stdio: "inherit" });
    const done = (): void => { process.off("SIGINT", ignore); };
    child.on("error", (e) => { done(); reject(e); });
    child.on("exit", (code, signal) => { done(); resolve(code ?? (signal ? 1 : 0)); });
  });

export function defaultSessionDeps(root: string, base: Pick<SessionDeps, "areas" | "vault" | "probe" | "today" | "out" | "err">): SessionDeps {
  return {
    ...base,
    root,
    env: process.env,
    resolveClaude,
    preflight: () => new ClaudeCodeProvider().preflight(),
    spawn: spawnInteractive,
    template: loadPromptTemplate(),
  };
}

const USAGE = "usage: mycelia goals session <year> [--continue]   (a four-digit year)";

export async function runSession(args: string[], deps: SessionDeps): Promise<number> {
  // (1) The year.
  const flags = args.filter((a) => a.startsWith("--"));
  const pos = args.filter((a) => !a.startsWith("--"));
  const cont = flags.includes("--continue");
  if (pos.length !== 1 || !/^\d{4}$/.test(pos[0] ?? "") || flags.some((f) => f !== "--continue")) {
    deps.err(USAGE);
    return EXIT_SESSION.cantStart;
  }
  const year = Number(pos[0]);
  const draftRel = `00-inbox/${year}-goals.md`;

  // (2) Claude Code installed and logged in.
  const bin = deps.resolveClaude(deps.env);
  if (bin === null) {
    deps.err("can't start the session: Claude Code CLI not found (checked $CLAUDE_BIN, PATH, ~/.local/bin, /usr/local/bin). Install Claude Code, then retry. Nothing was changed.");
    return EXIT_SESSION.cantStart;
  }
  try {
    await deps.preflight();
  } catch (e) {
    if (e instanceof ProviderNotReady) {
      deps.err(`can't start the session: ${e.message}`);
      return EXIT_SESSION.cantStart;
    }
    throw e;
  }

  // The save step's paths must be gitignored before anything can be written.
  const open = await deps.probe.unignored(deps.vault.writePaths(year, deps.today()));
  if (open.length > 0) {
    deps.err(`can't start the session: these paths aren't gitignored, so a goals note could be committed: ${open.join(", ")}. Restore the framework's .gitignore. Nothing was changed.`);
    return EXIT_SESSION.cantStart;
  }

  // (3) The areas to offer.
  const areas = await deps.areas.list();

  // (4) An existing draft.
  const existing = await deps.vault.readDraft(year);
  if (existing !== null && !cont) {
    deps.err(`can't start the session: ${draftRel} already exists. Review it and run \`npx mycelia goals sign-off ${year}\`, or run \`npx mycelia goals session ${year} --continue\` to carry on from it (the session rewrites it). Nothing was changed.`);
    return EXIT_SESSION.cantStart;
  }
  if (existing !== null) deps.out(`Continuing from ${draftRel}. The session rewrites it from what you agree, so hand edits not confirmed in the session are replaced.`);

  // (5) The conversation.
  const prompt = renderPrompt(deps.template, { year, areas, draft: existing });
  const first = existing === null ? `Let's set my goals for ${year}.` : `Let's continue my draft goals for ${year}.`;
  const code = await deps.spawn(bin, claudeArgs(year, prompt, first), { cwd: deps.root, env: deps.env });
  if (code !== 0) deps.err(`Claude Code exited with code ${code}.`);

  // After the conversation: validate what was saved.
  const draft = await deps.vault.readDraft(year);
  if (draft === null) {
    deps.out(`No draft was written for ${year}: nothing was agreed and saved. Run \`npx mycelia goals session ${year}\` to start again.`);
    return EXIT_SESSION.noDraft;
  }
  const diagnostics = validate(draft, new Set(areas));
  for (const d of diagnostics) deps.out(`${draftRel}: ${d.severity}: ${d.where}: ${d.message}`);
  if (hasErrors(diagnostics)) {
    deps.out(`The draft in ${draftRel} has errors. Fix them, then check it with \`npx mycelia goals validate ${draftRel}\`.`);
    return EXIT_SESSION.noDraft;
  }
  const g = parse(draft);
  deps.out(`Draft saved: ${draftRel} (${g.mainGoals.length} main goal(s), ${g.secondaryGoals.length} secondary goal(s)). Review or edit it there.`);
  deps.out(`Nothing counts as your ${year} goals until you sign it off: npx mycelia goals sign-off ${year}`);
  return EXIT_SESSION.ok;
}

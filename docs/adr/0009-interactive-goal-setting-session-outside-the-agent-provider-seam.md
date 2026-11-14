---
id: "009"
title: The goal-setting session runs as interactive Claude Code, outside the agent-provider seam
date: 2026-11-14
status: accepted
deciders: [operator]
---

## Context

Setting the year's goals takes a conversation. The operator and the agent work through
each main goal (its centre goal, its pillars, each pillar's actions and the areas each
pillar touches), then the secondary goals. That takes many turns, and the operator may
stop partway through.

ADR-0007 routes every agent step through an `AgentProvider` seam. Its `run()` is a
one-shot, non-interactive call: a system prompt, a user prompt, an output schema, a read
scope, a turn cap and a timeout. The seam has no multi-turn call and no terminal
conversation. Adding providers behind it is #19.

The session also has a hard safety constraint. It must never change `20-areas/`, or
anything except the year's draft in the root of `00-inbox/`. A goal-setting agent that
can write anywhere would put the operator's goals into area notes, which only hold
accumulated knowledge.

## Decision Drivers

- A real multi-turn conversation, without building a chat interface inside a one-week
  appetite.
- Confinement by code, not by instructions: the agent's only write path is a tested
  command.
- Deterministic checks before the conversation (Claude Code installed and logged in, no
  existing draft, output paths gitignored) and after it (validate the draft).
- Reuse the existing provider's login check, rather than duplicating it.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **A TypeScript launcher, `mycelia goals session <year>`, that starts interactive Claude Code with a committed prompt and a tool set limited to the save step (chosen)** | A true conversation in Claude Code's own interface, with no chat loop to build. The launcher fixes the prompt, the area list and the tools in code. Checks run before and after the conversation. It reuses `ClaudeCodeProvider.preflight()` for the login check | It depends on the Claude Code CLI directly, outside the `AgentProvider` seam. CLI flags can change between versions | — chosen |
| A Claude Code project skill, run as `/year-goals <year>` in any session in the vault | Least code; works in any session the operator already has open | The session has every tool and the operator's settings, so confinement rests on instructions alone. No deterministic step before or after | Fails the confinement-by-code driver |
| A TypeScript chat loop that calls `AgentProvider.run()` once per turn | Stays inside the seam, and testable with a fake provider | A chat interface to build. With no multi-turn call, every turn replays the transcript. A worse conversation than Claude Code's | Fails the appetite and conversation drivers |

## Decision Outcome

Chosen: **the launcher (option A)**. It's the only option that gives a real conversation
and confines the agent in code within the appetite.

`mycelia goals session <year> [--continue]` does this in order:

1. Checks the year.
2. Resolves `claude` (`src/lib/claude-bin.ts`) and runs `ClaudeCodeProvider.preflight()`,
   so a missing or logged-out CLI fails before anything is written.
3. Checks that every path the save step may write is gitignored.
4. Lists the area names in `20-areas/`, reading them only.
5. Refuses if the year already has a draft in the inbox, unless `--continue` is given.
6. Spawns interactive Claude Code with the committed prompt (`src/goals/session-prompt.txt`).
   The launcher ignores SIGINT while Claude Code runs, so Ctrl+C reaches Claude Code.
7. When Claude Code exits, validates the draft and prints the result and the sign-off
   command.

The agent saves through one command, `node src/mycelia.ts goals save-draft <year>
'<draft JSON>'`. That command checks the draft, renders the note and writes only
`00-inbox/<year>-goals.md`. The agent saves after each agreed step, so stopping early
keeps what was agreed.

The Agent SDK is still used where a programmatic check fits: the login preflight. The
SDK doesn't provide an interactive terminal conversation, so the conversation itself
runs in the Claude Code CLI.

### Tool limits as observed

These are the Claude Code flags the launcher passes, and what they do. They were checked
against Claude Code CLI 2.1.325, in `-p` mode with the same flags, and checked again with
the launcher's exact flags. The per-flag detail is in the header of
`src/goals/adapters/session.ts`.

- `--tools Bash` offers only the Bash tool. Read, Write, Edit and the rest aren't offered.
- `--allowedTools "Bash(node src/mycelia.ts goals save-draft <year>:*)"` with
  `--permission-mode dontAsk` runs the save command without a prompt.
- **Writes go only through the save step.** Every other write or delete is denied
  outright, with no prompt the operator could approve by mistake. That includes
  `touch`, `<save command> && touch …` and writes into `20-areas/`.
- **Read-only commands inside the repository are allowed.** Claude Code's own read-only
  command allowance still applies, so commands such as `cat`, `grep` and `git status`
  run inside the repository. Reads outside it are denied. Piping into the save command
  (`echo … | <save command>`) also runs, and still writes only the draft. These are
  harmless, and the agent reads the area names anyway, so the limits are kept as they
  are.
- `--setting-sources ""` loads no user, project or local settings, so no permission
  rule or hook from them can widen the tool set. The login still works.
- `--strict-mcp-config`, with no MCP config, gives no MCP servers.
- `--system-prompt` replaces the default system prompt.
- `--disable-slash-commands` isn't passed, because it would also disable `/exit`.

## Consequences

- **Now easier:** goal setting is a natural conversation. Whatever the model does, the
  only file it can change is the year's draft, and that draft always passes the
  validator, because the save command renders it from checked structured input.
- **Now harder:** the session depends on Claude Code's CLI flags and permission
  behaviour directly, not through the provider seam. A provider added under #19 doesn't
  automatically get an interactive session. The DIP trade-off on the launcher is
  accepted.
- **New constraints:** the save command stays the session's only write path. Anything
  the session needs to persist goes through it. The prompt tells the agent to pass the
  draft as one single-quoted argument, because the prefix permission rule denies
  heredocs and compound commands. When Claude Code is upgraded, the flags' behaviour is
  re-checked and the launcher's header is updated.

## Revisit Conditions

- A Claude Code release changes `--tools`, `--allowedTools`, `dontAsk` or
  `--setting-sources` so that a write other than the save command runs without a denial.
- #19 adds a second provider that the operator wants to use for goal setting.
- The `AgentProvider` seam gains a multi-turn, interactive call.
- A second interactive, agent-guided session is added, such as the amendment flow (#46).
  Then the launcher pattern is extracted for reuse, or this decision is reconsidered.

Origin: #36

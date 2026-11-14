---
id: "010"
title: Taskfile is for installation only; runtime commands are subcommand groups of one mycelia command
date: 2026-11-14
status: accepted
deciders: [operator]
---

## Context

ADR-0001 chose Taskfile (go-task) for install, doctor and update. Over time, runtime
features were added to it as well: `task ingest-inbox` runs the inbox ingester, and
`task notion:setup` and `task notion:pull` run the Notion connector, each with a
preflight target.

Year goal setting adds several runtime commands an operator runs by hand: a guided
session, saving a draft, sign-off and validation. Downstream goal-pursuit features (#37
to #42) will add more. Adding each as a Taskfile target would grow the Taskfile into the
runtime interface, and go-task reports exit status 201 for any failing command. That
hides the distinct exit codes the TypeScript runners (ADR-0007) return, which is a known
issue in the README.

The operator ruled that Taskfile is for installation only, and that mycelia's runtime
commands are TypeScript.

## Decision Drivers

- One discoverable command for every runtime feature, with shared help and error
  handling.
- Dispatch, arguments and exit codes tested under `task check:node`, like the rest of the
  TypeScript code.
- Exit codes that reach the caller unchanged.
- A new feature adds a group, not a new wiring file or a new Taskfile target.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **One `mycelia` entry point (`src/mycelia.ts`, the `package.json` `bin`) with subcommand groups (chosen)** | One command for every runtime feature. It's TypeScript, so dispatch and exit codes are tested. Later features add a group | Until the older targets move, runtime commands are split between `mycelia` and Taskfile. Running it needs `npx`, `npm run`, or `npm link` | — chosen |
| Taskfile targets per feature (`task goals:*`), like `ingest-inbox` | Matches the existing runtime targets | Contrary to the operator's ruling. go-task hides exit codes (201 for any failure) | Operator's ruling; fails the exit-code driver |
| One `bin` per feature (`mycelia-goals`, …) | No dispatcher | The number of commands grows with every feature, with no shared help or error handling | Fails the one-command driver |

## Decision Outcome

Chosen: **Taskfile is for installation only (install, dependencies, area bootstrap,
doctor and the `check:node` gate). Every runtime command is a subcommand group of one
`mycelia` TypeScript command.**

- **Entry point.** `src/mycelia.ts`, with a `#!/usr/bin/env node` shebang, registered as
  `"bin": {"mycelia": "src/mycelia.ts"}` and as a `"mycelia"` script in `package.json`.
  It runs as `npx mycelia <group> <command> [args]` in the repository, as
  `npm run mycelia -- …`, or as `mycelia …` after `npm link`.
- **Groups.** The dispatcher holds a map from group name to a summary and a lazily
  imported module. Each group's module exports `run(args): Promise<number>`, and only the
  named group is imported. `goals` is the first group (`src/goals/cli.ts`).
- **Exit codes.** A group's exit code is passed through unchanged. The dispatcher itself
  exits 2 for a usage error (no group, `help`, or an unknown group, printing the groups)
  and 3 for an unexpected failure, so that can't be mistaken for a group's 0, 1 or 2.
- **Calling it from tools.** A tool that needs an exact command, such as a permission
  rule, calls the same entry point through Node, `node src/mycelia.ts …`. That works in
  every clone after `task deps:node`, with no `npm link` (see ADR-0009).
- **Existing targets.** `ingest-inbox`, `ingest-inbox:preflight`, `notion:setup`,
  `notion:pull` and `notion:pull:preflight` predate this decision and stay in the
  Taskfile until #47 moves them under `mycelia`.

This refines how ADR-0001 and ADR-0007 are applied, and changes neither. ADR-0001's
Taskfile remains the installer and doctor. ADR-0007's TypeScript runners are what the
`mycelia` groups run.

## Consequences

- **Now easier:** a runtime feature adds one entry to the group map and a `cli.ts`
  module. Its arguments and exit codes are tested through `dispatch()` and the group's
  `run()`, with no go-task in the way.
- **Now harder:** until #47 lands, there are two ways to run things. Installation and the
  older runtime features use `task`, and new runtime features use `mycelia`. The
  operator either prefixes commands with `npx` or runs `npm link` once.
- **New constraints:** no new runtime Taskfile targets. CLAUDE.md's "Writing runners"
  section says so. A new runtime command is a `mycelia` group whose `run()` returns its
  exit code rather than calling `process.exit`.

## Revisit Conditions

- `npx mycelia` or the `bin` path stops resolving on a supported platform, for example
  if Node's type stripping won't run the `bin` entry.
- The group map grows past what one flat level of `mycelia <group> <command>` can keep
  discoverable.
- An installer's platform can't run Node, so a runtime command has to work without it.

Origin: #36

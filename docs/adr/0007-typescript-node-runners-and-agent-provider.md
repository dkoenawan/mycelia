---
id: "007"
title: TypeScript on Node for workflow runners, and an agent-provider seam
date: 2026-10-04
status: proposed
deciders: [operator]
---

## Context

Until now every mycelia runner was bash sourcing `scripts/lib/common.sh`, with small
embedded Python where parsing was needed (ADR-0005). The inbox ingester (ADR-0006) is
the first runner with real transactional logic — a per-item journal, rollback, crash
recovery — plus an HTTP fetcher with address checks, HTML parsing and an agent step
driven through an SDK. That is more than bash should carry.

The operator decided the language: transactional and workflow code, and any future API
endpoints, go in Node; Python is reserved for data-analysis work later. Porting the
existing bash scripts is #18. Choosing an agent provider and auth mode at install is
#19. Both are out of scope here, but this ADR sets the seams they plug into.

## Decision Drivers

- One language per runner, with real types, tests and linting as the gate.
- No build artifact to keep in sync with source, and tests that run the same files
  production does.
- A small, pinned supply chain; installs that don't run third-party scripts.
- The CLAUDE.md runner rules — validate first, deterministic selection, gate before
  landing, record failures, never swallow errors, name files explicitly — must carry
  over unchanged.
- The agent step must not be hard-wired to one vendor, and must fail fast, before any
  write, when the agent can't run (missing CLI, logged out).

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **TypeScript on Node LTS, run through Node's type stripping (chosen)** | No build step; stack traces point at source; tests run production files; the operator's chosen language for workflow code | Erasable-only syntax; Node ≥ 22.18 required | — chosen |
| TypeScript compiled by `tsc` into a gitignored `dist/` | Any TypeScript feature | A build artifact that can drift from source | Kept as the fallback (below) |
| TypeScript through a loader (`tsx`) | Any TypeScript feature, no `dist/` | An extra dependency for no gain over type stripping | Unneeded |
| Python with the Python Agent SDK | Good tooling | Superseded by the operator's language decision | Operator's decision |
| Bash runner around a second language | Matches existing scripts | Two languages per runner; transactional logic in bash | Rejected at the Design gate |

## Decision Outcome

Chosen: **new workflow runners are TypeScript under `src/`, run directly by Node LTS
through type stripping (no build), managed with npm and an exact-pinned, committed
lockfile, and gated by `tsc` strict, ESLint with `typescript-eslint` and `node:test`.**

- **Execution.** `node src/<runner>/cli.ts`. `tsconfig.json` has `noEmit`, `strict`,
  `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax` and
  `allowImportingTsExtensions`; imports use `.ts`. `engines.node` is `>=22.18.0`, the
  first 22.x release with type stripping on by default; `.nvmrc` pins the LTS major.
- **Dependencies.** npm, exact versions, `npm ci` from the committed lockfile, and
  `.npmrc` with `engine-strict`, `save-exact` and `ignore-scripts`. Runtime
  dependencies are kept to what the runner can't reasonably do with built-ins; HTTP,
  DNS checks, hashing, locking and tests use Node's own modules.
- **Pinned versions (at adoption).** Runtime: `@anthropic-ai/claude-agent-sdk`,
  `yaml` and `parse5`, plus the SDK's three declared peer dependencies (`zod`,
  `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`). They aren't marked optional, so
  npm would install them anyway; pinning them in `package.json` makes the choice
  explicit and reviewable. Dev: `typescript` is held at the newest release inside
  `typescript-eslint`'s supported range (6.0.x, not 7.x), and `@types/node` tracks the
  minimum supported Node major (22), so the type check rejects APIs that minimum
  lacks. No package in the tree has an install script, so `ignore-scripts` costs
  nothing; the SDK's bundled CLI ships as platform-specific optional packages.
- **Gates.** `task check:node` runs `npm run check` (typecheck, lint, test). A separate
  `ci.yml` runs it on push and pull request; the release smoke test is unchanged.
- **Runner rules.** The CLAUDE.md "Writing runners" rules apply unchanged to
  TypeScript runners. `src/lib/` mirrors the `common.sh` helpers a runner needs (log
  format, `claude` resolution order, daily-note frontmatter) until #18 retires the bash
  side; a test pins the shared formats so the two can't drift silently.
- **Agent-provider seam.** Agent steps go through an `AgentProvider` interface with a
  `preflight()` that checks the provider is present **and** authenticated before any
  write, and a `run()` that takes the system prompt, user prompt, output schema, read
  scope, turn cap and timeout. Faults are typed: `ProviderNotReady` (can't start),
  `ProviderUnavailable` (mid-run infrastructure fault: abort, no strike) and
  `AgentItemError` (this item failed). The MVP's one provider is Claude Code through
  the Claude Agent SDK for TypeScript, which reuses the operator's Claude Code login or
  `ANTHROPIC_API_KEY`. #19 adds configuration and providers behind this interface.
- **Bash scripts stay** until #18.

### SDK findings (T5)

Recorded by the Implement phase's T5 spike against the pinned SDK and the installed
CLI. See the header comment of `src/ingest/agent/claude-code.ts` for the per-option
detail.

Verified on 2026-10-04 against `@anthropic-ai/claude-agent-sdk` 0.3.289 and Claude Code
CLI 2.1.289 (native binary). Every option the design relies on exists and behaves as
documented, so no fallback was needed:

- **`pathToClaudeCodeExecutable`** works with the installed native CLI, so runs use the
  operator's own CLI version and login. The SDK's bundled CLI (the documented
  fallback) isn't used.
- **Tool restriction.** `tools: ["Read", "Glob", "Grep"]` offers exactly those three,
  plus `StructuredOutput` when an output schema is set. Sub-agent, skill, shell, write
  and web tools aren't offered even though the CLI still discovers skills and agents.
  `disallowedTools` is passed as a second layer, and the provider aborts the call if
  the session ever offers a tool or MCP server outside the set.
- **Structured output** (`outputFormat: json_schema`) works, implemented by the CLI as
  a `StructuredOutput` tool call. That call goes through the PreToolUse hook like any
  other, costs one turn, and is let through by the provider without consulting the
  read policy.
- **The PreToolUse hook** sees every tool call before permission checks, and a `deny`
  blocks it; denials are also listed in the result. **`canUseTool`** is consulted
  only for calls that would prompt. In-scope read-only calls don't prompt, so the
  hook is the enforcing check and `canUseTool` backs it for anything else.
- **Isolation.** `settingSources: []` loads no settings or CLAUDE.md; `mcpServers: {}`
  with `strictMcpConfig` gives no MCP servers; `persistSession: false` writes no
  transcript.
- **Authentication check.** `claude auth status --json` reports `loggedIn` and
  `authMethod` without a model call. That is the whole check for a Claude
  subscription login. It reports any `ANTHROPIC_API_KEY` as logged in without
  validating it, so API-key and third-party auth fall back to a minimal no-tool query
  (D10's fallback). An invalid key surfaces as `authentication_failed` retries, which
  the provider stops at the first one.
- **Search tools and gitignored notes.** Glob lists gitignored files, but Grep respects
  `.gitignore`, so it skips vault notes (all gitignored) and finds only committed
  files. Agents that need to find notes use Glob and Read.
- **Residual.** If a subscription login has expired in a way `auth status` still
  reports as logged in, preflight can't tell without a model call. The first agent
  step then fails as `ProviderUnavailable` (exit 4, no strike), so the run stops
  without raising asks, but a run with nothing eligible won't notice that day.

## Consequences

- **Now easier:** transactional logic, HTTP and parsing are written and tested in one
  typed language; adding a provider is one class.
- **Now harder:** Node joins go-task and git as a runtime dependency for workflow
  runners, and it has to be on the scheduler's PATH. There are two helper libraries
  (`scripts/lib/common.sh`, `src/lib/`) until #18. `node_modules/` sits inside the
  vault; Obsidian's `userIgnoreFilters` keeps it out of search and graph.
- **New constraints:** TypeScript in `src/` must stay erasable-only. Dependency updates
  are deliberate commits that change the lockfile. No `.md` file is committed under
  `src/` or `test/`, so framework code never shows up as a vault note.

## Revisit Conditions

- Type stripping blocks a TypeScript feature a runner needs: fall back to `tsc`
  emitting to a gitignored `dist/`, built by `deps:node`.
- Node's minimum version blocks an installer's platform.
- #19 needs more than a provider class (for example per-provider tool semantics).

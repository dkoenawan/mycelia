---
issue: 12
branch: feature/issue-12-inbox-resource-ingestion
status: in-progress
test_command: "task check:node"
last_skill_commit: null
retry_counts:
schedule: null
budget:
  max_tasks_per_run: 16
  max_wall_clock_minutes: 960
  stop_on_first_failure: true
---

# Tasks: Resource lifecycle MVP — inbox → resources ingestion

> Phase: Implement | Design: [`design.md`](design.md) (Revision 3, landing order T1–T16) · Requirements: [`define/requirements.md`](define/requirements.md)

One commit per ticked task, containing that task's changes and its tick. From T2 on, every gate includes `task check:node` (D16). No gate commits vault content; fixture vaults are built in temp directories (DES-022). Every commit is checked against the REQ-040 greps before it is made (DES-027).

- [x] T1 — ADR-0006 and ADR-0007 (`status: proposed`) and the three CLAUDE.md pointers (DES-025, D15). Gate: both ADRs follow `docs/adr/template.md`; REQ-040 greps clean.
- [x] T2 — Node scaffold: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.npmrc`, `.nvmrc`, `src/lib/` helpers, the no-`.md`-under-`src/`/`test/` test, `ci.yml`, `.gitignore` runtime lines, `deps:node` and `check:node` tasks, the two `doctor.sh` checks (DES-021 part, DES-022, DES-023, DES-026) (depends on: 1). Gate: `task check:node`; `task install && task doctor:ci` in a fresh clone.
- [x] T3 — Capture folder packaging: `.gitignore` re-include block and `00-inbox/capture/README.md` (DES-019) (depends on: 2). Gate: REQ-035's two commands; `task check:node`.
- [x] T4 — Docs and Obsidian: `00-inbox/README.md`, `30-resources/README.md`, `.obsidian/app.json` (DES-020, DES-027) (depends on: 3). Gate: REQ-040 greps; `task check:node`.
- [x] T5 — SDK spike and provider: `AgentProvider` interface, `FakeProvider`, `ClaudeCodeProvider.preflight()` and `run()`, every DES-010 option verified against the pinned SDK and recorded in the `claude-code.ts` header and ADR-0007 (DES-009, DES-010 minus policy) (depends on: 2). Gate: preflight passes when logged in and fails with the login message under an empty `HOME`; one real no-tool call returns structured output; `task check:node`.
- [x] T6 — Tool policy `decide()` with unit tests, wired in as the PreToolUse hook and `canUseTool` (DES-010 policy) (depends on: 5). Gate: unit tests (traversal, symlinks into `control/` and outside the repo, hidden folders at any depth, `node_modules/`, root-rooted searches, non-`.md`/`.txt` reads, absolute paths, `~`, other tools); a real call told to read `control/estate.local.yaml` and `.git/config` is denied for both and the denials are recorded; `task check:node`.
- [x] T7 — Vault index, frontmatter reader and `FlatTargetIndex` (DES-006, DES-007) (depends on: 2). Gate: unit tests for wikilink parsing, resolution, `uniqueStem`, ambiguous-stem exclusion, frontmatter cap; `task check:node`.
- [x] T8 — State: lock, ledger, journal with apply, rollback and recovery (DES-003, DES-015, DES-017) (depends on: 2). Gate: a scripted kill between journal operations, then recovery leaves the item ingested once or untouched; conflict path exits 4; `task check:node`.
- [ ] T9 — Capture listing, classification, ordering, held set and ask notes (DES-004, DES-005) (depends on: 7, 8). Gate: unit tests for REQ-001–007 ordering, cap and hold semantics, ask rewrite in place; `task check:node`.
- [ ] T10 — URL extraction, thin detection, fetcher with connect-time address blocking, redirects, caps, parse5 cleaning (DES-008) (depends on: 2). Gate: local-server tests via `MYCELIA_INGEST_ALLOW_PRIVATE=1`, address-block tests, hostile HTML fixtures; `task check:node`.
- [ ] T11 — Prompt construction, delimiting, canary, output schema and validator, system prompt (DES-011, DES-012) (depends on: 5, 7). Gate: injection fixtures through `FakeProvider` (hidden text, fake end marker, planted JSON, zero-width text, "read ../control"); schema/validator agreement test; `task check:node`.
- [ ] T12 — Writers: resource renderer, sanitiser, slugs, archive names, back-link writer (DES-013, DES-014) (depends on: 7). Gate: URL de-linking tests, REQ-016 and REQ-017 exact-diff fixtures; `task check:node`.
- [ ] T13 — Per-item pipeline and check, failure handling and strikes (DES-016; DES-002 phase 5) (depends on: 8, 9, 10, 11, 12). Gate: per-item tests for ingest, hold, check failure with rollback, `changed-during-run`, third-strike ask; `task check:node`.
- [ ] T14 — Run loop, CLI, daily note, `ingest-inbox` and `ingest-inbox:preflight` tasks (DES-001, DES-002, DES-018, DES-021) (depends on: 13, 6). Gate: end-to-end run on a temp vault with `FakeProvider`; `task --list`; one real run on a scratch vault; `task check:node`.
- [ ] T15 — Example registry entry `inbox-ingest` (DES-024) (depends on: 14). Gate: the YAML parses; `task doctor` passes on a copy seeded from it; `task check:node`.
- [ ] T16 — Accept ADR-0006 and ADR-0007 (`status: accepted`, `date:` set to landing date) (D15). Held: runs only after Test passes; not executed by Implement. (depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)

## Deviations from design

Each deviation is recorded here as it happens, naming the task and the `DES-*`/`D*` it departs from.

- **T1 / DES-027 — one more pronoun fixed.** CLAUDE.md's "The one rule" paragraph used a gendered object pronoun for the operator. DES-027 lists only two existing lines to fix, but this session commits CLAUDE.md and the operator is they/them, so it now reads "without requiring them to come looking". No other wording changed.
- **T2 / DES-022 — SDK peer dependencies pinned.** The pinned SDK (0.3.289) declares three non-optional peers: `zod`, `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`. As DES-022 anticipates, each is pinned exactly in `package.json`, so there are six direct runtime entries rather than three. Recorded in ADR-0007.
- **T2 / DES-022 — TypeScript 6.0.3, not the newest major.** `typescript-eslint` 8.71 supports `typescript <6.1.0`; TypeScript 7.x is outside that range, so the dev pin is 6.0.3. `@types/node` is pinned to 22.x to match `engines.node`. `.nvmrc` is `24` (the active LTS major on 2026-10-04).
- **T2 / DES-022 — `no-floating-promises` allows `node:test` calls.** `test()` returns a promise the runner tracks, so the rule's `allowForKnownSafeCalls` lists `node:test`'s `test`, `it`, `describe` and `suite`. The rule stays on for everything else.
- **T2 / DES-023 — the doctor checks are numbered 6a and 6b**, so the existing checks 7 and 8 (referenced from ADR-0002 and DES-024) keep their numbers.
- **T2 / DES-001 — `src/lib/daily.ts` lands in T14** with the daily-note writer and its test pinning `common.sh`'s frontmatter, rather than in the scaffold.
- **T5 / DES-009 — non-billable check for subscription logins only.** `claude auth status --json` is the free check T5 looked for, and it's used for a `claude.ai` login. It reports any `ANTHROPIC_API_KEY` as logged in without validating it, so for API-key and third-party auth the preflight runs the design's fallback (a minimal no-tool query, 60 s). Residual: an expired subscription login that `auth status` still reports as logged in is only caught at the first agent step, as `ProviderUnavailable` (exit 4, no strike).
- **T5 / DES-010 — `StructuredOutput` is let through by the provider.** The SDK implements `outputFormat` as a `StructuredOutput` tool call that passes through the PreToolUse hook. Under DES-010's "anything else: never", the hook would deny the output itself. The provider allows exactly that tool when an output schema is set, without consulting the read policy and without counting it as a read or recording it as a tool call. The policy function stays as designed.
- **T5 / DES-010 — `canUseTool` doesn't run for in-scope reads.** In-scope Read, Glob and Grep calls don't prompt in `permissionMode: "default"`, so the CLI never consults `canUseTool` for them. The hook is the enforcing check, as DES-010 intends. `canUseTool` is still wired, and denies anything the policy wouldn't allow if the CLI ever asks.
- **T5 / DES-010 — two additions.** (1) The provider aborts the call (`ProviderUnavailable`) if the session's init message offers any tool outside Read, Glob, Grep and `StructuredOutput`, or any MCP server. That catches SDK or CLI drift. (2) An `api_retry` message with an authentication or rate-limit error aborts at once instead of waiting out up to 10 retries.
- **T5 / DES-010 — fail-closed default.** Until T6 wires in the policy, the provider's default decider denies every read tool.
- **T5 / DES-022 — live gates are a separate script.** The real-CLI gates live in `test/live/*.live.ts`, run with `npm run test:live`. They're outside `npm test` and `task check:node`, because CI has no Claude Code login.
- **T6 / DES-010 — searchable also excludes symlinks.** A folder is searchable only if nothing beneath it is an excluded or hidden directory **or a symlink**. A search tool may follow a symlink into `control/` or out of the repository, and the policy can't see where a search goes once it's allowed. Read still resolves symlinks and allows an in-scope target.
- **T6 / DES-010 — Glob and Grep `path` must be an absolute, existing directory.** A relative path would resolve against the agent's empty temporary `cwd`, so it's denied rather than guessed. Grep on a single file is denied too; the agent can Read it.
- **T6 / finding — Grep skips gitignored notes.** Claude Code's Grep respects `.gitignore`, and every vault note is gitignored, so Grep over a vault folder returns only the committed READMEs. Glob and Read see every note. Nothing changes in the policy; T11's system prompt steers the agent to Glob and Read to find and read notes. Recorded in ADR-0007.
- **T7 / DES-006 — three resolution details the design leaves open.** (1) A folder-qualified link such as `[[20-areas/career]]` resolves only to paths ending in that folder and name, as Obsidian does. (2) A target with a non-`.md` extension that matches no filename falls back to stems, so `[[node.js]]` resolves to `node.js.md`. (3) `uniqueFileName(base, ext)` gives archive names for `.txt` originals, checking both filenames and note stems.
- **T7 / DES-007 — symlinked target notes are skipped.** A symlink directly in `20-areas/` or `10-projects/` isn't offered as a placement target, so a back-link can never be written through a link to a file elsewhere.
- **T8 / DES-015 — "committed" means any ledger record for the journal's run, item and hash.** DES-015 says recovery discards the journal when the ledger has an `ingested` record for the item and hash. Hold-path transactions (creating or rewriting an ask) commit with a `held` record, so recovery checks for a record from the same run with the same item and hash, whatever the outcome.
- **T8 / DES-015 — on a conflict the journal is kept.** `RollbackConflict` leaves every file and the journal in place, so the next run sees the same state rather than losing the recovery information. T14 maps it to exit 4 and raises the one `check-failed` ask only if the item has no owned open ask already.
- **T8 / DES-015 — modified files are replaced atomically**, through a hidden temp file in the same folder, then a rename and a directory sync. A crash mid-write can't leave a torn target note.
- **T8 / DES-016 — uncounted failures don't break a strike run.** Walking newest to oldest, a `failed` record without `strike` (e.g. `changed-during-run`) is skipped; any other outcome ends the walk.

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
- [ ] T2 — Node scaffold: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.npmrc`, `.nvmrc`, `src/lib/` helpers, the no-`.md`-under-`src/`/`test/` test, `ci.yml`, `.gitignore` runtime lines, `deps:node` and `check:node` tasks, the two `doctor.sh` checks (DES-021 part, DES-022, DES-023, DES-026) (depends on: 1). Gate: `task check:node`; `task install && task doctor:ci` in a fresh clone.
- [ ] T3 — Capture folder packaging: `.gitignore` re-include block and `00-inbox/capture/README.md` (DES-019) (depends on: 2). Gate: REQ-035's two commands; `task check:node`.
- [ ] T4 — Docs and Obsidian: `00-inbox/README.md`, `30-resources/README.md`, `.obsidian/app.json` (DES-020, DES-027) (depends on: 3). Gate: REQ-040 greps; `task check:node`.
- [ ] T5 — SDK spike and provider: `AgentProvider` interface, `FakeProvider`, `ClaudeCodeProvider.preflight()` and `run()`, every DES-010 option verified against the pinned SDK and recorded in the `claude-code.ts` header and ADR-0007 (DES-009, DES-010 minus policy) (depends on: 2). Gate: preflight passes when logged in and fails with the login message under an empty `HOME`; one real no-tool call returns structured output; `task check:node`.
- [ ] T6 — Tool policy `decide()` with unit tests, wired in as the PreToolUse hook and `canUseTool` (DES-010 policy) (depends on: 5). Gate: unit tests (traversal, symlinks into `control/` and outside the repo, hidden folders at any depth, `node_modules/`, root-rooted searches, non-`.md`/`.txt` reads, absolute paths, `~`, other tools); a real call told to read `control/estate.local.yaml` and `.git/config` is denied for both and the denials are recorded; `task check:node`.
- [ ] T7 — Vault index, frontmatter reader and `FlatTargetIndex` (DES-006, DES-007) (depends on: 2). Gate: unit tests for wikilink parsing, resolution, `uniqueStem`, ambiguous-stem exclusion, frontmatter cap; `task check:node`.
- [ ] T8 — State: lock, ledger, journal with apply, rollback and recovery (DES-003, DES-015, DES-017) (depends on: 2). Gate: a scripted kill between journal operations, then recovery leaves the item ingested once or untouched; conflict path exits 4; `task check:node`.
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

- **T1 / DES-027 — one more pronoun fixed.** CLAUDE.md's "The one rule" paragraph said "requiring him to come looking". DES-027 lists only two existing lines to fix, but this session commits CLAUDE.md and the operator is they/them, so it now reads "requiring them". No other wording changed.

---
issue: 21
branch: feat/21-notion-inbox-capture
status: in-progress
test_command: task check:node
last_skill_commit: null
retry_counts:
schedule: "0 */6 * * *"
budget:
  max_tasks_per_run: 3
  max_wall_clock_minutes: 90
  stop_on_first_failure: true
---

# Tasks: Notion inbox: capture from phone into the vault inbox (#21)

> Phase: Implement | Design: [`design/index.md`](design/index.md) (frozen) | Gate per task: `task check:node`, one commit per ticked task (code + tick).
> Order follows the design's implementation order. Connector paths are under `integration/notion/`.

- [x] DES-012: gate wiring for `integration/`: `tsconfig.json` include, `package.json` `test`/`test:live` globs, ESLint tests override plus the D8 layer rule (`no-restricted-imports` per folder), the no-`.md` repo test extended to `integration/`, and a placeholder test under `integration/notion/test/`
- [x] DES-017 (part 1): opt-in live spike `test/live/spike.live.ts` checking A1–A5; skips cleanly when the test-workspace env vars are unset; never holds a key (depends on: 1)
- [ ] DES-017 (part 2): run the spike against the operator's test workspace, record the A1–A5 findings in `src/adapters/notion/http-client.ts`'s header comment, and confirm or correct the `NOTION_VERSION` constant and the preferred Status form (depends on: 2, 9)
- [x] DES-018: domain model (`src/domain/capture.ts`, `src/domain/lifecycle.ts`) and `src/application/ports.ts`, with `test/domain/` unit tests (depends on: 1)
- [x] DES-001: ingest session seam `src/ingest/session.ts` (`openIngestSession` / `processOne` / `close`, exported `ingestPreflight`), `runIngest` as a thin wrapper; existing `test/` suite unchanged plus new session tests (depends on: 1)
- [x] DES-003: source inbox template `template/source-inbox.json` (five properties, Status in both forms, instructions-row text) (depends on: 1)
- [x] DES-004: connector config adapter `src/adapters/config/yaml-config.ts` (`ConfigStore`, atomic 0600 write, `guardConfigPath`) with tests (depends on: 4)
- [x] DES-007: connector ledger adapter `src/adapters/ledger/jsonl-ledger.ts` (`PullLedger`) with tests (depends on: 4)
- [x] DES-002: Notion HTTP client `src/adapters/notion/http-client.ts` (`NotionApi`, typed errors, 429 retry, redirect refused, pinned version) and `src/adapters/notion/source-inbox.ts` (`SourceInbox`, `InboxProvisioner`), tested against a local recording server (depends on: 4)
- [x] DES-014: `notion-pull` example job in `control/estate.example.yaml` (depends on: 1)
- [x] DES-006: converter `src/adapters/notion/blocks.ts` and pure `src/domain/capture-item.ts`, reproducing REQ-011/REQ-012 fixtures and the REQ-024 `extractUrls` check (depends on: 9)
- [x] DES-008: eligibility and selection `src/domain/eligibility.ts` with REQ-010/019/035 tests (depends on: 4, 8)
- [x] DES-010: stopped-item ask `src/domain/stopped-ask.ts` and `src/adapters/vault/vault-writer.ts` (capture items with `wx`, asks, daily block, hint lookup) with tests (depends on: 4, 11)
- [x] DES-013: `scripts/doctor.sh` check 9 (not configured is a note; present must be gitignored, 0600, parse) (depends on: 7)
- [ ] DES-016: privacy guard test `test/privacy.test.ts` over the template, `integration/` and the README (depends on: 6)
- [ ] DES-005: setup use case `src/application/setup-inbox.ts`, `src/adapters/cli/key-prompt.ts`, `src/adapters/notion/template.ts`, tested against fakes (depends on: 6, 7, 9)
- [ ] DES-009 (part 1): pull and preflight use cases `src/application/pull-inbox.ts` and `src/application/preflight.ts`, tested against in-memory fakes in `test/fakes/` (depends on: 5, 7, 8, 9, 11, 12, 13)
- [ ] DES-009 (part 2): ingest-session adapter `src/adapters/ingest/session.ts` and integration tests on a temp git vault with the fake Notion API and a fake provider (REQ-014, REQ-026, REQ-027, REQ-029, REQ-030) (depends on: 17)
- [ ] DES-011: composition root `src/cli.ts` and the `notion:setup`, `notion:pull`, `notion:pull:preflight` tasks in `Taskfile.yml` (depends on: 16, 18)
- [ ] DES-015: README "Phone capture (Notion)" section (six topics, exit codes) (depends on: 19)

## Deviations from design

Each entry: the DES or decision affected, what changed, and why. Logged as it happens.

- **DES-017 split, and DES-002/DES-005 no longer wait on it.** The design orders DES-017 first and makes DES-002 and DES-005 depend on its outcome. Implement has no test-workspace key, so the spike is split into writing it (task 2) and running it (task 3, needs the operator). DES-002 pins `Notion-Version` provisionally at `2025-09-03` (the version A4 names), and task 3 confirms or corrects it.
- **D4 decided at runtime in setup, not by the spike alone.** DES-005 asks `createDatabase` for the native `status` form first. If Notion rejects it with a validation error (400), nothing has been created, so setup retries once with the `select` form and records `status_property: select`. That's the same outcome D4 chose (status if the API allows it, otherwise select with blank read as New) without hard-coding the spike's answer. The spike (task 3) still records which branch the live API takes, so the orchestrator can log the REQ-002 glossary reading if it's `select`.
- **DES-002/DES-006 boundary.** `source-inbox.ts` lands in task 9 without `read()`: the class that reads a row's content needs the block converter, so `read()` (and the `implements SourceInbox` declaration) arrives with DES-006 in task 11. The provisioner takes the loaded template (`InboxTemplate`) as a constructor argument, so it doesn't depend on DES-005's `template.ts`.
- **DES-006: who assembles the `Capture`.** `blocks.ts` converts blocks to Markdown and counts what's left out; `source-inbox.ts`'s `read()` assembles the domain `Capture` (title, URL, hint from the row's properties, body from `blocks.ts`). Same result as the design; it avoids an import cycle between the two adapter files. Bookmark and link-preview blocks become links (REQ-011 lists links) rather than being left out.
- **DES-010: one extra pure file, `src/domain/summary.ts`.** The design puts the daily "Phone capture" block under `vault-writer.ts`; its rendering is pure, so it lives in `domain/summary.ts` and the adapter only appends it. The stopped ask's frontmatter `type` is `reference`, as for the ingester's asks.

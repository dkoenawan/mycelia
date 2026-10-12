---
session: 2026-10-10-notion-inbox-capture
type: feature
issue: 21
phase: design
status: active
# milestone: the PHASE KEY of the last completed milestone, not a display
# label. Allowed values (feature workflow): none | define | design |
# implement | test | deploy | close. "none" until the first milestone
# (Define complete) is reached. The guard hook (D7) uses this key, plus
# each phase's `order` in workflows/<type>.json, to decide which
# artifacts are frozen. Display labels (e.g. "Define complete") live only
# in workflows/<type>.json's `milestone` field, for GitHub comments.
milestone: define
active_agent: main
next_step: "Design gate: operator approves / adjusts / rethinks design/"
---
# Session Log: Notion inbox: capture from phone into the vault inbox (#21)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Notion API assumptions A1–A5 unverified; DES-017 live spike is Implement's first task (also settles D4 status type and pins API version).
- Test: REQ-025 uses a local recording server, not a proxy (client ignores env proxies by design).
- Close: write the D6 ADR (credentialed egress for capture-source connectors; `integration/` as connector home).
- If the spike forces the `select` fallback, log that REQ-002 "has status New" is read through the glossary (blank = New).

## Key decisions

- **2026-10-12**: D8 clean architecture inside `integration/notion/src` (`domain/` ← `application/` + ports ← `adapters/` ← `cli.ts`), layer rule enforced by ESLint; repo-wide adoption is #22, upstream dkoenawan/compass-labs#62.
- **2026-10-10**: D7 code layout: `integration/notion/{src,template,test}`, Notion-only behind `NotionApi`; gate/tsconfig/eslint/Taskfile widened (operator's own choice).
- **2026-10-10**: D6 new ADR on credentialed egress for capture-source connectors, written at Close.
- **2026-10-10**: D5 config in `control/notion.local.yaml` (0600); ledger `.state/notion-pull/ledger.jsonl`.
- **2026-10-10**: D4 native Notion `status` if the DES-017 spike shows it can be created, else `select` with blank = New.
- **2026-10-10**: D3 pin the Notion data-source API model (2025-09-03 or latest stable); store database + data-source IDs.
- **2026-10-10**: D2 built-in fetch, own typed client and Markdown converter; no new runtime deps.
- **2026-10-10**: D1 ingest-session seam (`src/ingest/session.ts`); `runIngest` becomes a thin wrapper; one lock across pull + ingest.
- **2026-10-10**: Design kind Plugin/tooling; scope: runner, Notion integration, security, status lifecycle, ops/registry, docs in; frontend, DB, infra, visual UI out.
- **2026-10-10**: ✅ Define complete — 44 requirements frozen; anchor aligns, no update.
- **2026-10-10**: Requirements set agreed — REQ-001…REQ-044 (31 Must, 12 Should, 1 Could), incl. the six Define-taken decisions and thresholds (10 items/run, 3 failures, ≤5 min pull overhead).
- **2026-10-10**: Scope agreed — Notion database only; pull + ingest in one run via the ADR-0006 ingester; New → Ingested/Failed, rows kept; title/body/URL + optional area/project hint; idempotent setup; configurable schedule; appetite 2–3 impl sessions (hint deferred first).
- **2026-10-10**: Framing agreed — tier full; phone capture is the need, Notion the chosen source; anchor aligns (no update).
---

## Phase: Define

### 2026-10-10 — main — note: session opened
- Operator wants to capture notes from a phone into a Notion inbox and have mycelia pull them into `00-inbox/`. Three components named: Notion read integration; a setup task command (API key → create inbox database/page from a template); a daily pull that marks each Notion item processed / not processed, reusing the inbox ingestion work (#12).

### 2026-10-10 — main — handoff: orchestrator → compass-labs:define (frame + requirements)
- **Input:** Frame the problem and write requirements for #21. Operator's words, summarised: vault lives on a Linux machine; adding to the inbox means opening an editor there, which is impractical. They want to capture notes from a phone into a Notion inbox page/database, and have mycelia pull them in. Three components: (1) Notion integration — read from a Notion page or database; (2) setup — a task command that takes the API key, creates the database/page from a template and populates it; (3) a daily pull from that database into the vault, reusing the inbox ingestion work (#12), updating each item's status to processed / not processed. Operator called it "a very basic Notion integration" but "quite a big exercise".
- **Output:** needs_input (Q1–Q10 asked and answered via SendMessage), then done; define/index.md, framing.md, problem.md, requirements.md, quality.md, diagrams.md

### 2026-10-10 — compass-labs:define — note: framing started, tier proposed
- Proposed tier **full**. Reason: new third-party integration, stored secret, setup command, new scheduled job and registry entry, and a hand-off into the ADR-0006 ingester.
- Anchor assessed **complete**. Proposed verdict **aligns** (Scope: "Agent workflows that capture…"; the non-goal "A database or proprietary store" isn't crossed because Notion is a transit queue), with an optional extends line offered.
- XY: Notion is a pre-chosen fix. Asked whether it is the need or the selected candidate for phone capture.
- Overlap check (ADRs, no registry): ADR-0006 already ingests `00-inbox/capture/`, so the pull is proposed as transport into it. A pull job would need ADR-0006's `commits: false` + `note` exception.
- Asked the operator about the Notion object, the pull/ingest boundary, the status lifecycle, supported content, setup behaviour, schedule and appetite.

### 2026-10-10 — compass-labs:define — decision: framing agreed (tier, XY, anchor)
- Tier **full**: a new capability across a third-party API, a stored secret, a setup command, a new scheduled job and registry entry, and a hand-off into the ADR-0006 ingester.
- XY: phone capture is the need. Notion is the chosen candidate and the only source built this session. Requirements stay source-neutral where that costs nothing.
- Anchor: complete. Verdict **aligns**; anchor update action **none**. It rests on the Scope lines "Agent workflows that capture…" and "Framework only…". The non-goal "A database or proprietary store" isn't crossed, because Notion is a transit queue and the vault stays the store of record.

### 2026-10-10 — compass-labs:define — decision: scope answers agreed (Q3–Q10)
- Q3: a Notion database only, with one row per capture and a status property. No plain page.
- Q4: the pull run also ingests its own items in the same run, through the ADR-0006 ingester and its security layers, not a copy of them.
- Q5: statuses go `New` → `Ingested` or `Failed`. `Failed` has a reason and is retried next run; after 3 failures the item stops and one ask is raised in `00-inbox/`. Rows stay in Notion and are never archived or deleted. Edits after the pull are ignored.
- Q6: content is the title, the body as Markdown (paragraphs, lists, headings, to-dos, links) and an optional URL. Images, attachments and embeds are out of scope. There's an optional area/project hint that maps to the ingester's `[[link]]`.
- Q7: setup needs an internal integration and a shared parent page. It validates the key, creates the database from the template with one instructions row, writes the key and database ID to gitignored local config, and is safe to re-run.
- Q8: the schedule is configurable. The registry entry records the chosen cron. #16 overlap recorded: order and cap stay fixed.
- Q10: appetite is 2–3 implementation sessions. The area/project hint is deferred first if over.
- Accepted defaults: opt-in; nothing instance-specific committed; pulled content treated as untrusted; failures pushed to the daily note or an ask.

### 2026-10-10 — compass-labs:define — attempt: full-tier define/ drafted for the gate
- Written: `index.md`, `framing.md`, `problem.md`, `requirements.md`, `quality.md`, `diagrams.md`.
- 44 live requirements: 31 Must, 12 Should, 1 Could (REQ-023). Deferred: none.
- Every OUT-nn is served by at least one live requirement. All nine ISO/IEC 25010 quality characteristics are covered, or not applicable with a reason (Safety).
- Six decisions were taken by Define and are listed in `index.md` for the operator to confirm or adjust at the gate.
- The decision entry for the complete requirements set waits for the operator's approval at the gate.

### 2026-10-10 — main — decision: requirements set agreed
- Operator approved `define/requirements.md` as the complete requirements set: REQ-001…REQ-044 (31 Must, 12 Should, 1 Could; none deferred).
- Confirmed with it: the six decisions Define took (`define/index.md` → "Decisions taken in Define") and thresholds of 10 items per run, 3 pull failures, pull overhead ≤5 min for 10 items (target 1 min).

### 2026-10-10 — main — milestone: ✅ Define complete
- Operator approved `define/` at the gate. Tier full; anchor aligns (action none, so no a3 check needed).
- Carried into Design: confirm Notion API assumptions (database needs a shared parent page; integration keys don't expire) and decide whether outbound credentialed Notion access needs its own ADR.

---

## Phase: Design

### 2026-10-10 — main — handoff: orchestrator → compass-labs:design (design from frozen define/)
- **Input:** Turn the frozen `define/` (REQ-001…REQ-044) into `design/`. Confirm the Notion API assumptions (database creation needs a parent page shared with the integration; internal integration keys don't expire) and decide whether outbound credentialed Notion access needs its own ADR alongside ADR-0006's no-egress rule for the ingester agent.
- **Output:** needs_input (Q1–Q9 asked and answered via SendMessage), then done; design/index.md

### 2026-10-10 — compass-labs:design — note: prior knowledge read; classification and scope proposed
- Read: frozen `define/`, `log.md`, README, ADR-0006, ADR-0007, the capture README, `.gitignore`, `estate.example.yaml`, Taskfile, `package.json`, `doctor.sh`, and `src/ingest/` (cli, run, capture, lock, ledger, fetch, agent/provider). No `docs/registry/`, `docs/explanation/` or `docs/reference/` exists. No past session folder was read.
- Established stack: TypeScript on Node ≥22.18 (ADR-0007), with no server framework and no DB.
- Proposed kind: Plugin/tooling (no in-depth path, dkoenawan/compass-labs#51). Proposed scope: runner code, Notion integration, security, a lightweight status lifecycle, ops/registry and docs in; frontend, database, infrastructure and visual UI out.
- Finding: `runIngest` selects from all of `00-inbox/capture/`, takes its own lock and returns only an exit code. That blocks REQ-014/016/030 without a seam (Q3).

### 2026-10-10 — compass-labs:design — note: Notion API assumptions assessed (not verified live)
- No web access in this phase. From knowledge: A1 (database needs a shared parent page) and A2 (internal integration keys don't expire) are likely true. Both are recorded as assumptions, and an Implement spike against a test workspace will verify them.
- New finding A3: the API probably can't create a native `status` property. A `select` has no default, so new rows read as empty. That's consistent with the REQ glossary ("empty counts as New") but in tension with the literal wording of REQ-002's criterion. Raised as Q6.
- A4: the 2025-09-03 data-source model affects create and query (Q5). A5: 3 req/s and 429 with Retry-After (REQ-044).

### 2026-10-10 — compass-labs:design — attempt: needs_input, questions Q1–Q9
- Asked the operator to confirm the kind and scope (Q1–Q2) and to choose D1–D7: the ingester seam, the HTTP client and converter, the API version, the status property type, the config location, an ADR for credentialed egress, and the code layout. Each question comes with options and a recommendation.

### 2026-10-10 — compass-labs:design — decision: classification and scope confirmed
- The operator confirmed the primary kind, Plugin/tooling (no in-depth path; dkoenawan/compass-labs#51).
- Scope as proposed:
  - In: runner code, the Notion integration and template, security, a lightweight status lifecycle, ops and registry, the README.
  - Out: frontend, database, infrastructure, visual UI design.

### 2026-10-10 — compass-labs:design — decision: D1 ingest-session seam (Q3)
- The operator chose a new `src/ingest/session.ts` with `openIngestSession`, `processOne(name)` (returns the outcome) and `close`.
- `runIngest` becomes a thin wrapper over it, and the existing ingester tests must stay green.
- The pull run shares the ingester's lock and hands it to the session.
- The ingester keeps writing its own daily block, and the connector adds a separate "Phone capture" block.

### 2026-10-10 — compass-labs:design — decision: D2 built-in fetch, own client and converter (Q4)
- No new runtime dependencies (ADR-0007): a small typed `NotionApi` client and our own block-to-Markdown converter.

### 2026-10-10 — compass-labs:design — decision: D3 data-source API model (Q5)
- Pin `Notion-Version` 2025-09-03, or the latest stable version the spike finds.
- The config stores both the database ID and the data-source ID.

### 2026-10-10 — compass-labs:design — decision: D4 status property type (Q6)
- Use Notion's native `status` type if the DES-017 spike shows the API can create it.
- Otherwise use a `select`, with a blank status counting as New.
- The orchestrator's web search weakly supported the `select` route; the spike is kept.

### 2026-10-10 — compass-labs:design — decision: D5 config and ledger location (Q7)
- Config in `control/notion.local.yaml`, mode 0600, gitignored and outside the agent's read scope.
- Ledger in `.state/notion-pull/ledger.jsonl`.

### 2026-10-10 — compass-labs:design — decision: D6 new ADR for credentialed egress, flagged for Close (Q8)
- Credentialed egress lives only in deterministic connector code, to one hard-coded API host.
- The key lives only in local config and only goes in the `Authorization` header.
- ADR-0006's no-egress rule for the ingester's agent is unchanged.

### 2026-10-10 — compass-labs:design — decision: D7 code layout `integration/notion/src` (Q9)
- The operator chose neither offered option. Code goes in a top-level `integration/notion/` folder holding `src/`, `template/` and `test/`.
- It is Notion-only behind a narrow `NotionApi` interface, with no generic `CaptureSource`.
- Consequences (DES-012): `tsconfig.json` includes, test and live-test globs, the ESLint test override, imports pointing one way from `integration/` into `src/`, Taskfile tasks `notion:setup`, `notion:pull` and `notion:pull:preflight`, and ADR-0007's no-`.md` rule extended to `integration/`.

### 2026-10-10 — compass-labs:design — note: Notion API assumptions recorded, spike planned
- A1 to A5 (parent page, key lifetime, status type, data-source model, limits) aren't verified, because Design had no web access.
- DES-017, a live spike against a test workspace, is Implement's first task and checks all five.

### 2026-10-10 — compass-labs:design — attempt: design/index.md drafted for the Design gate
- 17 DES items and 7 decisions; all 44 live REQs covered.
- Four diagrams, all rendering.
- Four "traded off" marks (DES-001 open/closed, D4, D7/DES-012), all from the operator's own choices, for confirmation at the gate.
- Open for Test: REQ-025 uses a recording server instead of a proxy.
- Open for Close: write the D6 ADR.

### 2026-10-12 — main — decision: D8 clean architecture inside the connector
- The operator found the flat nine-module `integration/notion/src/` too flat and asked for clean architecture.
- Layers: `domain/` (pure: capture, lifecycle, eligibility, note rendering) ← `application/` (setup, pull and preflight use cases, plus `ports.ts`) ← `adapters/` (Notion HTTP client and source inbox, blocks mapping, YAML config, JSONL ledger, vault writer, key prompt, ingest-session wrapper) ← `cli.ts` composition root.
- Only adapters import from `src/`. DES-012 adds an ESLint `no-restricted-imports` layer rule. New DES-018 covers the domain model and the ports. D7's "no generic `CaptureSource`" stands.
- `src/ingest/` is out of scope here. Raised #22 (adopt the convention repo-wide, refactor `src/ingest/`) and dkoenawan/compass-labs#62 (backend-shaped code always follows clean architecture).
- The component diagram wasn't render-checked: mermaid-cli has no headless browser on this machine.


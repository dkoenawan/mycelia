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
next_step: "Hand off to compass-labs:design"
---
# Session Log: Notion inbox: capture from phone into the vault inbox (#21)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Design to confirm Notion API assumptions (DB needs shared parent page; integration keys don't expire) and whether outbound Notion access needs its own ADR.

## Key decisions

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

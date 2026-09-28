---
session: 2026-09-28-inbox-resource-ingestion
type: feature
issue: 12
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
next_step: "Hand off to compass-labs:design to turn REQ-001–042 into DES-* components and decisions."
---
# Session Log: Resource lifecycle MVP — inbox → resources ingestion (#12)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design.md`](design.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Deferred sub-issues, out of MVP scope: #13 (scalable routing/taxonomy), #14 (project lifecycle), #15 (resource lifecycle).
- Enhancements deferred during Define: #16 (configurable batch policy), #17 (file captures: PDF, images).
- Deferred during Design: #18 (port framework scripts from bash to Node/TypeScript), #19 (choose the agent provider and auth mode at install).

## Key decisions

- **2026-09-28**: The ingester's language is now Node (TypeScript) instead of Python: transactional and workflow code and future API endpoints go in Node, and Python is kept for data analysis. #18 is retitled to match.
- **2026-09-28**: Design sent back for rework at the gate. The ingester is Python-only. The agent step gets read-only vault tools and fetched content that's been cleaned. Before each run, claude must be present and logged in, behind a provider interface. Follow-ups: #18 (port the bash scripts), #19 (choose the agent provider at install).
- **2026-09-28**: Design questions settled: Obsidian's new-note folder → `00-inbox/capture`; CLAUDE.md gets pointers to ADR-0006; state lives in `.state/ingest-inbox/`; an empty target catalogue refuses to start.
- **2026-09-28**: ✅ Define complete — operator approved REQ-001–042 with default thresholds (cap 10, thin <50 words, 3-strike ask).
- **2026-09-28**: Requirements drafted for the gate: REQ-001–042 live (32 Must, 8 Should, 2 Could); REQ-043 → #17, REQ-044 → #16. Default thresholds: cap 10, thin <50 words, 3-strike ask.
- **2026-09-28**: Held captures stay in `00-inbox/capture/`, with a separate ask note in `00-inbox/`. They're skipped while the ask is open and the content is unchanged.
- **2026-09-28**: Ingestion MVP behaviour agreed: capture folder only; text + URL with read-only fetch; oldest first, cap 10; one resource per item; original moved to archive; two-way links; no fit → ask; local uncommitted output.
- **2026-09-28**: Framing tier is full; the project anchor is created in README.md (vision, mission, scope, non-goals) as approved. Verdict: aligns.
- **2026-09-28**: Define answers agreed: capture subfolder; local uncommitted output; oldest-first batch (configurable later, #16); unmatched items → inbox ask; originals → 40-archive; text + URL with fetch (files deferred, #17); two-way links; rest of Define defaults accepted.
- **2026-09-28**: MVP is scoped to daily inbox → resource ingestion with area/project linking. Routing at scale (#13), project lifecycle (#14) and resource lifecycle (#15) are deferred.

---

## Phase: Define

### 2026-09-28 — main — note: Session opened
- Issue #12 created (user story + MVP scope). Branch `feature/issue-12-inbox-resource-ingestion` cut from `main` (= `origin/main` at b96007e).
- Scope as stated by the operator: drop any material (e.g. a social post or article) into `00-inbox/`. A daily scheduled agent parses and transforms it into `30-resources/` notes, each linked to one or more `20-areas/` and/or `10-projects/`.

### 2026-09-28 — main — decision: MVP scope and deferred sub-issues
- The operator asked to build the whole user story as an MVP and to split the scale-dependent concerns into separate issues: #13 (route into a nested taxonomy without re-reading every resource), #14 (project archival and outcome record), #15 (evolving resources, archive-with-reason). All three are children of #12.

### 2026-09-28 — main — handoff: orchestrator → compass-labs:define (frame MVP, draft REQs)
- **Input:** Frame the inbox → resources ingestion MVP for issue #12 and draft REQ-* requirements. Out of scope: #13, #14, #15.
- **Output:** needs_input (13 questions); define/index.md, define/framing.md

### 2026-09-28 — compass-labs:define — note: Framing checks run; tier and scope questions raised
- Proposed tier: full (new scheduled capability crossing inbox, resources, areas, projects, runner library and estate registry; changes how the inbox is used). Awaiting confirmation.
- XY: the need is one-step capture with filing and linking done for the operator; the daily scheduled agent is recorded as the candidate solution.
- Anchor missing (no markers in README.md); create-draft written to define/framing.md for approval. Draft verdict: aligns.
- Overlaps: `inbox_note()` decision items share the inbox (must never be ingested); ADR-0003 curation tension (non-blocking); ADR-0005 linking convention applies; ADR-0002/CLAUDE.md boundary makes vault output uncommittable, which conflicts with the "commits: false is a defect" registry rule.
- 13 questions returned to the operator, each with a recommended default.

### 2026-09-28 — main — decision: Operator answers to Define questions
- Q1 tier: full. Q2 anchor: approve the draft as written. Q3: captures go in a dedicated subfolder (option a).
- Q4/Q5: accept text/Markdown and URL-only notes. The agent fetches read-only when the text is thin; a fetch failure leaves the item in the inbox. File captures are deferred to #17.
- Q6: one daily run, oldest first, with a fixed cap per run. Making the batch policy configurable is deferred to #16.
- Q7: the original is moved to `40-archive/`, and the resource links to it as its source.
- Q8 (the operator overrode the recommended default): when no area or project fits, the item stays in the inbox with an ask about where it belongs. No resource is created.
- Q9: one resource per item. Q10: links go both ways (append to the area or project note's resources section only).
- Q11: output stays local and uncommitted. The ledger is local and gitignored, and the registry entry records `commits: false` with an explanation.
- Q12 gate and Q13 outcomes/appetite: accepted as proposed.
- **Output:** done; define/index.md, framing.md, problem.md, requirements.md, quality.md, diagrams.md

### 2026-09-28 — compass-labs:define — decision: Framing tier and project anchor
- Tier: full, confirmed by the operator. It adds a scheduled capability across the inbox, resources, areas, projects, archive, the runner library and the estate registry, and changes how the inbox is used.
- Anchor was missing (no markers in README.md). The operator approved the drafted vision, mission, scope and non-goals as written. The action is `create`, and the orchestrator wrote the agreed text into README.md between `<!-- compass:anchor -->` markers. Verdict: aligns.

### 2026-09-28 — compass-labs:define — decision: Ingestion MVP behaviour agreed with the operator
- Only `00-inbox/capture/` is ingested; decision items are never touched.
- Inputs are text/Markdown and URL-only notes; URLs are fetched read-only when the text is thin. A failed fetch leaves the item in place with an inbox ask. File captures are deferred to #17.
- One daily run processes items oldest first, up to a fixed cap of 10. A configurable policy is deferred to #16.
- Each item gets exactly one resource note; the original moves to `40-archive/` and is linked as the resource's source. Links go both ways, appended only to the target's resources section.
- When no area or project fits, no resource is created; the item is held with one inbox ask (override of Define's default).
- Output and ledger stay local and uncommitted; the registry entry records `commits: false` with an explanatory note.
- A per-item gate runs as proposed. The outcomes and appetite are accepted, with OUT-02 adjusted for the no-fit behaviour.

### 2026-09-28 — compass-labs:define — decision: Held captures stay in place with a separate ask note
- The operator left this choice to Define. A capture with no fitting area or project (or a failed fetch, an unsupported type, or 3 consecutive gate failures) stays in `00-inbox/capture/`. The ask is a separate note in `00-inbox/`, outside the capture folder.
- The item is skipped while its ask is open and its content is unchanged. Editing the item or deleting the ask makes it eligible again (REQ-005, REQ-006).
- This avoids daily re-asks, and OUT-03 holds by construction.

### 2026-09-28 — compass-labs:define — decision: Requirements set REQ-001 to REQ-042 drafted for the Define gate
- Full-tier define/ is complete: framing, problem (NEED-01 to NEED-06, OUT-01 to OUT-07), 42 live requirements (32 Must, 8 Should, 2 Could), REQ-043 deferred to #17 and REQ-044 to #16, quality coverage, NFR measures, assumptions and dependencies, and diagrams (impact map, context, traceability per outcome, as-is/to-be).
- Thresholds set by Define and awaiting confirmation at the gate: cap 10, thin under 50 words, 3-strike ask.

### 2026-09-28 — main — milestone: ✅ Define complete
- The operator approved define/ (full tier) with REQ-001–042 and the default thresholds: at most 10 items per run, thin means under 50 words, and an ask after 3 failed checks in a row. The project anchor is in README.md and matches the agreed text.

---

## Phase: Design

### 2026-09-28 — main — handoff: orchestrator → compass-labs:design (DES-* for ingestion MVP)
- **Input:** Turn define/requirements.md (REQ-001–042) into design.md: DES-* components, D-* decisions, landing order. Open item from Define: how Obsidian's default new-note folder points at `00-inbox/capture/` (committed `.obsidian/app.json`).
- **Output:** needs_input (4 questions); design.md

### 2026-09-28 — compass-labs:design — attempt: Design draft for ingestion MVP (DES-001 to DES-022)
- design.md drafted. A bash runner calls a Python module. The model gets one call per item with no tools and returns JSON that is checked before any write. Plain code handles selection, holds, fetching, locking, the per-item check, the rollback journal, archiving, the ledger and the daily note.
- Decisions D1 to D17 record the options considered, including ADR-0006 for the two agreed departures from CLAUDE.md, and a crash-recovery rule that undoes the interrupted item. Every REQ from 001 to 042 is traced to a DES item. The landing order is T1 to T14.
- It found two committed READMEs this session will edit that fail REQ-040. DES-017 fixes both.

### 2026-09-28 — compass-labs:design — note: Four design questions raised for the operator
- Q1: Obsidian's new-note folder (recommend `00-inbox/capture` in the committed `app.json`). Q2: add two pointers to ADR-0006 in CLAUDE.md (recommend yes). Q3: where the state lives (recommend `.state/ingest-inbox/`). Q4: an empty catalogue refuses to start rather than raising an ask per item (recommend refuse). The draft already follows every recommended default.

### 2026-09-28 — main — decision: Operator answers to Design questions
- Q1: the committed `.obsidian/app.json` new-note folder becomes `00-inbox/capture`. Q2: CLAUDE.md gets two one-line pointers to ADR-0006 (`commits: false` exception, capped-batch exception). Q3: ledger and journal live in `.state/ingest-inbox/` (gitignored). Q4: with no area or project notes, the runner refuses to start (exit 2) and points to `task bootstrap-areas`.
- All four match the recommended defaults already in the draft design.md.

### 2026-09-28 — compass-labs:design — note: Design questions Q1–Q4 resolved; design.md ready for the gate
- The operator accepted all four recommended defaults. Q1: the new-note folder in the committed `.obsidian/app.json` becomes `00-inbox/capture`. Q2: CLAUDE.md gets two one-line pointers to ADR-0006. Q3: ingester state lives in `.state/ingest-inbox/`. Q4: an empty placement-target catalogue refuses to start (exit 2).
- In design.md, only the Open questions section and the status line changed, to mark Q1–Q4 resolved. DES-001–022, D1–D17 and the landing order T1–T14 are unchanged.

### 2026-09-28 — main — decision: Design rethink requested by the operator at the gate
- **One language.** The ingester is written entirely in Python: no bash runner wrapping a Python engine. The Claude Agent SDK for Python is the likely vehicle. Quality is enforced through Python tooling. Porting the existing bash scripts is deferred to #18.
- **The agent gets tools.** The agent step runs with read-only tools scoped to the vault, so it can find placement targets by reading the vault itself instead of relying only on a pre-built catalogue. The operator must never have to paste whole articles in: URL content is still fetched.
- **Prompt injection.** It's handled in layers, not by removing every tool. Fetched HTML is converted to plain text and wrapped as untrusted data. The agent has no write tools and no shell. Its output is validated before deterministic code writes anything.
- **Kept as is.** The workflow stays deterministic around the agent step. Idempotency, the journal and rollback, and the vault index are kept; the operator explicitly liked them.
- **Agent check.** Before each run, check that claude is installed and authenticated, through a small agent-provider interface. Choosing a provider and auth mode at install (subscription, API key or local) is deferred to #19.

### 2026-09-28 — main — handoff: orchestrator → compass-labs:design (rework design per operator rethink)
- **Input:** Revise design.md per the rethink decision above. Python-only ingester, agent with read-only vault tools, cleaned fetch, provider interface with an auth preflight. Keep idempotency, journal and rollback. Out of scope: #18, #19.

### 2026-09-28 — main — decision: Ingester language is Node (TypeScript), superseding Python
- The operator reversed the Python choice. Transactional and workflow code, and any future API endpoint, belong in Node; Python is reserved for data-analysis tasks.
- Design uses TypeScript on Node LTS with the Claude Agent SDK for TypeScript, strict tsc, eslint and a test runner, with pinned dependencies. The rest of the rethink decision stands.
- #18 is retitled "Port framework scripts from bash to Node (TypeScript)". Relayed to the running Design agent (same invocation, no new handoff).

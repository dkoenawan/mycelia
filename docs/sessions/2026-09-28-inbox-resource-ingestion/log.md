---
session: 2026-09-28-inbox-resource-ingestion
type: feature
issue: 12
phase: define
status: active
# milestone: the PHASE KEY of the last completed milestone, not a display
# label. Allowed values (feature workflow): none | define | design |
# implement | test | deploy | close. "none" until the first milestone
# (Define complete) is reached. The guard hook (D7) uses this key, plus
# each phase's `order` in workflows/<type>.json, to decide which
# artifacts are frozen. Display labels (e.g. "Define complete") live only
# in workflows/<type>.json's `milestone` field, for GitHub comments.
milestone: none
active_agent: main
next_step: "Hand off to compass-labs:define to frame the ingestion MVP and draft REQ-*."
---
# Session Log: Resource lifecycle MVP — inbox → resources ingestion (#12)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design.md`](design.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Deferred sub-issues, out of MVP scope: #13 (scalable routing/taxonomy), #14 (project lifecycle), #15 (resource lifecycle).
- Enhancements deferred during Define: #16 (configurable batch policy), #17 (file captures: PDF, images).

## Key decisions

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

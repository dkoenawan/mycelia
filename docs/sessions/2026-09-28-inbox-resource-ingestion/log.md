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

## Key decisions

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

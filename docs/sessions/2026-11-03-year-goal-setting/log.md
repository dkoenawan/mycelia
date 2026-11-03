---
session: 2026-11-03-year-goal-setting
type: feature
issue: 36
# branch: the session branch, written once when the session opens, read by Resume.
branch: feat/36-year-goal-setting
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
next_step: "Hand off to compass-labs:define to frame #36 and write requirements"
---
# Session Log: Year goal setting: primary goal as a Mandala Chart, plus secondary goals (#36)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`implement/tasks.md`](implement/tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Epic #27 and issue #36 bodies still reference #28 (area profiles), closed 2026-11-03. Editing them was blocked by the auto-mode classifier; the operator updates them, or approves the edit.
- README project anchor (Scope) still lists "Area profiles (state, goals and inventories)". Contradicts the operator's 2026-11-03 ruling; Define's anchor check should propose the fix.

## Key decisions

- **2026-11-03**: Areas are a parking lot of cumulative knowledge, not profiles with state or goals; goals live only in the vision layer. #28 closed as not planned.

---

## Phase: Define

### 2026-11-03 — main — decision: areas hold knowledge, goals live in the vision layer
- Operator ruled that an area is a parking lot of cumulative knowledge that grows over the year. What the operator wants (goals, direction) belongs to the vision layer: year goals (#36), quarterly focus (#38), retros (#41). #28 (area profiles: state, goals, inventories) closed as not planned. #36 therefore has no dependency on area profiles; its pillars may still name the areas they touch, as knowledge locations.

### 2026-11-03 — main — note: session opened
- Branch `feat/36-year-goal-setting` from `main` at 444e16f (v0.4.3). Operator chose this branch name and asked for a draft PR.

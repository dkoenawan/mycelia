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

- #46: agent-guided amendment flow for signed-off goals (deferred from #36).
- Epic #27 and issue #36 bodies still reference #28 (area profiles), closed 2026-11-03. Editing them was blocked by the auto-mode classifier; the operator updates them, or approves the edit.

## Key decisions

- **2026-11-03**: Define gate: adjust. Several goals per year allowed (warn above 3, never reject); goals may break into sub-goals or quarterly goals; re-sign-off updates instead of refusing; secondary goals as a short list; amendment flow deferred to #46.
- **2026-11-03**: README anchor Scope: "Area profiles (state, goals and inventories)" replaced; areas hold accumulated knowledge, goals live in the goal-pursuit layer.
- **2026-11-03**: Define tier full; the Mandala Chart is the need; scope includes the guided session; `01-vision/` holds year goals; chart is at most 8×8; in-year changes recorded in the note.
- **2026-11-03**: Areas are a parking lot of cumulative knowledge, not profiles with state or goals; goals live only in the vision layer. #28 closed as not planned.

---

## Phase: Define

### 2026-11-03 — main — decision: areas hold knowledge, goals live in the vision layer
- Operator ruled that an area is a parking lot of cumulative knowledge that grows over the year. What the operator wants (goals, direction) belongs to the vision layer: year goals (#36), quarterly focus (#38), retros (#41). #28 (area profiles: state, goals, inventories) closed as not planned. #36 therefore has no dependency on area profiles; its pillars may still name the areas they touch, as knowledge locations.

### 2026-11-03 — main — note: session opened
- Branch `feat/36-year-goal-setting` from `main` at 444e16f (v0.4.3). Operator chose this branch name and asked for a draft PR.

### 2026-11-03 — main — note: draft PR opened
- https://github.com/dkoenawan/mycelia/pull/45 (draft, `feat/36-year-goal-setting` → `main`, Refs #36). #36 labelled `phase:define`.

### 2026-11-03 — main — handoff: orchestrator → compass-labs:define (frame #36, write requirements)
- **Input:** Frame #36 and write define/ by the tier the operator confirms. Context: areas are knowledge, not goals (#28 closed); README anchor Scope line "Area profiles (state, goals and inventories)" contradicts that and needs an anchor-update proposal.
- **Output:** done; define/index.md, framing.md, problem.md, requirements.md, quality.md, diagrams.md

### 2026-11-03 — compass-labs:define — note: tier proposed and framing questions raised
- Proposed tier: full. Reason: #36 creates a vision-layer contract read by #37, #38, #39, #40, #41 and #42, spanning format, template, parser, docs and tests.
- Anchor assessed: structurally complete. Scope line 270 ("Area profiles (state, goals and inventories)…") contradicts the 2026-11-03 ruling. Provisional verdict: aligns, on Scope line 272 ("Goal pursuit: yearly goal setting…"). Proposed `extend` replacement text for line 270.
- Overlap check: no `docs/registry/`; ADRs 0000 to 0008 searched, none overlap.
- #36's body unread (agent had no shell); orchestrator relays it.

### 2026-11-03 — main — note: operator answers relayed to Define
- Tier: full. Location: new top-level `01-vision/` (between `00-inbox/` and `10-projects/`; no existing folder renumbered). Chart: 8 pillars × 8 actions is a maximum, partial charts allowed. In-year changes: recorded in a dated changes section in the note. Anchor: replacement Scope text approved as written.
- Settled from the issue body, not asked: the Mandala Chart is the need (named in the issue and the Mission); scope includes the agent-guided goal-setting session that drafts to `00-inbox/` (issue Ask 1 and 4). Pillar-to-area link check left to Define to propose (default: warning, not failure).

### 2026-11-03 — compass-labs:define — decision: framing tier full, Mandala Chart confirmed as the need
- The operator confirmed full tier. Reason: #36 creates the vision-layer contract that #37 to #42 read, and spans format, template, parser and validator, docs, tests and an agent-guided session.
- XY check: the Mandala Chart is the need, not a candidate fix. 8 pillars × 8 actions is a maximum, and a partly filled chart is valid.
- Scope (b): format, template, parser and validator, docs, and an agent-guided session whose draft lands in `00-inbox/` for sign-off. Location: a new top-level `01-vision/`, with no PARA folder renumbered, shipping only a README and keeping its content local. Changes during the year are recorded in a dated changes section in the note.

### 2026-11-03 — compass-labs:define — attempt: define/ written at full tier
- Six files: index, framing, problem, requirements, quality, diagrams. REQ-001 to REQ-018 (14 Must, 4 Should, none deferred), NEED-01 to NEED-04, OUT-01 to OUT-03, full 25010 coverage (performance efficiency and safety N/A, with reasons), NFR measures for REQ-016 to REQ-018; impact map, context and traceability diagrams.
- Proposals for the operator at the gate: secondary goals as a short list (REQ-004), a warning for missing area links (REQ-005), refusing a second sign-off for the same year (REQ-014), a one-week appetite, and the amendment flow out of scope.

### 2026-11-03 — compass-labs:define — decision: anchor Scope update approved (extend)
- Verdict: aligns, on Scope "Goal pursuit: yearly goal setting…". The operator approved replacing the Scope line "Area profiles (state, goals and inventories) and a structure that grows from evidence: …" with: "A structure that grows from evidence: areas hold the knowledge that accumulates over the year, and new areas, sub-areas and resource branches are proposed, then accepted or pruned by the operator. The operator's goals and direction live in the goal-pursuit layer, not in areas."
- Mission and all other anchor lines unchanged. Agreed text is in `define/framing.md`'s anchor-update block; the orchestrator wrote it into README.md in this commit.

### 2026-11-03 — main — decision: Define gate — adjust
- Operator didn't approve; requested changes. REQ-008 (and REQ-003's single-primary-goal rule): a year can hold more than one goal; more than 3 is strongly discouraged (warning), never rejected. A yearly goal may be broken into sub-goals or quarterly goals; the format must not confine that.
- Secondary goals: short list, as proposed (REQ-004).
- REQ-014: signing off again for a year that already has signed-off goals updates them instead of refusing. Goals may be achieved early or abandoned; the lifecycle stays open for now.
- Amendment flow: deferred to follow-up #46.
- Relayed to compass-labs:define for a revision pass (same phase).

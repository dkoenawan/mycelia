---
session: 2026-10-20-readme-install-task-commands
type: feature
issue: 10
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
next_step: "Define gate: operator approves the requirements (REQ-001 to REQ-011)"
---
# Session Log: Root README Install section: use task install / task bootstrap-areas (#10)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`implement/tasks.md`](implement/tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Work runs on branch `docs/issue-10-readme-install`; one PR carries the whole session, including Close.

## Key decisions

- **2026-10-20**: Follow-up #25: doctor treating Node and Claude Code as optional for installs that don't run the ingester.
- **2026-10-20**: Tier short; scope option B: README Install section plus install.sh's printed next steps gain `task deps:node` (no behaviour change); doctor optionality deferred to #25.

---

## Phase: Define

### 2026-10-20 — main — note: session opened
- Issue #10 (deferred from #9, design D13): the root README's Install section still shows manual `cp` commands instead of `task install` / `task bootstrap-areas`. The operator asked for the full flow end to end, one subagent per phase with orchestrator review, and a PR that includes Close.

### 2026-10-20 — main — handoff: orchestrator → compass-labs:define (frame + requirements)
- **Input:** Frame the problem and write requirements for #10. The README Install section (README.md ~L61–70) shows `git clone` + two manual `cp` of `control/*.example.yaml` + `$EDITOR`; `task install` (scripts/install.sh, idempotent, never overwrites) and `task bootstrap-areas` (scripts/bootstrap-areas.sh, needs python3+PyYAML) already exist, and `task doctor` verifies. Small docs-only change; operator expects a light tier.
- **Output:** needs_input → done (after one relay); define/index.md, framing.md, problem.md, requirements.md

### 2026-10-20 — compass-labs:define — attempt: Define drafted at the proposed short tier (REQ-001 to REQ-010)
- Tier proposed: short. XY: the issue's fix is the chosen candidate; the need is a complete, supported setup path (NEED-01) and a README matching the tooling (NEED-02). The README also misses go-task (ADR-0001), `task doctor`, and the tools doctor checks.
- Anchor complete, aligns, no update. No ADR conflicts; Notion tutorial/how-to already use the task path.
- Gap found from reading the scripts: `task doctor` (non-CI) requires claude, Node 22.18+ and Node deps, but `install.sh`'s next steps omit `task deps:node`.

### 2026-10-20 — main — note: orchestrator review of the draft
- Verified the gap against `scripts/doctor.sh` (claude, node ≥22.18, deps checks fail outside --ci) and `scripts/install.sh` (next steps go straight to doctor).
- Disagreed with the agent's recommended option A: a README listing `task deps:node` while install.sh doesn't would contradict OUT-02 (no mismatch with install.sh). Recommended B to the operator.
- Operator answered: tier short; option B. Orchestrator created follow-up #25 (doctor treating Node/Claude Code as optional) and relayed both answers, plus a request to tighten REQ-007 to the full shared order.

### 2026-10-20 — main — decision: follow-up #25 created
- Deferred from this session: whether `task doctor` should treat Node and Claude Code as optional for installs that don't run the ingester. Tracked in #25, listed in define/index.md Non-goals.

### 2026-10-20 — compass-labs:define — decision: Tier short and scope option B confirmed
- **Tier: short**, confirmed by the operator. Docs-only change to one README section plus one line of a script's printed text.
- **Scope: option B.** The root README's `## Install` section and the next steps `scripts/install.sh` prints; the printed next steps gain `task deps:node` before `task doctor` (REQ-011). No script behaviour changes.
- **Moved to a follow-up:** doctor optionality for Node and Claude Code, #25. Until then, the README lists both as prerequisites (REQ-002).
- **Anchor:** complete, aligns, no update (action: none).

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
next_step: "Define: frame the problem and write requirements for #10"
---
# Session Log: Root README Install section: use task install / task bootstrap-areas (#10)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`implement/tasks.md`](implement/tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Work runs on branch `docs/issue-10-readme-install`; one PR carries the whole session, including Close.

## Key decisions

---

## Phase: Define

### 2026-10-20 — main — note: session opened
- Issue #10 (deferred from #9, design D13): the root README's Install section still shows manual `cp` commands instead of `task install` / `task bootstrap-areas`. The operator asked for the full flow end to end, one subagent per phase with orchestrator review, and a PR that includes Close.

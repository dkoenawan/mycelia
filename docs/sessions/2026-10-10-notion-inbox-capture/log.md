---
session: 2026-10-10-notion-inbox-capture
type: feature
issue: 21
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
next_step: "Hand off to compass-labs:define to frame the problem and write requirements"
---
# Session Log: Notion inbox: capture from phone into the vault inbox (#21)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Define not started.

## Key decisions

---

## Phase: Define

### 2026-10-10 — main — note: session opened
- Operator wants to capture notes from a phone into a Notion inbox and have mycelia pull them into `00-inbox/`. Three components named: Notion read integration; a setup task command (API key → create inbox database/page from a template); a daily pull that marks each Notion item processed / not processed, reusing the inbox ingestion work (#12).

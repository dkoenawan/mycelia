---
paths:
  - "docs/sessions/**"
---

# Compass sessions: commit points

Session folders follow the session lifecycle (see `design.md` in the relevant `docs/sessions/{date}-{slug}/` folder for this plugin's own design).

- **Every `decision` or `milestone` entry in a session's `log.md` gets exactly one commit.** That commit contains the log entry *and* the artifact changes the entry describes. A complete set of requirements is recorded as its own `decision` entry, so it gets its own commit.
- **Every ticked task in `tasks.md` gets one commit** containing the code and the tick.
- Drafts still under discussion, with no `decision` entry yet, stay uncommitted.
- At a milestone, the order is: commit, push, then `gh` updates (D5).
- Only the orchestrator writes `log.md`. Phase agents return log entries instead (D4).

This rule is guidance only — enforced by `hooks/session-commit-guard.sh` (`Stop`) and `hooks/session-guard.sh` (`PreToolUse`, for the frozen-artifact case), which block on the same conditions this rule describes.

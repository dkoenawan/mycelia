<!-- tier: short. The main doc (D12). Summarise and link; never restate a sub-doc's content. -->
# Define: Root README Install section: use task install / task bootstrap-areas

> Phase: Define | Started: 2026-10-20 | Status: Draft, ready for the Define gate
> Relates to: Issue #10 · Session history: [`log.md`](../log.md)

## Contents

- [Requirements](requirements.md): REQ-001 to REQ-011 live (9 Must, 2 Should); none deferred
- [Framing](framing.md): the XY check (the issue's fix chosen, need widened to the full install path), symptom and cause, the anchor (complete, aligns, no update), and overlaps with ADRs 0001, 0004, 0005 and 0007, the Notion docs, and the doctor and `install.sh` gap
- [Problem](problem.md): NEED-01 and NEED-02, evidence, OUT-01 and OUT-02

## Framing

- **Tier:** short. It's a docs-only change to one README section, plus one line of a script's printed text. But the issue names its fix, and the install path covers four tasks and ADR-0001's prerequisite rule, so the need and the success check are worth confirming. Confirmed by the operator on 2026-10-20.
- **Verdict:** aligns with the project anchor, with no anchor change. See [framing.md](framing.md).

## Problem statement

The root README's Install section still shows the manual copy steps from before the Taskfile. It skips the areas manifest, the go-task prerequisite (which ADR-0001 says it must document), the Node and Claude Code tools `task doctor` checks, and the doctor and area-bootstrap steps. `install.sh`'s own next steps also send the installer to doctor before the Node dependencies are installed. So a new installer, or the operator on a new machine, finds the missing steps only through a failing doctor. Needs: NEED-01 (a complete, supported setup path from a fresh clone) and NEED-02 (the README matches the tooling). Outcomes: OUT-01 (a fresh clone set up from the README alone passes `task doctor` and has its area notes) and OUT-02 (no mismatch with the Taskfile or `install.sh`). See [problem.md](problem.md).

## Scope

The root `README.md` `## Install` section, and the next steps `scripts/install.sh` prints:

1. Prerequisites and supported platforms: [REQ-002](requirements.md#requirements).
2. The setup steps, in order: seed (`task install`), edit roots and estate, `task deps:node`, verify (`task doctor`), edit areas or keep the defaults, `task bootstrap-areas`, open in Obsidian or use as files: [REQ-001](requirements.md#requirements), [REQ-003](requirements.md#requirements) to [REQ-009](requirements.md#requirements).
3. A fresh clone set up from the section alone passes doctor and has its area notes: [REQ-010](requirements.md#requirements).
4. `install.sh`'s printed next steps add `task deps:node` before `task doctor`, in the same order as the README: [REQ-011](requirements.md#requirements), [REQ-007](requirements.md#requirements).

### Non-goals

- Making `task doctor` treat Node and Claude Code as optional for an install that doesn't run the ingester. Tracked in #25. Until then, the README lists them as prerequisites (REQ-002).
- Any other change to the scripts or the Taskfile beyond REQ-011's printed next steps. Behaviour stays the same.
- A go-task presence check inside the Taskfile (ADR-0001's "ideally"). Not tracked.
- Showing the direct-script equivalents (`./scripts/*.sh`) in the README. The scripts' own messages already give them.
- Editing other README sections (Inbox ingestion, Phone capture), the tutorial or the how-to. They already use the task path.

## Constraints

- Two edits only: `README.md`'s Install section, and the next-steps text `scripts/install.sh` prints. No script behaviour changes: `install.sh` seeds the same files in the same way.
- Public repository (CLAUDE.md): no real names, usernames, absolute paths, hostnames or real repo URLs. The clone line keeps a placeholder such as `<this-repo>`.
- The section must be accurate against today's `Taskfile.yml`, `scripts/install.sh`, `scripts/bootstrap-areas.sh` and `scripts/doctor.sh`, and must not contradict ADR-0001 or ADR-0005.

## Open questions

All questions resolved. The operator confirmed the short tier, and chose option B for the doctor and `install.sh` gap (REQ-011 in scope; doctor's optional checks go to #25), both on 2026-10-20.

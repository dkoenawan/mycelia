# Framing: Root README Install section: use task install / task bootstrap-areas

> Part of [index](index.md) · Define

## Problem checks

### Solution-first (XY)

- **Need behind the request:** someone setting up mycelia from a fresh clone needs the README's Install section to give the complete, supported setup path, so they finish with an install that passes `task doctor` and has its area notes, instead of finding the missing steps in script output or a failing doctor. Maintainers need that section to describe the same path the tooling implements. See NEED-01 and NEED-02 in [problem.md](problem.md).
- **Outcome:** the requested fix moved to Candidate solutions, and it's the chosen one. Naming the Taskfile tasks isn't a fix chosen too early: ADR-0001 already made Taskfile the install entrypoint. But the issue's fix covers only part of the need. Reading the repo turned up gaps the issue doesn't name: the go-task prerequisite that ADR-0001 says the README must document, the `task doctor` verification step, and the tools doctor checks for (Node.js 22.18 or later with its dependencies, and Claude Code). The requirements cover the need, not only the two task names.

**Candidate solutions:**
- **Chosen:** replace the manual `cp` lines with `task install`, and add `task bootstrap-areas` (issue #10, deferred from the #9 session by design decision D13).
- Noted, not chosen: show the direct-script equivalents (`./scripts/install.sh` and the others) next to each task. The scripts' own messages already give them, and ADR-0001 makes go-task a required dependency. This is listed in the Non-goals.

### Symptom and cause

- **Observed symptom:** the root README's `## Install` section tells the installer to copy `control/roots.example.yaml` and `control/estate.example.yaml` by hand, edit them, and open the folder in Obsidian. It doesn't mention `task install`, `task doctor`, `task bootstrap-areas` or any prerequisite [observed: `README.md` lines 61 to 70; issue #10].
- **Cause:** partly known. The #9 session deliberately left the section unchanged because no requirement covered it (design D13), and opened #10 for it [observed: archived `2026-09-27-areas-taxonomy-bootstrap/design.md` D13 and `log.md`]. Why the section wasn't updated earlier, when ADR-0001 introduced `task install` and asked for the go-task prerequisite to be documented, is **unknown**.

## Anchor

- **State:** complete. The markers appear exactly once, in order (`README.md` lines 225 and 249). Vision, Mission, Scope and Non-goals are present and not empty. No conflicting restatement was found: the README's opening line ("A framework for running a second brain that your agents feed, instead of one you feed.") matches the Vision.
- **Verdict:** aligns.
- **Rests on:**
  - Scope line "Runner tooling (the shared library, install and bootstrap scripts) for scheduled agents that land their own work behind gates": this work documents how to use the install and bootstrap scripts.
  - Scope line "Framework only: generic defaults and schemas; every operator's notes and estate stay local configuration": the Install section keeps showing a placeholder repo URL and generic steps. Every file it seeds is gitignored.
  - Non-goal "Committing an operator's notes, estate or paths to the framework repository, or requiring an instance to be its own repo or fork": not crossed. Nothing operator-specific enters the README.
  - Non-goal "Depending on Obsidian plugins": not crossed. The last step still says Obsidian is optional and needs no plugins.

### Anchor update

- **Action:** none
- **Elements:** none
- **Agreed text:**

none

## Overlaps

There's no construct registry (`docs/registry/`). ADRs live in `docs/adr/`, and I searched them.

- **Aligns, and partly required by: ADR-0001 (Taskfile for install, doctor and update).** Its Consequences say the README's install section "must document this prerequisite [go-task] clearly". The current section doesn't, so REQ-002 covers it. ADR-0001's "ideally check for it" (a go-task check inside the Taskfile) is a code change and is in the Non-goals.
- **Aligns: ADR-0005 (areas taxonomy and bootstrap).** `task bootstrap-areas` needs python3 with PyYAML, and `install.sh` seeds `control/areas.local.yaml` next to the roots and estate files. The README has to reflect both (REQ-002, REQ-006).
- **Aligns: ADR-0004 (release versioning).** The release smoke test runs `task install` and then `task doctor:ci`. The documented install starts the same way.
- **Aligns: ADR-0007 (TypeScript on Node runners).** `task doctor` checks Node.js 22.18 or later and the installed Node dependencies, so the README lists Node as a prerequisite and runs `task deps:node` before doctor (REQ-002, REQ-004).
- **Duplication checked: `docs/tutorials/notion-first-phone-capture.md` and `docs/how-to/notion-capture.md`.** Both already use `task install` and `task bootstrap-areas`, so the README is the one doc that disagrees. They don't need to change.
- **Gap found, split by the operator on 2026-10-20 (option B):**
  - `install.sh`'s printed next steps tell the installer to run `task doctor` but never mention `task deps:node`, so that step fails on a fresh clone. **In scope:** REQ-011 adds the step, and REQ-007 holds the README and the script to the same order.
  - `task doctor` (without `--ci`) fails when the `claude` binary, Node.js 22.18 or later, or the installed Node dependencies are missing, even for an install that never runs the ingester. **Out of scope:** tracked as #25. Until then, the README lists these tools as prerequisites (REQ-002).
- **No conflict found** with ADR-0002 (framework and instance separation), ADR-0003 (session write-back), ADR-0006 (inbox ingestion) or ADR-0008 (credentialed egress).

---
session: 2026-09-27-areas-taxonomy-bootstrap
type: feature
issue: 9
phase: implement
status: active
# milestone: the PHASE KEY of the last completed milestone, not a display
# label. Allowed values (feature workflow): none | define | design |
# implement | test | deploy | close. "none" until the first milestone
# (Define complete) is reached. The guard hook (D7) uses this key, plus
# each phase's `order` in workflows/<type>.json, to decide which
# artifacts are frozen. Display labels (e.g. "Define complete") live only
# in workflows/<type>.json's `milestone` field, for GitHub comments.
milestone: design
active_agent: main
next_step: "Implement: add T9 (stale-defaults guard, REQ-027/DES-014) to tasks.md and implement it"
---
# Session Log: Default areas taxonomy + bootstrap (#9)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`requirements.md`](requirements.md) · [`design.md`](design.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Follow-up #10: root README Install section should use `task install` / `task bootstrap-areas`.
- Draft `docs/adr/0005-default-areas-taxonomy-and-bootstrap.md` and `docs/research/areas-of-life-taxonomy.md` are untracked inputs. They must not be committed until they use "the operator"/they and no longer list the operator's personal areas. The research note's "Tracked in issue (…)" should point at #9.

## Key decisions

- **2026-09-27**: Scope amended — REQ-027/DES-014/D14: bootstrap refuses to run on unedited defaults when `20-areas/` already holds notes the manifest doesn't list.
- **2026-09-27**: ✅ Design complete — operator approved design.md (DES-001–013, D1–D13, landing order T1–T8).
- **2026-09-27**: Root README Install section deferred to follow-up #10 (design D13).
- **2026-09-27**: ✅ Define complete — operator approved REQ-001–026.
- **2026-09-27**: Requirements agreed — REQ-001–026; all six Define defaults confirmed (no doctor check, install seeds manifest only, PyYAML required, 7 active areas + Community commented, README lists defaults, ADR-0005 `proposed` until landing).
- **2026-09-27**: Session opened on branch `feature/issue-9-areas-bootstrap`. Existing draft ADR-0005 and its research note are inputs to Define, not settled output.

---

## Phase: Define

### 2026-09-27 — main — note: Session opened
- Issue #9 created. Branch `feature/issue-9-areas-bootstrap` cut from `main` (= `origin/main` at 4fac3dc).
- Inputs: the untracked draft ADR-0005 (status says `accepted`, but it has not been committed or reviewed in this session) and `docs/research/areas-of-life-taxonomy.md`.
- Scope as stated by the operator: `control/areas.example.yaml`, `scripts/bootstrap-areas.sh`, `install.sh` seeding the areas manifest, and linking-convention updates to the `20-areas/` and `10-projects/` READMEs. Also clean up the draft docs for the public repo.

### 2026-09-27 — main — handoff: orchestrator → compass-labs:define (REQs from draft ADR-0005)
- **Input:** Turn the draft ADR-0005 and research note into REQ-* requirements. Scope: areas.example.yaml, bootstrap-areas.sh, install.sh seeding, README linking conventions, and public-repo cleanup of the draft docs.
- **Output:** needs_input (6 questions); requirements.md

### 2026-09-27 — compass-labs:define — attempt: First draft of requirements (REQ-001–025)
- Drafted 25 EARS requirements from draft ADR-0005 and the research note. They cover the default manifest, local manifest seeding by `install.sh`, the bootstrap script (create-only, re-runnable, checks input before writing, never touches git-tracked files), the `task bootstrap-areas` entry, README linking conventions and slug list, public-repo cleanup of the ADR and research note, and keeping the release test passing.
- Non-goals: the operator's own areas (manual local step), enforcing links, updating existing notes, per-area templates.
- Found beyond the stated cleanup: the draft ADR names a local vault note (`10-projects/mycelia-as-foundation.md`), and the research note lists the personal areas twice (lines 15–17 and 75–84). REQ-022 covers both.
- Returned 6 questions for the operator: doctor checks, whether install creates notes, the README slug list, the YAML dependency, ADR status, Community as an 8th area.

### 2026-09-27 — compass-labs:define — note: Defaults picked without asking
- `task bootstrap-areas` is in scope (ADR-0001 wraps every script in a `task` entry).
- An invalid or duplicate slug fails the whole run before any note is written, and the error names the bad entry.
- The operator's own 9 areas are not committed work; they go in by hand after merge.
- ADR-0005 should say `proposed`, not `accepted`, until the work lands.

### 2026-09-27 — main — note: Operator answered Define questions
- All six proposed defaults confirmed; relayed to compass-labs:define via SendMessage.
- **Output:** done; requirements.md

### 2026-09-27 — compass-labs:define — decision: Requirements agreed (REQ-001–026)
- Requirement set agreed with the operator: REQ-001–026 in `requirements.md`, each with one Given/When/Then.
- The operator confirmed all six proposed defaults:
  1. No areas check in `doctor.sh`, and no schema `version:` on the areas manifest.
  2. `install.sh` only seeds `control/areas.local.yaml`. Notes come from `task bootstrap-areas`.
  3. `20-areas/README.md` keeps a slug list, labelled as the shipped defaults, and names `areas.local.yaml` as authoritative.
  4. The bootstrap requires python3+PyYAML and fails clearly without it (new REQ-026).
  5. ADR-0005 stays `proposed` until the commit that lands the work, then becomes `accepted` (REQ-024).
  6. Seven active default areas, with Community commented out (REQ-001 tightened from "6–8").
- Not in this work: the operator's own areas (a manual local step after merge), enforcing links, updating existing notes, per-area templates, frontmatter format changes.

### 2026-09-27 — main — milestone: ✅ Define complete
- Operator approved `requirements.md` (REQ-001–026) at the Define gate. Moving to Design.

---

## Phase: Design

### 2026-09-27 — main — handoff: orchestrator → compass-labs:design (DES for REQ-001–026)
- **Input:** Turn the agreed REQ-001–026 into DES-* components and decisions: manifest schema, bootstrap-areas.sh structure, install.sh seeding, Taskfile entry, README text, ADR/research cleanup.
- **Output:** done; design.md

### 2026-09-27 — compass-labs:design — attempt: Design drafted (DES-001–013, D1–D13)
- `design.md` maps REQ-001–026 to 13 components: the default manifest, `seed_local` moved into `common.sh`, the `install.sh` changes, the bootstrap script and its embedded python generator, the note template, the Taskfile entry, `.gitignore` (unchanged), both READMEs, the ADR-0005 and research cleanup, and release-CI compatibility.
- The landing order is set as T1–T8, with the ADR-0005 status flip last and merge-bound.

### 2026-09-27 — compass-labs:design — note: Decided without asking
- `seed_local` moves into `scripts/lib/common.sh` and gains a check for a missing example file. The bootstrap doesn't call or source `install.sh`.
- The bootstrap is a bash script around one embedded python/PyYAML block. It validates the manifest before seeding, writes notes only if they don't already exist, and exits 1 on any failure. It runs a `git check-ignore` guard and runs no git commands that change anything.
- Unknown manifest keys are rejected (stricter than REQ-016).
- Slugs are `health`, `finances`, `career`, `relationships`, `personal-growth`, `home-environment`, `recreation`, with `community` commented out. `home` is avoided because of the Obsidian `Home.md` collision. The operator can adjust these at the gate.
- Example wikilinks are written as code spans, to avoid dangling graph nodes.
- ADR-0005 records the unversioned areas manifest as an explicit exception to ADR-0002's version rule.
- `release.yml`, `doctor.sh` and `.gitignore` are unchanged. The root README Install section is out of scope.

### 2026-09-27 — main — decision: Root README Install section deferred to #10
- Design D13 left the root `README.md` Install section (manual `cp` commands) out of scope; no REQ covers it. Follow-up issue #10 created.

### 2026-09-27 — main — milestone: ✅ Design complete
- Operator approved `design.md` at the Design gate ("atomic commit please"). Slugs accepted as designed. Moving to Implement.

---

## Phase: Implement

### 2026-09-27 — main — handoff: orchestrator → compass-labs:implement (tasks T1–T8)
- **Input:** Decompose design.md into tasks.md (T1–T8 landing order) and execute; one atomic commit per ticked task. T8 (ADR-0005 → accepted) is held until Test passes.
- **Output:** done; tasks.md, ADR-0005, research note, common.sh, install.sh, bootstrap-areas.sh (new), areas.example.yaml (new), Taskfile.yml, 20-areas/README.md, 10-projects/README.md

### 2026-09-27 — compass-labs:implement — attempt: T1–T7 implemented and committed
- tasks.md created from the design landing order; T1–T7 ticked, one commit each: cbf4399, 3795ded, 63599f6, 38f0918, 10396a8, 5bd190a, 5bcba4f.
- Verified in temp clones: task install (run twice) + task doctor:ci pass; bootstrap first run creates 7 notes, re-run skips all 7, invalid/missing-example/no-PyYAML cases exit 1 and write nothing; smoke test passes with PyYAML stubbed out; git status stays clean.
- T8 (ADR-0005 → accepted, date:) left unchecked on purpose — per D12 it lands only after Test passes.

### 2026-09-27 — compass-labs:implement — note: Deviations from design (recorded in tasks.md)
- DES-006: the note's self-link `[[<slug>]]` is a real link, not wrapped in backticks. The template block and its bullet disagreed; the bullet and ADR-0005 say it is the one live link.
- DES-005: the manifest is parsed from a string so YAML errors show `control/<file>` plus line and column, not PyYAML's absolute path. The missing-example message drops the absolute-path suffix too.

### 2026-09-27 — main — note: Orchestrator spot-check
- Confirmed 7 task commits on branch, `bash -n` clean on all scripts, ADR-0005 `status: proposed`, 7 active slugs + commented `community`. Privacy grep over changed files: only hits are the `github.com/dkoenawan/mycelia/issues/9` links (same pattern as ADR-0002/0004, flagged in design risks).

### 2026-09-27 — main — decision: Amend requirements and design — stale-defaults guard (REQ-027, DES-014, D14)
- Operator asked what happens when `install.sh` runs on an existing install. Finding: install is safe (copy-if-absent), but an existing install gets `areas.local.yaml` seeded with the generic defaults; running `task bootstrap-areas` without editing it adds 7 default notes alongside hand-written ones (e.g. `health.md` next to `health-and-fitness.md`).
- Operator chose option 1: a guard in the bootstrap. If the local manifest's entries are identical to the example's (unedited defaults) and `20-areas/` already contains at least one note (other than `README.md`) whose stem is not a manifest slug, the bootstrap exits 1 before writing anything, names those notes, and tells the operator to edit `control/areas.local.yaml` first.
- No override flag: listing the existing notes' slugs in the manifest (or any edit to the entries) clears the guard.
- Frozen artifacts amended by the orchestrator in this same commit: `requirements.md` (REQ-027) and `design.md` (DES-014, D14, landing-order T9). Implement is reopened to add and execute T9.

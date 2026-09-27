---
session: 2026-09-27-areas-taxonomy-bootstrap
type: feature
issue: 9
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
next_step: "Define milestone gate: operator approves requirements.md"
---
# Session Log: Default areas taxonomy + bootstrap (#9)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`requirements.md`](requirements.md) · [`design.md`](design.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Draft `docs/adr/0005-default-areas-taxonomy-and-bootstrap.md` and `docs/research/areas-of-life-taxonomy.md` are untracked inputs. They must not be committed until they use "the operator"/they and no longer list the operator's personal areas. The research note's "Tracked in issue (…)" should point at #9.

## Key decisions

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

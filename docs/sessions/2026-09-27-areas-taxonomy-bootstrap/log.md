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
next_step: "Define: turn the draft ADR-0005 and its research note into REQ-* requirements"
---
# Session Log: Default areas taxonomy + bootstrap (#9)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`requirements.md`](requirements.md) · [`design.md`](design.md) · [`tasks.md`](tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Draft `docs/adr/0005-default-areas-taxonomy-and-bootstrap.md` and `docs/research/areas-of-life-taxonomy.md` are untracked inputs. They must not be committed until they use "the operator"/they and no longer list the operator's personal areas. The research note's "Tracked in issue (…)" should point at #9.

## Key decisions

- **2026-09-27**: Session opened on branch `feature/issue-9-areas-bootstrap`. Existing draft ADR-0005 and its research note are inputs to Define, not settled output.

---

## Phase: Define

### 2026-09-27 — main — note: Session opened
- Issue #9 created. Branch `feature/issue-9-areas-bootstrap` cut from `main` (= `origin/main` at 4fac3dc).
- Inputs: the untracked draft ADR-0005 (status says `accepted`, but it has not been committed or reviewed in this session) and `docs/research/areas-of-life-taxonomy.md`.
- Scope as stated by the operator: `control/areas.example.yaml`, `scripts/bootstrap-areas.sh`, `install.sh` seeding the areas manifest, and linking-convention updates to the `20-areas/` and `10-projects/` READMEs. Also clean up the draft docs for the public repo.

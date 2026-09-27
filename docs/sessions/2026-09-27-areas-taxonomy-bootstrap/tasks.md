---
issue: 9
branch: feature/issue-9-areas-bootstrap
status: in-progress
test_command: "bash -n scripts/*.sh scripts/lib/common.sh && task install && task doctor:ci"
last_skill_commit: null
retry_counts:
schedule: null
budget:
  max_tasks_per_run: 8
  max_wall_clock_minutes: 90
  stop_on_first_failure: true
---

# Tasks: Default areas taxonomy + bootstrap

> Phase: Implement | Design: [`design.md`](design.md) (landing order T1–T8) · Requirements: [`requirements.md`](requirements.md)

One commit per ticked task, containing that task's changes and its tick.

- [x] T1 — ADR-0005 and research-note public-repo cleanup; first commit of both, `status: proposed` (DES-011 minus status flip, DES-012)
- [x] T2 — Move `seed_local()` from `install.sh` into `scripts/lib/common.sh`, add missing-example guard and neutral created-message (DES-002)
- [x] T3 — Add `control/areas.example.yaml`: seven active areas, Community commented out, schema documented in comments (DES-001)
- [x] T4 — `install.sh` seeds `control/areas.local.yaml` and prints the new Next steps (DES-003, DES-013) (depends on: 2, 3)
- [ ] T5 — Add `scripts/bootstrap-areas.sh`: bash shell, embedded python validator/generator, note template (DES-004, DES-005, DES-006, DES-008) (depends on: 2, 3)
- [ ] T6 — Taskfile `bootstrap-areas` task (DES-007) (depends on: 5)
- [ ] T7 — `20-areas/README.md` default-slug list and linking section; `10-projects/README.md` linking section (DES-009, DES-010) (depends on: 3)
- [ ] T8 — Accept ADR-0005: `status: accepted`, `date:` set to landing date (DES-011 status lifecycle, D12). Held: runs only after Test passes; not executed by Implement. (depends on: 1, 2, 3, 4, 5, 6, 7)

## Deviations from design

None yet.

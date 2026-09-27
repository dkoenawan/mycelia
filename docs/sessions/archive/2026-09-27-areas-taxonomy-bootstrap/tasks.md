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

> Phase: Implement | Design: [`design.md`](design.md) (landing order T1–T9) · Requirements: [`requirements.md`](requirements.md)

One commit per ticked task, containing that task's changes and its tick.

- [x] T1 — ADR-0005 and research-note public-repo cleanup; first commit of both, `status: proposed` (DES-011 minus status flip, DES-012)
- [x] T2 — Move `seed_local()` from `install.sh` into `scripts/lib/common.sh`, add missing-example guard and neutral created-message (DES-002)
- [x] T3 — Add `control/areas.example.yaml`: seven active areas, Community commented out, schema documented in comments (DES-001)
- [x] T4 — `install.sh` seeds `control/areas.local.yaml` and prints the new Next steps (DES-003, DES-013) (depends on: 2, 3)
- [x] T5 — Add `scripts/bootstrap-areas.sh`: bash shell, embedded python validator/generator, note template (DES-004, DES-005, DES-006, DES-008) (depends on: 2, 3)
- [x] T6 — Taskfile `bootstrap-areas` task (DES-007) (depends on: 5)
- [x] T7 — `20-areas/README.md` default-slug list and linking section; `10-projects/README.md` linking section (DES-009, DES-010) (depends on: 3)
- [x] T9 — Stale-defaults guard in `scripts/bootstrap-areas.sh`: refuse when the manifest entries equal the example's and `20-areas/` has notes no slug matches; runs before seeding (DES-014, D14; added after Design) (depends on: 5)
- [ ] T8 — Accept ADR-0005: `status: accepted`, `date:` set to landing date (DES-011 status lifecycle, D12). Held: runs only after Test passes; not executed by Implement. (depends on: 1, 2, 3, 4, 5, 6, 7, 9)

## Deviations from design

- **T5 / DES-006 — self-link rendered live, not as a code span.** DES-006's template block wraps the self-link as `` `[[<slug>]]` ``, but its own bullet (and ADR-0005 as edited in T1) says the self-link is the one *live* link. A code span is not a link in Obsidian, so the two can't both hold. Implemented the bullet's intent: the body writes `[[<slug>]]` bare; `[[project-slug]]` and `[[resource-slug]]` stay code spans. REQ-010 is satisfied either way.
- **T5 / DES-005 — YAML parse errors are reported relative to the file.** PyYAML's own message embeds the absolute path of the file it read, which contradicts DES-005's "no absolute path appears in output". The manifest is read to a string and parsed from that; the error prints `control/<file> does not parse as YAML at line L, column C: <problem>`. Same information, no path leak. For the same reason the missing-example message omits install.sh's "(looked under <root>)" suffix.
- **T9 / DES-014 — guard runs before seeding, against the would-be source.** DES-014 places the guard inside the generator in both modes; it is run in the step-6 `--check` pass against `SOURCE` (the example when no local manifest exists), so a refused run leaves no seeded `control/areas.local.yaml` behind — REQ-027's "before creating any file". When the local manifest doesn't exist yet, the message also says how to create it (`task install` or `cp`), since there is nothing to edit.
- **T9 / DES-004 step 6 — neutral die message.** The step-6 failure now covers both an invalid manifest and a guard refusal, so its message is "areas bootstrap stopped before writing anything — see errors above." instead of "control/<file> is invalid — no notes written."; the per-entry or guard errors above it carry the specifics. The generator now also takes the example path and `20-areas/` path in `--check` mode.

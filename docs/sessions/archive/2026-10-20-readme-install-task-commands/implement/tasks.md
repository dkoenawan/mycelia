---
issue: 10
branch: docs/issue-10-readme-install
status: in-progress
test_command: bash -n scripts/install.sh
last_skill_commit: null
retry_counts:
schedule: null
budget:
  max_tasks_per_run: 3
  max_wall_clock_minutes: 90
  stop_on_first_failure: true
---

Each task names the `DES-*` item it implements. An item's last task carries its Check.

- [x] Add step 3 `task deps:node` to `scripts/install.sh`'s "Next steps:" `log` lines and renumber the old steps 3 to 6 as 4 to 7 [DES-002] — check: the diff to `install.sh` touches only the next-steps `log` lines; `bash -n scripts/install.sh` passes
- [x] Rewrite the root `README.md` `## Install` section: prerequisites paragraph, seven numbered steps in `install.sh`'s order each with its own code block, closing Obsidian/plain-files paragraph [DES-001] (depends on: 1) — check: every `task <name>` in the section is defined in `Taskfile.yml`; the section has no `cp` of a `control/` file and no `$EDITOR` line; its step order matches DES-002's printed order line for line (REQ-007)

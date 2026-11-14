---
issue: 36
branch: feat/36-year-goal-setting
status: in-progress
test_command: task check:node
last_skill_commit: null
retry_counts:
schedule: null
budget:
  max_tasks_per_run: 3
  max_wall_clock_minutes: 90
  stop_on_first_failure: true
---

<!-- The plan in the implement/ folder: the task checklist only. Tasks come from the design's Components (DES) table by the Implement standard's task rule (skills/implement/SKILL.md): each task names the DES-* it implements, tasks follow the Depends-on order, and an item's last task carries its Check, unless the Check needs a Test-owned test (then it goes under Handed to Test in as-built.md). Statuses, variations, layer artifacts and Handed to Test live in as-built.md, never here. -->

Each task names the `DES-*` item it implements. An item's last task carries its Check.

- [x] Build the `YearGoals` model, `parse(text)` and `validate(text, knownAreas)` in `src/goals/domain/`, with unit tests in `test/goals/domain.test.ts` [DES-001] — check: the acceptance cases of REQ-002 to REQ-007 and REQ-019 to REQ-021 pass as unit tests; ESLint's domain rule passes
- [x] Add `01-vision/README.md` and the `.gitignore` rules `01-vision/*` and `!01-vision/README.md`, with a check-ignore test in `test/goals/vision-folder.test.ts` [DES-008] — check: `git ls-files 01-vision/` lists only the README, and neither a note in `01-vision/` nor a draft in `00-inbox/` shows in `git status --porcelain`
- [x] Write `docs/reference/year-goals/format.md`, `template.md` and `example-2027-goals.md`, with tests in `test/goals/docs.test.ts` [DES-009] (depends on: 1) — check: the validator gives 0 errors and 0 warnings on the example with the default area set, and 0 errors on the template
- [x] Build `renderDraft(model, dates)` in `src/goals/domain/render.ts` and the text-preserving sign-off edits in `src/goals/domain/edit.ts`, with unit tests in `test/goals/render-edit.test.ts` [DES-002] (depends on: 1, 3) — check: `parse(renderDraft(parse(example)))` equals `parse(example)` on the documented elements; a sign-off edit on a note with a quarterly breakdown keeps the breakdown byte for byte
- [x] Build the ports and the `validateNote`, `currentGoals`, `saveDraft` and `signOff` use cases in `src/goals/application/`, and extend the ESLint layer rule to `src/goals/{domain,application}/`, with use-case tests on in-memory ports in `test/goals/application.test.ts` [DES-003] (depends on: 1, 4) — check: use-case tests with in-memory ports cover the acceptance cases of REQ-012, REQ-013 and REQ-014 and the order of writes; ESLint fails if `application/` imports `adapters/`
- [ ] Build `FsVisionVault`, `FsAreaIndex` and `GitIgnoreProbe` in `src/goals/adapters/`, with adapter tests against a temp vault in `test/goals/adapters.test.ts` [DES-004] (depends on: 5) — check: after a save step and two sign-offs, a checksum of `20-areas/` is unchanged and every written path is reported as ignored
- [ ] Build the `goals` command group `src/goals/cli.ts` (`validate`, `save-draft`, `sign-off`), with component tests on a temp vault in `test/goals/cli.test.ts` [DES-005] (depends on: 5, 6) — check: running each subcommand on a temp vault gives the designed exit codes and files
- [ ] Spike the Claude Code CLI flags, then build the session launcher `src/goals/adapters/session.ts` and `src/goals/session-prompt.txt`, and wire `session <year> [--continue]` into `src/goals/cli.ts`, with launcher tests in `test/goals/session.test.ts` [DES-006] (depends on: 7) — check: spike notes are in the launcher's header; a launcher test with a fake spawner and a fake preflight checks the arguments, the refusal and the post-exit validation
- [ ] Build the `mycelia` dispatcher `src/mycelia.ts` and add `bin.mycelia` and `scripts.mycelia` to `package.json`, with dispatcher tests in `test/mycelia.test.ts` [DES-007] (depends on: 7, 8) — check: a dispatcher test covers an unknown group and the exit-code passthrough
- [ ] Update `README.md` (Layout, Year goals section, the `npx mycelia` Install line) and `CLAUDE.md` ("Where things go" row, `type: vision`, the runtime-commands line) [DES-011] (depends on: 2, 3, 9) — check: both files name `01-vision/` and the `mycelia` command and link the format reference; no `task goals:*` appears anywhere; no real names or absolute paths
- [ ] Audit `test/goals/` and `test/mycelia.test.ts` against REQ-018's list and the DES-002, DES-003, DES-004, DES-006 and DES-007 checks, add any missing named test, and run the more-than-3 mutation check [DES-010] (depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9) — check: `task check:node` passes; turning the more-than-3 warning into an error makes at least one test fail

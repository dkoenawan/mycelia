# Problem: Root README Install section: use task install / task bootstrap-areas

> Part of [index](index.md) · Define

### Need and stakeholders

- **NEED-01:** When someone sets up mycelia from a fresh clone (a new installer reading the public README, or the operator setting up another machine), they want the README's Install section to give the complete, supported setup path, so they finish with a verified install and their area notes without finding the missing steps in script output or a failing `task doctor`.
- **NEED-02:** When the install tooling changes (as #9 did when it added the areas manifest), framework maintainers want the README's Install section to describe the same path the Taskfile and scripts implement, so the first doc a newcomer reads doesn't quietly fall behind the tooling.

### Evidence

- The Install section shows `git clone`, two manual `cp control/*.example.yaml control/*.local.yaml` lines, an `$EDITOR` line, and "open the directory in Obsidian". It names no task and no prerequisite [observed: `README.md` lines 61 to 70].
- `task install` seeds three local files: roots, estate **and** areas. It's idempotent and never overwrites. Its printed next steps are: edit roots, edit estate, `task doctor`, edit areas, `task bootstrap-areas`, open in Obsidian [observed: `scripts/install.sh` lines 19 to 30].
- The manual path seeds only roots and estate. It isn't broken, because `task bootstrap-areas` seeds the areas manifest itself when it's absent [observed: `scripts/bootstrap-areas.sh` header]. The gap is the missing steps, not a wrong file.
- ADR-0001 says the README's install section "must document" the go-task prerequisite. The section doesn't mention it [observed: `docs/adr/0001-install-and-update-tooling.md` Consequences].
- `task doctor` without `--ci` fails unless the `claude` binary resolves, Node.js is 22.18 or later, and the Node dependencies are installed (`task deps:node`) [observed: from reading `scripts/doctor.sh` checks 5, 6a and 6b; not run].
- `install.sh`'s next steps send the installer to `task doctor` without first running `task deps:node`, so on a fresh clone that step fails at check 6b [observed: from reading `scripts/install.sh` and `scripts/doctor.sh`; not run].
- The other docs already use the task path: the Notion tutorial assumes "a mycelia checkout where `task install` has run", and the how-to runs `task install` and `task bootstrap-areas` [observed: `docs/tutorials/notion-first-phone-capture.md`, `docs/how-to/notion-capture.md`].
- The #9 session left the section as it was and opened #10 for it [observed: archived `2026-09-27-areas-taxonomy-bootstrap/design.md` D13].
- The Install section is the first setup text a new installer reads [assumed]. Nobody has reported a failed install caused by it; the gap was found during design review [assumed: no report found in the repo].

### Success outcomes

| Outcome | Signal | Target | Checked when | For need |
|---|---|---|---|---|
| OUT-01 | Result of following only the Install section's commands, in order, on a fresh clone of the branch in a scratch directory with the listed prerequisites installed | `task doctor` exits 0, and `20-areas/` holds one note per active entry in `control/areas.example.yaml` (7 today) | Test phase, before the PR merges | NEED-01 |
| OUT-02 | Mismatches between the Install section and the tooling: a manual `cp` of a `control/` file, a task `Taskfile.yml` doesn't define, or a step out of order against `install.sh`'s printed next steps | 0 mismatches | Test phase, by inspection against `Taskfile.yml` and `scripts/install.sh` | NEED-02 |

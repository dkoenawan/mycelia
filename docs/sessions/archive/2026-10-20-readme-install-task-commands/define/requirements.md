# Requirements: Root README Install section: use task install / task bootstrap-areas

> Part of [index](index.md) · Define

## Requirements

EARS syntax. Each requirement has one acceptance criterion in Given/When/Then form. IDs are never reused; a dropped requirement is struck through, not deleted. A Won't meaning "never" is struck through with its reason; a Won't meaning "later" moves to the Deferred table below.

- **"Install section"** means the `## Install` section of the repository's root `README.md`, up to the next `##` heading.
- **"Fresh clone"** means a clone of the repository with no `control/*.local.yaml` file, no `node_modules/`, and no note in `20-areas/` other than `README.md`.
- **"Listed prerequisites"** means the tools the Install section names under REQ-002.

| ID | Requirement | Priority | Serves | Acceptance criterion |
|---|---|---|---|---|
| REQ-001 | The Install section shall create the local control files with `task install`, and shall not tell the installer to copy any `control/*.example.yaml` file by hand. | Must | OUT-02 | Given the committed `README.md`, when the Install section is read, then it contains the command `task install` and no `cp` command that names a file under `control/`. |
| REQ-002 | The Install section shall list, before its first command, the tools the install steps and `task doctor` need: go-task with a link to its installation page, Node.js 22.18 or later, Claude Code, and python3 with PyYAML for the areas bootstrap; and it shall state that the install runs on Linux and macOS, and on Windows under WSL. | Must | OUT-01 | Given the Install section, when the text before its first code block is read, then it names go-task with a link to `https://taskfile.dev/installation/`, Node.js 22.18 or later, Claude Code, python3 with PyYAML, and Linux, macOS and WSL. |
| REQ-003 | After the seeding step, the Install section shall tell the installer to edit `control/roots.local.yaml` (this machine's paths) and `control/estate.local.yaml` (their scheduled jobs, or an empty jobs list). | Must | NEED-01 | Given the Install section, when it is read, then after `task install` it names both `control/roots.local.yaml` and `control/estate.local.yaml` as files to edit, each with a short note on what it holds. |
| REQ-004 | The Install section shall install the Node dependencies with `task deps:node` before its verification step. | Must | OUT-01 | Given the Install section, when its commands are listed in order, then `task deps:node` appears before `task doctor`. |
| REQ-005 | After the edit and Node-dependency steps, the Install section shall verify the install with `task doctor`, and shall state that the install is healthy when doctor reports no failed checks. | Must | OUT-01 | Given the Install section, when it is read, then `task doctor` appears after the edit step and after `task deps:node`, and the text says a run with no failed checks means the install is healthy. |
| REQ-006 | The Install section shall create the area notes with `task bootstrap-areas`, and before that step shall offer to edit `control/areas.local.yaml` first or keep the shipped defaults. | Must | OUT-01 | Given the Install section, when it is read, then `task bootstrap-areas` appears after `task doctor`, and the text just before it names `control/areas.local.yaml` as editable, with keeping the defaults as an option. |
| REQ-007 | The Install section shall name only tasks that `Taskfile.yml` defines, and shall put the steps that `task install` prints as next steps in the same relative order. | Must | OUT-02 | Given the Install section, `Taskfile.yml` and `scripts/install.sh`, when they are compared, then every `task <name>` in the section is defined in `Taskfile.yml`, and both the section and `install.sh`'s printed next steps give the steps in this order: edit roots, edit estate, `task deps:node`, `task doctor`, edit areas, `task bootstrap-areas`, open in Obsidian. |
| REQ-008 | The Install section shall state that `task install` is safe to re-run, because it creates only missing local files and never overwrites an existing one. | Should | NEED-01 | Given the Install section, when it is read, then it says `task install` can be re-run and never overwrites an existing `control/*.local.yaml`. |
| REQ-009 | The Install section shall end by saying the directory can be opened as an Obsidian vault, or used as plain files. | Should | NEED-01 | Given the Install section, when its last paragraph is read, then it says the folder can be opened in Obsidian or used as plain Markdown files. |
| REQ-010 | When an installer with the listed prerequisites follows the Install section's commands in order on a fresh clone, with the roots set to existing directories, the documented install shall end with `task doctor` reporting no failures and one `20-areas/` note per active entry in the shipped areas manifest. | Must | OUT-01 | Given a fresh clone of the branch in a scratch directory, on a machine with go-task, Node.js 22.18 or later, Claude Code, python3 and PyYAML, when the Install section's commands are run in order with `home`, `repos` and `logs` in `control/roots.local.yaml` set to existing directories, then `task doctor` exits 0 and `20-areas/` holds 7 notes besides `README.md`, one per active slug in `control/areas.example.yaml`. |
| REQ-011 | When `task install` finishes, the next steps it prints shall include `task deps:node` before `task doctor`. | Must | OUT-01, OUT-02 | Given a fresh clone, when `task install` runs, then its output lists `task deps:node` as a next step, and that step comes before the step that runs `task doctor`. |

## Deferred

None

# Requirements: Default areas taxonomy + bootstrap

> Phase: Define | Started: 2026-09-27 | Status: Agreed — awaiting Define milestone
> Relates to: Issue #9

## Problem statement

A fresh mycelia clone has an empty `20-areas/`, with no default taxonomy and no way to generate one. Every installer, the operator included, has to write each Area note and its frontmatter by hand. Because nothing sets out the expected project-to-area and area-to-resource linking, those links get made inconsistently or not at all. The framework needs a generic starting point that each installer can override. That starting point must not ship any one person's life as the default.

## Scope

This session implements draft ADR-0005 (`docs/adr/0005-default-areas-taxonomy-and-bootstrap.md`) and prepares it and its research note for the public repo:

1. A committed, generic default areas manifest (`control/areas.example.yaml`).
2. An areas bootstrap runner (`scripts/bootstrap-areas.sh`). It turns the operator's local manifest into Area notes and exposes a `task` entrypoint.
3. `install.sh` seeding the local areas manifest.
4. Linking-convention text in the `20-areas/` and `10-projects/` READMEs, plus a slug index in `20-areas/README.md`.
5. Public-repo cleanup of the draft ADR-0005 and `docs/research/areas-of-life-taxonomy.md` before they are committed.

### Non-goals

- **Filling in the operator's own areas.** Their personal list goes into their gitignored `control/areas.local.yaml` as a manual step after merge. No committed file carries it.
- **Enforcing the linking convention**, e.g. broken-wikilink detection in `doctor.sh`. ADR-0005 documents the convention but doesn't enforce it. Enforcement is a revisit condition there, not work for this session.
- **Updating Area notes that already exist** when their manifest entry changes (renaming, rewriting descriptions, deleting). Bootstrap only creates notes. Changing notes it already made is left to the operator.
- **Per-area body templates** or any manifest fields beyond what one note's frontmatter needs. This is a revisit condition in ADR-0005.
- **Changing the note-frontmatter format** in CLAUDE.md.
- **Areas checks in `doctor.sh`**, and a schema `version:` on the areas manifest. The operator declined both (Open question 1). No new check is added.
- **Generating notes from `install.sh`.** `install.sh` only seeds the manifest. Notes come from a separate `task bootstrap-areas` run (Open question 2).

## Constraints

- **Framework/configuration boundary (CLAUDE.md).** No real vault content and no `*.local.*` file is committed. `20-areas/*` stays gitignored except `README.md`.
- **Public-repo privacy (CLAUDE.md).** No real names, personal area lists, absolute paths, or he/his/him for the operator in any committed file. Prose uses "the operator" and they/them.
- **Runner conventions (CLAUDE.md "Writing runners").** Runners use `set -euo pipefail`, source `scripts/lib/common.sh`, validate input before doing anything, never swallow errors, and never stage with `git add -A` or `git add .`.
- **Seeding pattern.** Reuse `install.sh`'s existing copy-if-absent, never-overwrite seeding behaviour rather than a second mechanism (ADR-0005 driver).
- **Taskfile convention (ADR-0001).** Entry points are thin `task` wrappers around `scripts/*.sh`.
- **Release gate (ADR-0004).** The release smoke test (`task install && task doctor:ci` on a bare runner) must keep passing.
- **Dependency.** The areas bootstrap may require python3 with PyYAML (Open question 4). This is the only new dependency. `install.sh` and `doctor.sh` gain none.
- **Note format (CLAUDE.md).** Generated notes use the standard frontmatter: `name` matching the filename stem, `description`, `type`, `created`, `updated`.

## Requirements

EARS syntax. Each requirement has one acceptance criterion in Given/When/Then form. IDs are never reused; a dropped requirement is struck through, not deleted.

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-001 | The framework shall ship a committed default areas manifest with exactly seven active entries: Health, Finances, Career/Work, Relationships, Personal Growth, Home/Environment, and Recreation. It shall also include Community as a commented-out entry showing how to add an area. | Given a fresh clone, when `control/areas.example.yaml` is parsed, then it yields exactly those seven entries, and the file contains a commented-out Community entry that becomes an eighth valid entry when uncommented. |
| REQ-002 | Each area entry in the areas manifest shall have a unique kebab-case slug and a one-line description. | Given `control/areas.example.yaml`, when each entry is inspected, then each has a slug matching `^[a-z0-9]+(-[a-z0-9]+)*$` that no other entry uses, and a non-empty single-line description. |
| REQ-003 | The committed default areas manifest shall explain its own schema and its customize-locally workflow in comments, following `estate.example.yaml`'s document-by-example convention. | Given `control/areas.example.yaml`, when it is read with no other docs, then its comments say what each field means, that the file is copied to `control/areas.local.yaml`, that the local copy is the one to edit, and how to generate notes from it. |
| REQ-004 | The local areas manifest (`control/areas.local.yaml`) shall be excluded from version control. | Given a checkout containing `control/areas.local.yaml`, when `git check-ignore control/areas.local.yaml` is run, then it exits 0. |
| REQ-005 | When `install.sh` runs and no local areas manifest exists, `install.sh` shall create it as a copy of the default manifest. | Given a clone with no `control/areas.local.yaml`, when `./scripts/install.sh` runs, then `control/areas.local.yaml` exists and matches `control/areas.example.yaml` byte for byte. |
| REQ-006 | If a local areas manifest already exists when `install.sh` runs, then `install.sh` shall leave it unmodified. | Given an edited `control/areas.local.yaml`, when `./scripts/install.sh` runs, then the file's contents are unchanged and the output reports it was left untouched. |
| REQ-007 | When `install.sh` finishes, it shall tell the operator how to customize the local areas manifest and how to run the areas bootstrap. | Given any run of `./scripts/install.sh`, when it finishes, then its "Next steps" output names `control/areas.local.yaml` and the areas bootstrap command. |
| REQ-008 | When the areas bootstrap runs, it shall create one Area note at `20-areas/<slug>.md` for each entry in the local areas manifest that has no note at that path yet. | Given a local manifest with N valid entries and an empty `20-areas/` apart from its README, when the bootstrap runs, then exactly N files named `20-areas/<slug>.md` exist, one per slug. |
| REQ-009 | Each generated Area note shall carry frontmatter with `name` equal to its slug, `description` equal to its manifest description, `type: area`, and `created` and `updated` set to the generation date (UTC). | Given a generated note for slug `health`, when its frontmatter is parsed, then `name: health`, `description` equals the manifest's entry, `type: area`, and `created` and `updated` both equal the date of the run. |
| REQ-010 | Each generated Area note's body shall invite `[[wikilink]]`s to the `10-projects/` notes that serve the area and to relevant `30-resources/` notes. | Given any generated Area note, when its body is read, then it contains a prompt to link related projects and resources with `[[wikilink]]` syntax. |
| REQ-011 | If an Area note already exists at `20-areas/<slug>.md`, then the areas bootstrap shall leave that file unmodified. | Given `20-areas/health.md` with hand-edited content, when the bootstrap runs with `health` in the manifest, then the file's contents and mtime are unchanged. |
| REQ-012 | When the areas bootstrap is re-run with an unchanged local manifest, it shall create no files, modify no files, and exit 0. | Given a bootstrap run that has already completed, when the bootstrap runs a second time, then no file under `20-areas/` is created or modified and the exit status is 0. |
| REQ-013 | When the areas bootstrap finishes, it shall report which slugs it created and which it skipped because they already existed. | Given a manifest where one slug already has a note and one does not, when the bootstrap runs, then its output lists the first slug as skipped and the second as created. |
| REQ-014 | When the areas bootstrap runs and no local areas manifest exists, it shall first create one from the default manifest with the same copy-if-absent behavior as `install.sh`, then generate notes from it. | Given a clone with no `control/areas.local.yaml`, when the bootstrap runs, then `control/areas.local.yaml` exists and matches the example, and one note per default slug exists. |
| REQ-015 | The areas bootstrap shall generate notes only from the local areas manifest, never from the default manifest directly. | Given a local manifest whose only entry is slug `custom-area`, which the example doesn't contain, when the bootstrap runs, then `20-areas/custom-area.md` is created and no note for any example-only slug is created. |
| REQ-016 | If the local areas manifest fails to parse, or has any entry that is missing a slug, has a slug that isn't kebab-case, repeats another entry's slug, or is missing a description, then the areas bootstrap shall exit non-zero, write no Area notes, and name each offending entry in its error output. | Given a local manifest with two valid entries and one entry whose slug is `../Evil`, when the bootstrap runs, then it exits non-zero, `20-areas/` gains no new files, and the error output names `../Evil`. |
| REQ-017 | If the default areas manifest is absent, then the areas bootstrap shall exit non-zero without creating any file. | Given a checkout with `control/areas.example.yaml` removed and no local manifest, when the bootstrap runs, then it exits non-zero and neither `control/areas.local.yaml` nor any `20-areas/*.md` is created. |
| REQ-018 | The areas bootstrap shall not create, modify, stage, or commit any git-tracked file. | Given a clean working tree, when the bootstrap runs to success, then `git status --porcelain` is still empty and `git log -1` is unchanged. |
| REQ-019 | The framework shall expose the areas bootstrap as a `task` entrypoint. | Given go-task installed, when `task --list` runs, then a `bootstrap-areas` task is listed, and running `task bootstrap-areas` has the same effect as running the bootstrap script directly. |
| REQ-020 | `20-areas/README.md` shall list the slugs defined in the default areas manifest, labelled as the shipped defaults, and state that `control/areas.local.yaml` is the authoritative list for an installed vault. | Given the committed `20-areas/README.md` and `control/areas.example.yaml`, when both are inspected, then the README's slug list equals the example manifest's active slugs, is labelled as the shipped defaults, and the README names `control/areas.local.yaml` as authoritative. |
| REQ-021 | `20-areas/README.md` and `10-projects/README.md` shall each document the linking convention: a project links `[[area-slug]]` to the area(s) it serves, and projects and areas link out to `30-resources/` notes for reusable patterns. | Given both committed READMEs, when each is read, then each contains a paragraph stating both halves of the convention with a `[[area-slug]]` example. |
| REQ-022 | No file committed by this session shall contain the operator's personal area list, operator-specific area names that fall outside the convergent set (any name taken from the operator's own list), references to the operator's local vault notes, or he/his/him used for the operator. | Given the session's final diff against `main`, when it is searched for the operator's personal area names, `\b(he\|his\|him)\b` in prose about the operator, and local vault note filenames, then there are no matches. |
| REQ-023 | The committed research note shall reference issue #9 as its tracking issue. | Given `docs/research/areas-of-life-taxonomy.md`, when its header is read, then its "Tracked in issue" line links issue #9 and has no dangling or placeholder reference. |
| REQ-024 | The committed ADR-0005 shall carry status `proposed` while this session is open, and shall be changed to `accepted` only in the commit that lands the session's implementation for merge. | Given the feature branch's history, when ADR-0005's `status:` is inspected at each commit that touches it, then every commit before the final merge-bound one shows `proposed` and the merge-bound one shows `accepted`. |
| REQ-025 | While the areas manifest files exist, the release smoke test (`task install && task doctor:ci` on a fresh clone) shall continue to pass. | Given a fresh clone on a runner with no local config, when `task install && task doctor:ci` runs, then it exits 0. |
| REQ-026 | If python3 or PyYAML is unavailable, then the areas bootstrap shall exit non-zero before creating any file, with an error naming the missing dependency. | Given an environment where `python3 -c "import yaml"` fails, when the bootstrap runs, then it exits non-zero, no `control/areas.local.yaml` or `20-areas/*.md` is created, and the error output names python3/PyYAML. |
| REQ-027 | If the local areas manifest's entries are identical to the default manifest's entries, and `20-areas/` already contains a note other than `README.md` whose name matches no manifest slug, then the areas bootstrap shall exit non-zero before creating any file, name those notes, and tell the operator to edit `control/areas.local.yaml` first. | Given an unedited `control/areas.local.yaml` and a hand-written `20-areas/health-and-fitness.md`, when the bootstrap runs, then it exits non-zero, no `20-areas/*.md` is created, and the output names `health-and-fitness.md` and `control/areas.local.yaml`. |

## Open questions

All questions resolved. On 2026-09-27 the operator confirmed each proposed default:

1. **Areas checks in `doctor.sh`:** none, and the areas manifest gets no schema `version:` (see Non-goals).
2. **`install.sh` generating notes:** no. `install.sh` only seeds the manifest (REQ-005), and notes come from `task bootstrap-areas` (REQ-014, REQ-019).
3. **Slug list in `20-areas/README.md`:** kept, labelled as the shipped defaults, with `areas.local.yaml` named as authoritative (REQ-020).
4. **YAML parsing:** the bootstrap requires python3+PyYAML and fails clearly without it (REQ-026, Constraints).
5. **ADR-0005 status:** `proposed` until the commit that lands the work, then `accepted` (REQ-024).
6. **Default areas:** seven active, with Community commented out (REQ-001).
7. **Existing installs with hand-written area notes** (added 2026-09-27, after Design): the bootstrap refuses to add the generic defaults next to notes the manifest doesn't list, until the operator edits the manifest (REQ-027).

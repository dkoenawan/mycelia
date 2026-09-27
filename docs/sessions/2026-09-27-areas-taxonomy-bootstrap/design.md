# Design: Default areas taxonomy + bootstrap

> Phase: Design | Started: 2026-09-27 | Status: Draft
> Requirements: [`requirements.md`](requirements.md) · Session history: [`log.md`](log.md)

## Approach

Follow the existing `estate.example.yaml` → `estate.local.yaml` pattern. A committed `control/areas.example.yaml` holds seven generic areas and documents its own schema in comments. `install.sh` seeds a gitignored `control/areas.local.yaml` from it using the same `seed_local()` it already uses for roots and estate. That function moves from `install.sh` into `scripts/lib/common.sh` so both runners share one seeding path. A new runner, `scripts/bootstrap-areas.sh`, is the only thing that turns the local manifest into notes. It is a thin bash shell (preflight checks, seeding, exit handling) around one embedded python3+PyYAML block that validates the whole manifest and then creates notes create-exclusive. `doctor.sh` and `release.yml` are not changed, and `install.sh` gains only a `cp`, so the release smoke test needs nothing new (REQ-025).

Alternatives considered:
- **bootstrap calls `install.sh`.** Rejected: it would also seed roots and estate, a side effect REQ-014 doesn't ask for.
- **bootstrap sources `install.sh`.** Rejected: `install.sh` runs its work at source time.
- **Duplicating `seed_local` in the new script.** Rejected: it breaks the "Seeding pattern" constraint.
- **Pure-bash YAML parsing.** Rejected: settled by Open question 4, PyYAML is required.
- **Writing notes from bash heredocs, as `inbox_note` does.** Rejected: an unquoted description containing `: ` or a leading `#` would produce frontmatter that doesn't round-trip, which breaks REQ-009.

## Components / layers

| ID | Component / layer | Covers | Notes |
|---|---|---|---|
| DES-001 | `control/areas.example.yaml`: default manifest content and schema | REQ-001, REQ-002, REQ-003 | Seven active entries plus Community commented out. Comments document the schema. See §DES-001. |
| DES-002 | `seed_local()` moved into `scripts/lib/common.sh` | REQ-005, REQ-006, REQ-014, REQ-017 (Constraint: seeding pattern) | Same copy-if-absent, never-overwrite behaviour. Adds a missing-example guard. See §DES-002. |
| DES-003 | `install.sh`: seeds the areas manifest; new Next-steps text | REQ-005, REQ-006, REQ-007, REQ-025 | One extra `seed_local` call and rewritten Next steps. No new dependency. See §DES-003. |
| DES-004 | `scripts/bootstrap-areas.sh`: bash shell | REQ-012, REQ-014, REQ-015, REQ-017, REQ-018, REQ-026 | Arg check, example check, dependency check, git-ignore guard, validate-then-seed, invoke generator, exit handling. See §DES-004. |
| DES-005 | Embedded manifest validator + note generator (python3+PyYAML heredoc in DES-004) | REQ-008, REQ-009, REQ-011, REQ-012, REQ-013, REQ-015, REQ-016 | Validates every entry before any write. Creates notes create-exclusive (`open(..., "x")`). Reports created and skipped slugs. See §DES-005. |
| DES-006 | Generated Area note template | REQ-009, REQ-010 | Standard frontmatter plus a body that prompts for project and resource links. See §DES-006. |
| DES-007 | `Taskfile.yml`: `bootstrap-areas` task | REQ-019 | Thin wrapper, as ADR-0001 requires. See §DES-007. |
| DES-008 | `.gitignore` coverage (no change) | REQ-004, REQ-018 | The existing `control/*.local.yaml` and `20-areas/*` rules already cover every file the bootstrap writes. See §DES-008. |
| DES-009 | `20-areas/README.md`: slug list and linking convention | REQ-020, REQ-021 | See §DES-009. |
| DES-010 | `10-projects/README.md`: linking convention | REQ-021 | See §DES-010. |
| DES-011 | ADR-0005 public-repo cleanup and status lifecycle | REQ-022, REQ-024 | Concrete edits in §DES-011. |
| DES-012 | Research note cleanup | REQ-022, REQ-023 | Concrete edits in §DES-012. |
| DES-013 | Release-CI compatibility (no change to `release.yml` / `doctor.sh`) | REQ-025 | See §DES-013. |
| DES-014 | Stale-defaults guard in the embedded validator (added after Design, see log) | REQ-027 | Runs after validation, before any write. See §DES-014. |

### DES-001: `control/areas.example.yaml`

Schema: a top-level mapping with exactly one key, `areas`, whose value is a list of mappings. Each mapping has exactly two keys:

- `slug`: a string matching `^[a-z0-9]+(-[a-z0-9]+)*$`, unique within the file.
- `description`: a non-empty, single-line string.

There is no `version:` and no `updated:` (operator decision, Open question 1).

Active entries, in this order (the README list in DES-009 uses the same order):

| Area (REQ-001) | slug | description |
|---|---|---|
| Health | `health` | Physical and mental health — sleep, fitness, nutrition, medical care. |
| Finances | `finances` | Money in and out — budgeting, saving, investing, taxes, insurance. |
| Career/Work | `career` | Work and professional development — current role, skills, next moves. |
| Relationships | `relationships` | Partner, family, and friends — the people you keep up with deliberately. |
| Personal Growth | `personal-growth` | Learning and self-development — reading, courses, habits, reflection. |
| Home/Environment | `home-environment` | Where you live and what you own — upkeep, household admin, moves. |
| Recreation | `recreation` | Fun and rest — hobbies, play, time off. |
| Community (commented out) | `community` | Contribution beyond your own circle — volunteering, local groups, open source. |

Slug choices:
- **`career`, not `career-work`**, because it is the shorter link target.
- **`home-environment`, not `home`.** `[[home]]` would collide with the `Home.md` dashboard note that many Obsidian vaults keep, and a wikilink resolves by note name across the whole vault.

No description contains `: ` or a leading YAML indicator, so every description stays a plain scalar.

The file layout follows `estate.example.yaml`'s document-by-example header style. The header comment covers the following (REQ-003):
1. What an Area is, in one line: ongoing responsibility with no finish line.
2. The workflow:
   - `install.sh` copies this file to `control/areas.local.yaml`, and so does `task bootstrap-areas` if that file is missing.
   - Edit the local copy, never this file.
   - Run `task bootstrap-areas`, or `./scripts/bootstrap-areas.sh`.
   - The bootstrap needs python3 with PyYAML.
3. What each field means:
   - `slug` becomes the filename `20-areas/<slug>.md` and the `[[<slug>]]` link target. It must be kebab-case and unique.
   - `description` becomes the note's frontmatter `description`. It is one line.
4. Re-run semantics:
   - The bootstrap only creates notes that don't exist yet. It never edits one.
   - Renaming or removing an entry doesn't rename or delete its note. Do that by hand.
   - A bad entry stops the run before any note is written.

The Community block sits as the last item of the list:

```yaml
  # Community ships commented out. To add it, or any area of your own, delete
  # the "# " after the indent on both lines below, then re-run the bootstrap.
  # - slug: community
  #   description: Contribution beyond your own circle — volunteering, local groups, open source.
```

Removing `# ` from those two lines leaves `  - slug: community` and `    description: ...`, which is valid YAML at the right indent (REQ-001 acceptance).

### DES-002: `seed_local()` in `scripts/lib/common.sh`

Move the function verbatim out of `install.sh` into a new `# --- Config seeding ---` section of `common.sh`, with two changes:

1. **Guard on the example file.** Add `[[ -f "$example" ]] || die "$(basename "$example") not found under control/ — is this a complete mycelia checkout?"` as the first line. Without this, a missing example surfaces as a raw `cp` error under `set -e`.
2. **Neutral created-message.** It becomes `Created <local> from <example>.` The old suffix, "edit it before running 'task doctor'", is wrong for the areas manifest, and the Next-steps block already carries that guidance.

The "Already present, left untouched: …" message stays as it is, which satisfies REQ-006's "reports it was left untouched".

The copy stays a plain `cp`, so the local file is byte-identical to the example (REQ-005, REQ-014).

### DES-003: `install.sh`

- Delete the local `seed_local` definition. It now comes from `common.sh`, which `install.sh` already sources.
- Add a third call after the existing two: `seed_local "$MYCELIA_CONTROL/areas.example.yaml" "$MYCELIA_CONTROL/areas.local.yaml"`.
- Replace the Next-steps block (REQ-007):

```
Next steps:
  1. Edit control/roots.local.yaml  — set home/repos/logs paths and repo aliases for this machine.
  2. Edit control/estate.local.yaml — describe your own scheduled jobs (or leave the jobs list empty).
  3. Run 'task doctor' (or ./scripts/doctor.sh) to verify the install.
  4. Edit control/areas.local.yaml  — list the areas of your life (slug + one-line description), or keep the defaults.
  5. Run 'task bootstrap-areas' (or ./scripts/bootstrap-areas.sh) to create one 20-areas/ note per area. Needs python3 + PyYAML.
  6. Open this directory as a vault in Obsidian if you want the GUI — it's just a folder of Markdown.
```

`doctor` stays at step 3 because it is the install gate. The areas steps are optional content, so they come after it.

### DES-004: `scripts/bootstrap-areas.sh` (bash shell)

The header comment follows `install.sh`'s style: purpose, create-only semantics, the python3+PyYAML requirement, usage, and "Also invoked as `task bootstrap-areas`". The script runs these steps in order. No step creates a file until every earlier check has passed.

1. **Setup.** `set -euo pipefail`, then resolve `SCRIPT_DIR`, then `source "$SCRIPT_DIR/lib/common.sh"`.
2. **Arguments.** The script takes none. Any argument causes `die "usage: bootstrap-areas.sh (takes no arguments)"`.
3. **Example present (REQ-017).** `[[ -f "$MYCELIA_CONTROL/areas.example.yaml" ]] || die ...`. This check runs unconditionally, even when a local manifest exists. REQ-017 is worded unconditionally, and a missing example means the checkout itself is broken.
4. **Dependencies (REQ-026).** Each missing dependency gets its own message:
   - `command -v python3` fails → `die "python3 not found on PATH — bootstrap-areas needs python3 with PyYAML."`
   - `python3 -c 'import yaml'` fails → `die "python3 found but PyYAML is not installed — install it (pip install pyyaml, or your OS package, e.g. python3-yaml) and re-run."`
5. **Git-tracked-file guard (REQ-018, defence in depth).** This runs only if `git -C "$MYCELIA_ROOT" rev-parse --is-inside-work-tree` succeeds. It then requires both of the following to exit 0, otherwise it dies naming the path:
   - `git check-ignore -q control/areas.local.yaml`
   - `git check-ignore -q 20-areas/bootstrap-probe.md`

   `check-ignore` works on paths that don't exist. This catches a future `.gitignore` regression before the script writes a file git would track. Outside a git work tree nothing can be tracked, so the guard is skipped. The script never runs `git add`, `git commit`, or `git checkout`.
6. **Pick the source and validate it before writing anything.**
   - `SOURCE` is `areas.local.yaml` if it exists, otherwise `areas.example.yaml`.
   - Run the DES-005 generator in `--check` mode against `SOURCE`. If it fails, `die "control/<file> is invalid — no notes written."` after its per-entry errors.
   - Because the example is validated before it is copied, a bad example can't leave a seeded local file behind.
7. **Seed (REQ-014).** `seed_local areas.example.yaml areas.local.yaml`. This is a no-op with the "left untouched" message when the local file already exists.
8. **Generate (REQ-015).** Run the DES-005 generator in `--write` mode against `$MYCELIA_CONTROL/areas.local.yaml`, always the local path. It receives the date from `date -u '+%Y-%m-%d'` (UTC, the same as `common.sh`) and the target directory `$MYCELIA_ROOT/20-areas`. It re-validates, which is cheap and covers the file changing between steps 6 and 8.
9. **Exit.** Propagate failure with `if ! python3 - ... ; then die "..."; fi`, so a failure goes through `die` instead of dying silently under `-e`. On success, finish with the DES-005 summary and exit 0.

The generator is one quoted heredoc (`<<'PYEOF'`) inside `bootstrap-areas.sh`, invoked as `python3 - <mode> <manifest> [<date> <areas-dir>]`. This is the same embedding style `doctor.sh` check 7 uses. There is no separate `.py` file, so the "generation template" ADR-0005 refers to stays in one runner.

Exit codes: `0` on success, including a run that created nothing. `1` on every failure: usage, missing example, missing dependency, guard failure, invalid manifest, write error. This matches `die`. REQ-016 and REQ-026 only require non-zero, and cron and `task` distinguish nothing finer.

### DES-005: Validator and generator (embedded python)

**Validation** runs in both modes. It collects every error before exiting, so one run names every offending entry (REQ-016).

- The file must parse with `yaml.safe_load`. A parse error prints the file and the PyYAML message (line and column) and fails.
- Top level:
  - Must be a mapping whose only key is `areas`. Unknown top-level keys are an error.
  - `areas` must be a list. An empty list is valid: the run prints a warning and creates nothing.
- Each entry `i` (1-based):
  - Must be a mapping with only `slug` and `description`. An unknown key is an error that names the key, which catches typos such as `descripton`.
  - `slug` must be present and a `str`. A non-string such as `2024` is an error that suggests quoting.
  - `slug` must match the kebab regex.
  - `slug` must not repeat an earlier entry's slug. The error names both entry numbers.
  - `description` must be present and a `str`, non-empty after `strip()`, and contain no `\n` or `\r`. A folded `>-` scalar that resolves to one line is fine.
- Error format goes to stderr, one line per problem, and always names the entry by index and by `repr()` of the slug when one exists:
  `ERROR: control/areas.local.yaml entry 3 (slug '../Evil'): slug is not kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$)`
- On any error, exit 1. In `--write` mode this happens before any `open()`, so no note is written.

**Writing** happens only in `--write` mode, after validation passes. For each entry in manifest order:
- Let `path = <areas-dir>/<slug>.md`.
- Try `open(path, "x", encoding="utf-8")`. This is an atomic create-if-absent.
  - On `FileExistsError`, record the slug as **skipped**. The file is never opened for writing, so its contents and mtime are unchanged (REQ-011, REQ-012).
  - Otherwise write the DES-006 template and record the slug as **created** (REQ-008).
- If a write raises after the file was created, remove that one partial file (the run created it moments before, so the script owns it) and re-raise. A re-run then retries it instead of skipping a truncated note.
- Only kebab-validated slugs reach `path`, so a slug can't escape `20-areas/` (the `../Evil` case) or land on `README.md`.

**Report (REQ-013).** Per-slug lines go to stdout, because they are the run's real output; `common.sh` logging stays on stderr:

```
created  20-areas/health.md
skipped  20-areas/finances.md (already exists)
```

After those lines comes one summary line: `Areas bootstrap: 6 created, 1 skipped (from control/areas.local.yaml).` Paths are repo-relative, so no absolute path appears in output that might be pasted anywhere.

### DES-006: Generated note template

```markdown
---
name: <slug>
description: <description>
type: area
created: <YYYY-MM-DD, UTC>
updated: <YYYY-MM-DD, UTC>
---

Projects that serve this area — link each one here as a wikilink, e.g. `[[project-slug]]`,
and link back to this area from the project note with `[[<slug>]]`:

-

Resources with reusable patterns for this area — link each `30-resources/` note, e.g.
`[[resource-slug]]`:

-
```

- **Frontmatter serialisation.** Each line is emitted with `yaml.safe_dump({key: value}, allow_unicode=True, width=float("inf"), default_flow_style=False)`.
  - Plain descriptions stay plain.
  - Descriptions that need quoting are quoted.
  - Parsing the note back yields exactly the manifest string (REQ-009).
  - `width=inf` keeps each value on one line.
  - Dates are emitted as bare `YYYY-MM-DD`, matching `append_daily` / `inbox_note`.
- **No H1.** Obsidian titles the note from its filename, and the manifest has no display-name field. Adding one is a non-goal.
- **Example links are code spans.** A literal `[[project-slug]]` in seven notes would create a dangling "project-slug" node in every vault's graph. The one live link is `[[<slug>]]`, which links the note to itself. That self-link is harmless and shows the reader the exact link target to use from project notes.

### DES-007: `Taskfile.yml`

Insert this directly after `install`:

```yaml
  bootstrap-areas:
    desc: Create one 20-areas/ note per entry in control/areas.local.yaml (seeds it from the example if absent; never edits existing notes; needs python3+PyYAML).
    cmds:
      - bash scripts/bootstrap-areas.sh
```

Invoking the script as `bash scripts/…` matches the existing tasks, so the executable bit isn't load-bearing. Still set it (`chmod +x`, committed as mode 100755) to match the other scripts. Check with `git ls-files -s scripts/`.

### DES-008: `.gitignore`

No change. The existing rules already cover:
- `control/areas.local.yaml`, through `control/*.local.yaml` (REQ-004).
- Every generated note, through `20-areas/*`. Only `README.md` is negated.

The generator creates no temp files. The DES-004 step-5 guard turns any future regression of these rules into a hard failure instead of tracked output.

### DES-009: `20-areas/README.md`

- Keep the existing body.
- Bump `updated:` to the landing date.
- Append two sections.

**`## Default areas`**
- Opening sentence: "The shipped defaults, from `control/areas.example.yaml`:"
- The seven active slugs as a bulleted list of code spans, in DES-001 order. They are code spans, not `[[links]]`: live links in a committed README would dangle on a fresh clone.
- A closing paragraph saying:
  - `control/areas.local.yaml` is the authoritative list for an installed vault.
  - Edit it, then run `task bootstrap-areas` to create any missing notes.
  - Existing notes are never edited, so renames and removals are done by hand.
  - Before creating a new area, check the local manifest so an area isn't invented twice.

**`## Linking`**
- A project links to each area it serves with `[[area-slug]]`, e.g. `` `[[health]]` ``, in its body or frontmatter.
- Projects and areas both link out to `30-resources/` notes for reusable patterns.
- The convention is documented, not enforced (ADR-0005).

### DES-010: `10-projects/README.md`

Bump `updated:` and append a `## Linking` paragraph with the same two halves:
- Link the area(s) the project serves as `[[area-slug]]`, e.g. `` `[[home-environment]]` `` for a renovation project.
- When the project yields a reusable pattern, write it to a `30-resources/` note and link it from the project. Areas link to the same resources.
- A pointer to `20-areas/README.md` for the slug list.

Example links are code spans for the same dangling-link reason as in DES-009.

### DES-011: ADR-0005 cleanup and status

Edits to `docs/adr/0005-default-areas-taxonomy-and-bootstrap.md`, applied before it is first committed:

- **Frontmatter**
  - `status: proposed`.
  - `date:` becomes the date of the landing commit (the decision date), set in the same commit that flips the status.
- **Context ¶1**
  - Replace "an actual working set of 9 areas (style, … finance) and wants two things at once: his own instance populated, and … tied to his 9 names" with wording that names no areas: "a working set of their own areas and wants two things at once: their own instance populated, and the mechanism that does it reusable by any installer for their own taxonomy — not a one-off script tied to one person's list."
  - Add "Tracked in [issue #9](https://github.com/dkoenawan/mycelia/issues/9)." This follows the issue-link precedent in ADR-0002 and ADR-0004.
- **Context, second precedent bullet.** Drop the `10-projects/mycelia-as-foundation.md` sentence. Replace it with "no PARA directory has ever committed a note as an exception to its gitignore rule."
- **Decision Drivers, third bullet.** Rewrite in they/them without the count: "The operator needs their own areas populated in their real vault; the framework needs a generic, install-anywhere default that isn't one person's list in disguise."
- **Considered Options, row 4.**
  - Title: "Commit the operator's own areas as the framework default."
  - Cons: drop "his personal taxonomy (style, golf, travel)" and use "one person's taxonomy".
- **Decision Outcome, lead paragraph.** Change "via the existing `seed_local()` pattern in `install.sh`" to "via `seed_local()`, moved from `install.sh` into `scripts/lib/common.sh` so both runners share one seeding path".
- **"Generic framework default" bullet.** Change "the convergent 6-8 category set … and Community as an optional 8th" to: seven active entries (Health, Finances, Career/Work, Relationships, Personal Growth, Home/Environment, Recreation), with Community shipped commented out as the worked example of adding an area.
- **"Operator's real instance" bullet.** Rewrite to name no areas and use they/them:
  - The operator's own areas go into their gitignored `control/areas.local.yaml`, by editing the seeded copy and running `task bootstrap-areas`.
  - Areas outside the convergent set are valid precisely because Areas are personal.
  - Delete the Style/Travel sentence.
- **"Downstream" bullet.** Change "generic 6-8 default" to "seven-area default". Replace "edit `areas.local.yaml`, rerun" with "edit `areas.local.yaml`, run `task bootstrap-areas` again — it creates missing notes and never edits existing ones".
- **"Note format" bullet**
  - Drop the stray word "yearly".
  - Say the body's example links are code spans, and that the only live link is the self-link.
- **"Index" bullet.** Change "checklist section listing the canonical area slugs" to "a list of the shipped default slugs from `control/areas.example.yaml`, labelled as defaults; `control/areas.local.yaml` is authoritative for an installed vault".
- **New bullets to add**
  - **Dependency.** The bootstrap requires python3+PyYAML and fails before writing anything if either is missing. `install.sh` and `doctor.sh` gain no dependency, so the ADR-0004 release smoke test is unaffected.
  - **Create-only.** Notes are created, never updated. Renames, description edits, and deletions are manual.
  - **Unversioned manifest.** There is no `doctor.sh` areas check, and the areas manifest has no `version:`. This reconciles with ADR-0002, whose version/UPGRADE rule is written for `control/*.example.yaml` in general. The areas manifest is read only by an on-demand, create-only generator that fails loudly and names the entry on any shape it doesn't expect. So the silent-drift risk the version gate exists to catch doesn't arise. The first schema-breaking change to the areas manifest adds `version:` and an UPGRADE doc under ADR-0002.
- **Consequences**
  - Change "his real 9 areas without hand authoring 9 frontmatter blocks" to "their own areas without hand-authoring each frontmatter block".
  - Rewrite the last constraint in present tense: `install.sh` seeds the areas manifest alongside roots and estate.
- **Revisit Conditions.** Keep both. Add: "If `areas.local.yaml` needs a breaking schema change, add `version:` per ADR-0002."

After editing, both files must pass a final check before they are committed:
- `grep -nEi '\b(he|his|him)\b'` finds nothing about the operator.
- `grep -nEi 'golf|style|travel|mycelia-as-foundation|9 areas'` finds nothing that refers to the operator.

**Status lifecycle (REQ-024).** Every commit that touches ADR-0005 shows `proposed`, except the final merge-bound commit. That commit flips it to `accepted` and sets `date:`, and it happens only after Test has passed. It is the last task (T8 below), and nothing touches ADR-0005 after it.

### DES-012: Research note cleanup

Edits to `docs/research/areas-of-life-taxonomy.md`:

- **Lines 3–4** become: "Supports `docs/adr/0005-…`. Tracked in [issue #9](https://github.com/dkoenawan/mycelia/issues/9): `20-areas/` is empty on a fresh clone, with no default taxonomy and no bootstrap mechanism." (REQ-023)
- **Question 2(b), lines 14–17.** Replace the parenthesised personal list with "since the operator's own list is one instance among many an installer might want".
- **Convergence paragraph, lines 75–84.** Replace everything from "The operator's own 9-area list…" to "…every operator-specific facet." with a generic statement that names no areas:
  - An individual's list typically maps onto the convergent set plus a few narrower facets that no source converges on.
  - That isn't a taxonomy error, since Forte and GTD both expect Areas to be personal.
  - It is why the framework default stays at the convergent core.
- **"Mechanism precedent" bullet 2.** Replace the `mycelia-as-foundation.md` clause with "every file under the PARA directories other than `README.md` is untracked".
- **"Implication" paragraph.** Change "turns either the generic default or an operator-edited local manifest into…" to "turns the local manifest (seeded from the generic default) into…". This matches REQ-015.
- **Leave alone.** Forte's own example "(home, travel)" at line 33 is a third-party example, not the operator's area list. Test should read the REQ-022 grep hit there as expected.

### DES-013: Release CI (REQ-025)

`release.yml` and `doctor.sh` are unchanged:
- `task install` now also copies `areas.local.yaml` with plain `cp`, so it needs no python.
- `doctor:ci` doesn't read either areas file.
- The bootstrap isn't part of the smoke test, so a bare runner without PyYAML still passes.

Test should verify REQ-025 in a fresh clone with PyYAML made unavailable, for example with a `PATH` stub `python3` that fails `import yaml`, so that nothing implicitly depends on it.

### DES-014: Stale-defaults guard (REQ-027)

Added 2026-09-27 after the Design milestone, by logged decision.

Runs inside the DES-005 generator, after the manifest validates and before any note is written (in both `--check` and `--write` modes):

1. Parse the local manifest and the example. The manifest is **unedited** when their `areas` entry lists are equal after parsing (same slugs and descriptions, same order). Comments and whitespace don't count, so a cosmetic edit doesn't clear the guard, but any change to the entries does.
2. List `20-areas/*.md`, excluding `README.md`. A note is **unmatched** when its filename stem is not a manifest slug.
3. If the manifest is unedited **and** there is at least one unmatched note, fail: exit 1, write nothing, and print on stderr the unmatched note names (repo-relative) and the fix: edit `control/areas.local.yaml` to list your own areas, including the slugs of the notes you already have, then re-run.
4. Otherwise continue as before.

This also covers the case where the bootstrap seeded `areas.local.yaml` itself in this run (REQ-014): a freshly seeded manifest is unedited by definition. There is no override flag, because DES-004 rejects every argument; listing the existing notes' slugs clears the guard, which is also the fix.

## Decisions

| # | Decision | Notes |
|---|---|---|
| D1 | Move `seed_local()` into `scripts/lib/common.sh`, used by both `install.sh` and the bootstrap. | This is the only way to reuse it without duplicating it (Constraint) and without running `install.sh`'s other side effects. It is an additive helper, covered by ADR-0005 (DES-011 edits the ADR to say so). |
| D2 | The bootstrap is a bash shell around one embedded python3+PyYAML heredoc that owns validation, rendering, and create-exclusive writes. | This follows `doctor.sh` check 7's precedent. Python is needed anyway for PyYAML, and it gives correct YAML scalar quoting (REQ-009) and an atomic `open("x")` create-if-absent (REQ-011). |
| D3 | Validate the would-be source (local, or the example when local is absent) before seeding, then re-validate at generation. | This guarantees "no file on any failure" (REQ-016, REQ-017, REQ-026) even when the example itself is bad. |
| D4 | Check for the example unconditionally, even when a local manifest exists. | REQ-017 is worded unconditionally, and a missing example means a broken checkout. |
| D5 | Reject unknown keys at both the top level and entry level. | This goes beyond REQ-016's list. It catches typos, and it stops the per-area-template fields that are a non-goal from appearing to work silently. |
| D6 | Add a `git check-ignore` guard before any write, and invoke no git mutation at all. | This is defence in depth for REQ-018 against a future `.gitignore` regression. It is skipped outside a git work tree. |
| D7 | Exit codes: `0` for success (including all-skipped), `1` for every failure. Per-slug report on stdout, logs and errors on stderr. | This matches `die` and the `common.sh` stdout/stderr convention. |
| D8 | Slugs: `health`, `finances`, `career`, `relationships`, `personal-growth`, `home-environment`, `recreation`, with `community` commented out. | Short link targets. `home` is avoided because it collides with common `Home.md` dashboards. The slugs can be adjusted at the Design gate. |
| D9 | Example wikilinks in generated notes and READMEs are code spans. | Avoids dangling nodes in every vault's graph. REQ-010 and REQ-021 still see `[[…]]` syntax. |
| D10 | No change to `.gitignore`, `doctor.sh`, or `release.yml`. | Already covered (REQ-004), or a declined non-goal (no doctor check), or required to stay unchanged (REQ-025). |
| D11 | The areas manifest is unversioned, and ADR-0005 records the reconciliation with ADR-0002. | The operator declined `version:`. ADR-0002's wording covers all `control/*.example.yaml`, so the exception is written down, not left implicit. |
| D12 | ADR-0005 flips to `accepted`, and its `date:` is set, only in the final merge-bound commit after Test passes. | REQ-024. |
| D13 | The root `README.md` Install section, which still shows manual `cp`, is left as is. | No REQ covers it. It is recorded as a possible follow-up issue, not scope creep. |
| D14 | The bootstrap refuses to run on unedited default entries when `20-areas/` has notes the manifest doesn't list. No override flag. | REQ-027. Stops existing installs getting generic default notes next to hand-written ones. Editing the manifest is both the fix and the override. |

## Risks

| Risk | Mitigation |
|---|---|
| On Windows (Git Bash) the interpreter is often `python` or `py`, not `python3`, so the bootstrap fails there. | REQ-026 already requires python3. The error message names python3 and PyYAML explicitly. If Windows installers report it, revisit with an interpreter override. |
| On a case-insensitive filesystem (macOS default), a slug `readme` would map to the tracked `README.md`. | `open("x")` finds the existing file and skips it, so nothing is modified (REQ-011, REQ-018). The report shows it as skipped, which is odd but safe. |
| A write fails mid-run (for example, disk full), leaving some notes created. | The partial file for the failing slug is removed. The run exits 1, and a re-run creates the rest (REQ-012 idempotence). |
| The note template drifts from CLAUDE.md's frontmatter format. | ADR-0005's "New constraints" already requires updating the template alongside any format change, and the template lives in exactly one place (DES-005). |
| The README slug list drifts from `areas.example.yaml`. | Both files are edited in the same change. REQ-020's acceptance compares them. Test should script that comparison. |
| The issue URL in ADR-0005 and the research note includes the repo owner's GitHub handle. | This matches the precedent already committed in ADR-0002 and ADR-0004. REQ-023 requires a link. |
| REQ-022 greps false-positive on generic words (for example, Forte's "travel" example). | DES-012 lists the one expected hit so Test can read it as not about the operator. |

### Landing order (for Implement to decompose into tasks)

Each task below is one commit.

1. **T1 — ADR-0005 and research cleanup** (DES-011 minus the status flip, DES-012). Both files are committed for the first time here, with `status: proposed`. Nothing depends on this task, and landing it first means later commits can cite the ADR.
2. **T2 — Move `seed_local` into `common.sh`** (DES-002, plus removing the local definition from `install.sh`). This must not change behaviour for roots and estate. Gate: `task install` in a scratch clone, then `task doctor:ci`.
3. **T3 — `control/areas.example.yaml`** (DES-001).
4. **T4 — `install.sh` seeds areas and prints the new Next steps** (DES-003). Depends on T2 and T3.
5. **T5 — `scripts/bootstrap-areas.sh`** (DES-004, DES-005, DES-006). Depends on T2 and T3.
6. **T6 — Taskfile `bootstrap-areas`** (DES-007). Depends on T5.
7. **T7 — `20-areas/README.md` and `10-projects/README.md`** (DES-009, DES-010). Depends on T3 for the slugs.
9. **T9 — Stale-defaults guard** (DES-014, added after Design). Depends on T5. Lands before T8.
8. **T8 — Accept ADR-0005** (DES-011 status flip and `date:`). This is the merge-bound commit, done only after Test passes.

## Open questions

All questions resolved. The slug spellings in D8 are a design choice the operator can adjust at the Design gate. They don't block the design.

---
id: "005"
title: Default areas-of-life taxonomy, shipped as an example manifest and a bootstrap script
date: 2026-08-22
status: proposed
deciders: [operator]
---

## Context

`20-areas/` ships with only a `README.md` — every other file under it is gitignored,
matching the framework/configuration boundary CLAUDE.md sets for all PARA
directories. That means a fresh clone has no starting Areas at all, and there is no
documented default taxonomy or bootstrap path for one. This was fine while the vault
had no real usage pattern to generalize from; it stops being fine now that the
operator has a working set of their own areas and wants two things at once: their
own instance populated, and the mechanism that does it reusable by any installer for
their own taxonomy — not a one-off script tied to one person's list. Tracked in
[issue #9](https://github.com/dkoenawan/mycelia/issues/9).

Full survey of canonical "areas of life" taxonomies (PARA, Wheel of Life, GTD
Horizons of Focus, PKM tooling defaults) lives in
`docs/research/areas-of-life-taxonomy.md`. This ADR records the decision that
research converged on.

Two mechanisms already exist in this repo that are directly relevant precedent:

- `control/estate.example.yaml` → `control/estate.local.yaml`, seeded by
  `scripts/install.sh`'s idempotent `seed_local()` (copy-if-absent, never overwrite).
- `20-areas/*` gitignored except `README.md` — confirmed during this investigation
  to have no exception precedent; no PARA directory has ever committed a note as an
  exception to its gitignore rule.

## Decision Drivers

- Areas are inherently personal — every source surveyed (PARA, Wheel of Life, GTD,
  PKM tooling) treats a fixed areas list as something to override, never as a
  schema to conform to. The mechanism must make overriding trivial, not just
  possible.
- No PARA directory has ever committed real vault content as an exception to its
  gitignore rule; introducing one now for `20-areas/*.md` would break a boundary
  CLAUDE.md treats as load-bearing, for no benefit the manifest+script shape
  doesn't already provide.
- The operator needs their own areas populated in their real vault; the framework
  needs a generic, install-anywhere default that isn't one person's list in
  disguise.
- Reuse over invention: `install.sh`'s seed-local pattern already solves "commit a
  generic default, let the operator customize a local copy, never overwrite it."
  A second, different mechanism for areas would be unjustified complexity.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Committed `control/areas.example.yaml` manifest + `scripts/bootstrap-areas.sh` generator, seeded to `control/areas.local.yaml` (chosen)** | Reuses `install.sh`'s proven seed-local shape exactly; generic default and operator's real list both flow through the same mechanism; generated notes stay local content, consistent with the existing `20-areas/*` gitignore rule; customization is "edit a YAML list," the lowest-friction option surveyed | One more `control/*.example.yaml` file to keep in sync with the note-frontmatter format if that format changes | — chosen |
| Commit N example `.md` note files directly under `20-areas/`, via gitignore exceptions | Concrete, literally copy-pasteable | No precedent anywhere in this repo for committing real-shaped vault content; breaks the framework/configuration boundary CLAUDE.md establishes for every PARA dir; doesn't solve customization — an installer copying and renaming 8 files by hand is worse UX than editing one list | Rejected — wrong side of the boundary this repo has drawn everywhere else |
| README-only guidance, no generator, no manifest | Zero new code | Doesn't solve the actual ask — operator explicitly wants a script, and "read the README and create 8 files by hand" is exactly the toil mycelia's one rule exists to remove | Rejected — non-solution to a stated requirement |
| Commit the operator's own areas as the framework default | Operator's vault gets populated for free | Commits one person's taxonomy into the public framework as if it were canonical; contradicts every source surveyed, which agree there's no one true default; a different installer inherits someone else's life, not a generic template | Rejected — conflates configuration with framework, the exact anti-pattern the CLAUDE.md boundary section warns against |

## Decision Outcome

Chosen option: **a committed `control/areas.example.yaml` manifest carrying the
generic convergent default, plus `scripts/bootstrap-areas.sh` that seeds
`control/areas.local.yaml` from it (via `seed_local()`, moved from `install.sh`
into `scripts/lib/common.sh` so both runners share one seeding path) and generates
one `20-areas/<slug>.md` note per manifest entry — skipping any note that already
exists, so re-running after edits is always safe.**

- **Generic framework default (committed, in `control/areas.example.yaml`):** seven
  active entries — Health, Finances, Career/Work, Relationships, Personal Growth,
  Home/Environment, Recreation — with Community shipped commented out as the worked
  example of adding an area. Each entry carries a generic description, matching
  `estate.example.yaml`'s convention of documenting the schema by example rather
  than by prose spec.
- **Operator's real instance:** the operator's own areas go into their gitignored
  `control/areas.local.yaml`, by editing the seeded copy and running
  `task bootstrap-areas`. Areas outside the convergent set are valid precisely
  *because* Areas are personal — the framework default doesn't need to anticipate
  every operator's shape, only give a sane, edit-first starting point.
- **Downstream for other installers:** any fresh clone gets the seven-area default
  the moment they run the bootstrap script, and can diverge from it the same way
  the operator does — edit `areas.local.yaml`, run `task bootstrap-areas` again — it
  creates missing notes and never edits existing ones. No installer, including the
  operator, is special-cased; the mechanism is the customization story.
- **Note format:** each generated note follows CLAUDE.md's standard frontmatter
  (`name`, `description`, `type: area`, `created`, `updated`) with a body stub
  inviting `[[wikilink]]`s out to `10-projects/` and `30-resources/` notes, since
  the project-to-area and area/project-to-resource linking convention depends on
  areas existing as link targets first. The body's example links are code spans, so
  they don't create dangling nodes in the vault graph; the only live link is the
  note's self-link, which shows the exact target to use from project notes.
- **Index:** `20-areas/README.md` gains a list of the shipped default slugs from
  `control/areas.example.yaml`, labelled as defaults; `control/areas.local.yaml` is
  authoritative for an installed vault. It gives `00-inbox` triage and new-project
  linking one place to check an area exists before a project note invents a
  duplicate. The list is documentation, not a second source of truth — it lists
  slugs, not status or content, so it can't drift the way a full registry could.
- **Linking convention documented, not enforced:** `20-areas/README.md` and
  `10-projects/README.md` both gain a short paragraph stating the expected shape —
  a project's frontmatter or body links `[[area-slug]]` to the area(s) it serves;
  both projects and areas link out to `30-resources/` notes for reusable patterns.
  No mechanical check enforces this (consistent with CLAUDE.md's stance that
  write-back and linking are conventions agents follow, not gates the tooling
  runs) — this mirrors ADR-0003's session-writeback protocol being convention-driven
  rather than mechanically enforced.
- **Dependency:** the bootstrap requires python3+PyYAML and fails before writing
  anything if either is missing. `install.sh` and `doctor.sh` gain no dependency, so
  the ADR-0004 release smoke test is unaffected.
- **Create-only:** notes are created, never updated. Renames, description edits, and
  deletions are manual.
- **Unversioned manifest:** there is no `doctor.sh` areas check, and the areas
  manifest has no `version:`. This reconciles with ADR-0002, whose version/UPGRADE
  rule is written for `control/*.example.yaml` in general: the areas manifest is read
  only by an on-demand, create-only generator that fails loudly and names the entry
  on any shape it doesn't expect, so the silent-drift risk the version gate exists to
  catch doesn't arise. The first schema-breaking change to the areas manifest adds
  `version:` and an UPGRADE doc under ADR-0002.

## Consequences

- **Now easier:** a fresh clone (the operator's or anyone else's) gets a working
  Areas set with one command instead of an empty directory and a README to
  interpret by hand. The operator's own vault gets their own areas without
  hand-authoring each frontmatter block.
- **Now harder:** nothing structurally new — `bootstrap-areas.sh` and
  `areas.example.yaml` are additive, following patterns `install.sh` and
  `estate.example.yaml` already established.
- **New constraints:** any change to the note-frontmatter format (CLAUDE.md's note
  format section) must be reflected in `bootstrap-areas.sh`'s generation template,
  or generated notes drift from the format hand-authored notes follow.
  `install.sh` seeds the areas manifest alongside roots and estate, so
  `areas.example.yaml` and `areas.local.yaml` join `estate.*.yaml` and
  `roots.*.yaml` as files a fresh clone gets seeded.

## Revisit Conditions

- If the operator or another installer wants Areas that vary per-note beyond what a
  flat YAML list can express (e.g. per-area custom body templates, not just
  name/description), revisit whether the manifest format needs to grow beyond
  `estate.example.yaml`'s flat-list shape.
- If `30-resources/` accumulates enough notes that the "areas/projects link out to
  resources" convention needs more than a documented paragraph — e.g. broken-link
  detection — revisit whether a mechanical check belongs in `doctor.sh`, the same
  way ADR-0002's schema-version check became a real gate rather than a documented
  convention nobody ran.
- If `areas.local.yaml` needs a breaking schema change, add `version:` per ADR-0002.

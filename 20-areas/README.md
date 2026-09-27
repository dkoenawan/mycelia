---
name: areas-readme
description: Ongoing responsibilities with no finish line
type: reference
created: 2026-08-01
updated: 2026-09-27
---

# 20-areas

PARA: **Areas**. Ongoing responsibility with no completion date.

Deliberately broader than work: client engagements, the side business, personal repos, and
life admin all live here. Mycelia exists to reduce total workload, not just client workload.

## Default areas

The shipped defaults, from `control/areas.example.yaml`:

- `health`
- `finances`
- `career`
- `relationships`
- `personal-growth`
- `home-environment`
- `recreation`

For an installed vault, `control/areas.local.yaml` is the authoritative list — this one
only shows what a fresh clone starts with. Edit the local manifest, then run
`task bootstrap-areas` to create any missing notes. Existing notes are never edited, so
renames and removals are done by hand. Before creating a new area, check the local
manifest so the same area isn't invented twice.

## Linking

A project links to each area it serves with `[[area-slug]]` — e.g. `[[health]]` — in its
body or frontmatter. Projects and areas both link out to `30-resources/` notes for
reusable patterns. The convention is documented, not enforced (ADR-0005).

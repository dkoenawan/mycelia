---
id: "002"
title: Config stays plain-file local YAML; no second repo for instances
date: 2026-08-03
status: accepted
deciders: [operator]
---

## Context

Two related questions were open, tracked in
[issue #1](https://github.com/dkoenawan/mycelia/issues/1) and researched across
`docs/research/framework-instance-separation.md` and
`docs/research/config-as-vault-notes.md`:

1. How should mycelia separate its committed framework from an operator's customized,
   local instance — and can an instance ever need to be its own repo?
2. Should machine-readable config (`control/estate.local.yaml`, `control/roots.local.yaml`)
   move into the vault itself — specifically, into a vault note's YAML frontmatter,
   inspired by Directus provisioning its own config tables inside whatever SQL database
   you point it at?

Research on (1) surveyed chezmoi, yadm, Homebrew taps, Terraform modules, and
cookiecutter/Yeoman (+ its `cruft` bolt-on). None share mycelia's exact shape — one repo,
gitignore-separated into framework and local roles, never a fork. chezmoi is the closest
analogue (local values live only as template variables, never as literals in tracked
files — the same principle that already makes mycelia's `.gitignore` split safe) but
still assumes a separate "source state" directory from the "target state," which mycelia
does not have and does not need.

Research on (2) found a real risk, then a correction. Obsidian's Properties panel UI and
its `processFrontMatter`/`Vault.process` API convert YAML to a JS object via `js-yaml` (no
round-trip mode) and lose comments/formatting/quote style on every write through that
specific path — confirmed directly by Obsidian's lead developer as intentional and
won't-fix. But this is scoped to that one write path. It does not fire on opening,
viewing, or indexing a note (the metadata cache is read-only), and it does not apply at
all to a standalone `.yaml` file, since `.yaml`/`.yml` is not a format Obsidian recognizes,
opens, or indexes. `control/estate.local.yaml` is therefore already inert to Obsidian —
no risk, and no new mechanism needed to "put config in the vault," since the vault already
is the whole mycelia clone, `control/` included, the moment Obsidian opens that folder.

## Decision Drivers

- No structural change should be made unless it earns its complexity — plain files
  already satisfy the actual goal ("config lives in the substrate it configures").
- Config must stay safe from accidental corruption via the vault's own primary editing
  tool (Obsidian).
- An operator's instance must never require its own repo, fork, or git identity separate
  from mycelia's — this was a hard constraint stated early in scoping, not just a
  preference.
- The dormant `version:` field in `estate.example.yaml` should become load-bearing rather
  than staying decorative, now that this decision is being made anyway.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Keep `control/*.local.yaml` as plain files (chosen)** | Zero new code; already satisfies "config in the substrate," since `.yaml` is inert to Obsidian; matches the gitignore boundary already in place | None identified — this is the null option relative to today's repo | — chosen |
| Config as vault-note frontmatter, script-written only | Confirmed safe in practice (script writes bypass Obsidian's lossy `processFrontMatter` path entirely) — viable if richer dashboard notes are wanted later | Adds a machine/human key-namespacing problem with no existing convention to borrow (research Finding 5); adds a load-time schema-validation gate as necessary defense-in-depth; solves a UX want, not a real problem | Not rejected outright — kept as a future option for dashboard/visibility notes, not adopted now since it isn't required |
| Config as vault-note frontmatter, human-editable via Properties | Closest to the original Directus-inspired idea | Confirmed unsafe: Obsidian's Properties UI mangles frontmatter on every edit through that path, by the maintainers' own admission, no fix planned | Rejected — this is the specific failure mode the research surfaced |
| Instance as a separate repo/fork | Would give an instance its own git identity, remote, history | Directly contradicts the "no second repo, ever" constraint set at the start of this work; no research candidate (chezmoi, yadm, Homebrew, Terraform, cookiecutter) actually needs this either | Rejected — out of scope by explicit operator instruction |

## Decision Outcome

Chosen option: **keep `control/*.local.yaml` as plain YAML files**, no new config-storage
mechanism. An operator's instance remains a single clone of the framework repo,
gitignore-separated into committed framework and local configuration/content, never a
second repo or fork.

Additionally adopted from the Terraform-module research: make `version:` in
`estate.example.yaml` load-bearing. Any future breaking change to the schema bumps
`version:` and ships a `control/UPGRADE-<N>.md` alongside it, documenting exactly what
changed and what to edit in `*.local.yaml` — the same convention used by
`terraform-aws-modules`' `UPGRADE-N.md` docs (the strongest concrete, adoptable pattern
found in that research, even though no tool anywhere has a fully automated version of it).

## Consequences

- **Now easier:** no new parsing logic, no frontmatter schema, no migration off today's
  `common.sh`-based YAML handling. The install/doctor implementation (this issue's next
  step) can proceed directly against the existing config shape.
- **Now harder:** nothing — this is the null-change option for config storage.
- **New constraints:** any future schema-breaking change to `control/*.example.yaml` must
  bump `version:` and ship a corresponding `control/UPGRADE-<N>.md`. `doctor.sh`
  (implemented on the feature branch for this issue) should compare an instance's
  `estate.local.yaml` `version:` against the framework's current `estate.example.yaml`
  `version:` and print the relevant upgrade doc if behind.

## Revisit Conditions

If the operator later wants human-readable dashboard notes surfacing job status inside
the vault (not just raw config), revisit the "config as vault-note frontmatter,
script-written only" option from the table above — it's confirmed safe, just not
currently required.

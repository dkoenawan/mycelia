---
id: "004"
title: Release versioning policy — SemVer, dual-axis with schema version, manual tag trigger
date: 2026-08-19
status: accepted
deciders: [operator]
---

## Context

`v0.1.0` was tagged by hand on the PR #3 merge commit, with hand-written release notes,
because something needed to exist to point at. There was no policy for what triggers a
release, what a version number is measured against, how a changelog gets produced, or
whether any automated check runs before a tag is cut — tracked in
[issue #4](https://github.com/dkoenawan/mycelia/issues/4).

Full inventory and external survey (SemVer, Conventional Commits, CalVer, 0ver, and the
dual-axis precedents in Helm/Terraform/Kubernetes) live in
`docs/research/release-versioning-policy.md`. This ADR records the decision that research
converged on.

The decision has to account for one thing that already exists and is already
load-bearing: ADR-0002 made `version:` in `control/estate.example.yaml` a mechanically
checked schema version, paired with `control/UPGRADE-<N>.md` docs, enforced by
`scripts/doctor.sh`. That machinery has never been exercised — schema version has never
moved past 1. Any release policy has to say how it relates to a framework-level release
number, not invent a second, competing versioning scheme.

## Decision Drivers

- Don't build automation to police a convention nobody's violating yet — mycelia has one
  operator and occasional agent-authored commits, not a contribution-volume problem.
- ADR-0002's schema `version:` already means one specific thing and is already
  mechanically checked; this decision must not blur that meaning or duplicate it.
- The untested `UPGRADE-N.md`/`doctor.sh` self-check path should finally get exercised as
  a real gate, not stay a documented convention nobody runs.
- Mycelia has a real public contract other people install against (vault structure,
  `CLAUDE.md` conventions, `Taskfile` targets, `control/*.example.yaml` shape) — the kind
  of declared surface SemVer needs to mean anything.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **SemVer, dual-axis (framework release independent of schema `version:`), manual tag trigger (chosen)** | Matches mycelia's actual shape (single-operator, git-pulled, already has one mechanically-checked axis); no automation to build or maintain; reuses `doctor.sh`'s existing self-check as the release gate | Version number alone doesn't mechanically block an incompatible `git pull` the way a package-manager resolver would | — chosen |
| CalVer (`YY.MM`) | Legible release cadence at a glance | Buys nothing here — no support-window/LTS story to communicate, the only reason it earns its keep for Ubuntu/Twisted | Rejected — solves a problem mycelia doesn't have |
| Conventional Commits + automated release (semantic-release / release-please) | Fully mechanical version computation and changelog | Requires commit discipline from every contributor, enforced by tooling (commitlint) that doesn't exist yet; automates a step that isn't a bottleneck at current release volume | Rejected for now — revisit if release frequency or contributor count makes manual tagging the actual bottleneck |
| Single shared version number for framework release and schema `version:` | One number to track | Forces a false-positive major bump when the framework releases but the schema didn't change, or hides a real schema break if the release number doesn't move — the exact failure mode Helm/Terraform/K8s split axes to avoid | Rejected — collapses two things that break on different schedules |
| Zero-based/continuous versioning ("0ver") indefinitely, no policy | Defers the whole question | Issue #4 was opened precisely because "tag whenever it seems reasonable" already felt uncomfortable; doesn't resolve the actual ask | Rejected — not a decision, a non-decision |

## Decision Outcome

Chosen option: **SemVer for the framework-level release, kept independent of ADR-0002's
schema `version:` axis, triggered by a manually pushed `vMAJOR.MINOR.PATCH` tag.**

- **Framework release version:** SemVer. Stay in `0.x` deliberately — not as a
  placeholder, but as an explicit "no compatibility promise yet" stance — until the
  framework surface (vault structure, `CLAUDE.md` conventions, `Taskfile` targets,
  `control/*.example.yaml` shape) feels stable enough that a break would actually hurt an
  installer. That's the real trigger for `1.0`, not a calendar date.
- **Two independent axes, one-directional link:** ADR-0002's `version:` keeps meaning
  exactly one thing — the `control/*.example.yaml` shape changed incompatibly. A
  framework release can ship with or without a schema bump; a schema bump doesn't have to
  wait for a framework release. The only coupling: **any release that includes a
  schema-version bump must include the paired `UPGRADE-<N>.md`**, mechanically enforced
  by `doctor.sh`'s existing self-check.
- **Trigger:** a human pushes a `v*` tag. No merge-triggered automation, no inferred
  version bump. `.github/workflows/release.yml` runs on tag push and does exactly two
  things: validates the tag matches `vMAJOR.MINOR.PATCH`, then runs `task install && task
  doctor:ci` against a bare checkout as the release smoke test — the same install path a
  fresh clone would follow, including the ADR-0002 schema/`UPGRADE-N.md` self-check.
  `doctor:ci` (added to `Taskfile.yml`, `scripts/doctor.sh --ci`) skips only the two
  checks that are meaningless on a bare CI runner: `roots.local.yaml` resolution and the
  `claude` binary being on PATH.
- **Changelog:** hand-written for now, as `v0.1.0`'s was. Adopt Conventional Commits
  prefixes (`feat:`, `fix:`, `docs:`) as commit hygiene starting now, without adopting any
  generator tooling (git-cliff, semantic-release) yet — this makes a future retrofit a
  same-day job instead of a history rewrite, at zero cost today.

## Consequences

- **Now easier:** cutting a release is a known, gated procedure — push a `v*` tag, CI
  validates the tag shape and runs the same smoke test a fresh installer would hit. The
  ADR-0002 self-check finally gets exercised by something other than a documented
  convention.
- **Now harder:** nothing structurally new — `release.yml` and `doctor:ci` are additive.
  The operator still writes release notes by hand.
- **New constraints:** any schema-breaking change to `control/*.example.yaml` must bump
  `version:` and ship `control/UPGRADE-<N>.md` in the same change, or the release smoke
  test fails on tag push. Commits should carry Conventional Commit prefixes going
  forward.

## Revisit Conditions

- If release frequency or contributor count makes manual tagging the actual bottleneck,
  revisit Conventional Commits + `release-please`/`semantic-release` automation.
- If the framework surface (directory structure, `CLAUDE.md` conventions, `Taskfile`
  targets, schema shape) stabilizes to where an installer would actually be hurt by a
  breaking change, that's the trigger to cut `1.0.0` — not a calendar date or a vibe.
- The first real schema-version bump (past `version: 1`) is the first live test of the
  `UPGRADE-N.md`/`doctor.sh` self-check as a release gate; if it turns up a gap in
  `doctor.sh`'s check, fix the check rather than working around it in `release.yml`.

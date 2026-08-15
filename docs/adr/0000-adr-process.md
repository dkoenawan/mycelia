---
id: "000"
title: Use lightweight ADRs for framework decisions
date: 2026-08-03
status: accepted
deciders: [operator]
---

## Context

Mycelia is a framework other people install (see CLAUDE.md, "Framework vs.
configuration"). Decisions about how the framework itself works — install mechanics,
update mechanics, tooling choices — need a durable record of *why*, not just *what*,
the same way `type: feedback` vault notes require a **Why:** line so a rule doesn't get
misapplied later. Without that record, a future contributor (or the operator, months
later) re-litigates settled questions or reverses a decision without knowing what
constraint it was protecting against.

This repo had no `docs/` or ADR convention before this record. `systematic-dev-kit`'s
`adr` skill exists but assumes a `docs/registry/` construct-tracking system (constructs,
patterns.md, cross-linking) that mycelia does not have and does not need — mycelia is a
small, single-purpose framework, not a multi-construct application. A lighter, standalone
MADR-style process fits better.

## Decision Drivers

- Record survives longer than any single conversation or contributor.
- Low overhead — mycelia's own philosophy ("reduce the operator's workload") argues
  against a heavyweight process for a framework this size.
- Must capture the *why*, decision drivers, and a concrete revisit condition, or the
  record is no more useful than a commit message.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Standalone lightweight MADR in `docs/adr/` (chosen)** | Minimal, no dependency on other tooling, well-known format | Not automated | — chosen |
| Reuse `systematic-dev-kit:adr` skill as-is | Already built, conversational elicitation | Assumes `docs/registry/` constructs/patterns system mycelia doesn't have; would force adopting a project model that doesn't fit | Wrong shape for this repo's size |
| No ADRs, decisions live only in commit messages / PROGRESS.local.md | Zero setup | `PROGRESS.local.md` is gitignored (local-only) and commit messages don't carry decision drivers or revisit conditions | Loses the "why" the framework itself teaches vault notes to capture |

## Decision Outcome

Chosen option: **standalone lightweight MADR in `docs/adr/`**, using `docs/adr/template.md`.
Numbering starts at `0000` for this process ADR itself; subsequent ADRs are `0001`,
`0002`, ... in the order they're written. Status lifecycle: `proposed` → `accepted` →
`superseded` (a superseding ADR references the one it replaces via `supersedes:`).

Research that isn't yet a decision — comparisons, open tradeoffs — lives separately under
`docs/research/`, so a reader can tell exploratory material from committed decisions at a
glance. An ADR should reference the research brief it was based on where one exists.

## Consequences

- **Now easier:** future framework changes (tooling choice, schema versioning, install
  mechanics) have a place to record why, reviewable independent of chat history.
- **Now harder:** nothing meaningfully — this is additive.
- **New constraints:** any change to `control/*.example.yaml` schema, `scripts/lib/`
  helper contracts, or vault structure conventions should get an ADR if the change isn't
  obviously reversible or trivial.

## Revisit Conditions

If mycelia grows enough constructs/features that decisions start needing cross-linking
to specific code modules (the thing `systematic-dev-kit:adr` solves), reconsider adopting
that skill's heavier registry model instead of this standalone one.

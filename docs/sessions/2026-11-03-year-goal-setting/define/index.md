<!-- tier: full -->
# Define: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Phase: Define | Started: 2026-11-03 | Status: Draft
> Relates to: Issue #36 · Session history: [`log.md`](../log.md)

## Contents

- [Requirements](requirements.md): REQ-001 to REQ-018, none struck, none deferred
- [Framing](framing.md): the XY and symptom checks, the anchor verdict and Scope update, overlaps
- [Problem](problem.md): context, NEED-01 to NEED-04, evidence, impact, OUT-01 to OUT-03, appetite
- [Quality](quality.md): ISO/IEC 25010:2023 coverage, NFR measures, assumptions and dependencies
- [Diagrams](diagrams.md): impact map, context diagram, traceability (as-is/to-be not required: no existing process changes)

## Framing

- **Tier:** full: #36 creates the vision-layer contract that #37 to #42 all read, and it spans a note format, a template, a parser and validator, docs, tests and an agent-guided session.
- **Verdict:** aligns with the anchor's Scope line "Goal pursuit: yearly goal setting…". The operator also approved an `extend` to the Scope line about area profiles, so the anchor matches the 2026-11-03 ruling. See [framing.md](framing.md).

## Problem statement

Mycelia knows where the operator's material lives, but not what they're trying to achieve this year. So its agents can only grow the vault evenly, and the goal-pursuit features (#37 to #42) have nothing to steer by. Needs: NEED-01 (the operator sets the year's goals with the agent's help), NEED-02 (nothing counts until signed off), NEED-03 (downstream agents read the goals reliably), NEED-04 (other operators get the format, and their goals stay local). Outcomes: OUT-01, OUT-02, OUT-03. Each claim is tagged with its evidence in [problem.md](problem.md).

## Scope

1. A documented year-goals note format: a primary goal as a Mandala Chart of at most 8 pillars × 8 actions, a short list of secondary goals, the areas each pillar or secondary goal touches, a sign-off status and dated changes: [REQ-001](requirements.md#requirements), [REQ-004](requirements.md#requirements), [REQ-007](requirements.md#requirements), [REQ-017](requirements.md#requirements).
2. A parser and validator for that format, with tests in `task check:node`: [REQ-002, REQ-003, REQ-005, REQ-006, REQ-008](requirements.md#requirements), [REQ-018](requirements.md#requirements).
3. An agent-guided goal-setting session whose draft lands in `00-inbox/`: [REQ-009 to REQ-011](requirements.md#requirements), [REQ-015](requirements.md#requirements).
4. Sign-off: a draft becomes the year's goals only after the operator signs it off, and then it lives in `01-vision/`: [REQ-012 to REQ-014](requirements.md#requirements).
5. The new top-level `01-vision/` folder, which ships with only a README and keeps its content local: [REQ-016](requirements.md#requirements).

### Non-goals

- **Goals, state or inventories in area notes.** Areas hold accumulated knowledge only (2026-11-03 ruling, #28 closed as not planned). A pillar may name areas, but only as places where knowledge accumulates.
- **Linking goals to vault notes** (#37), **quarterly focus** (#38), **goal-aware prioritisation** (#39), **in-quarter guidance** (#40), **quarterly retro** (#41) and **year review** (#42). They read this session's format; none of them is built here.
- **An agent-guided flow for amending a signed-off note.** The format records dated changes (REQ-007). How a change gets made is Open question 4.
- **Renumbering the existing PARA folders.** `01-vision/` slots in between `00-inbox/` and `10-projects/`.
- **A scheduled job.** The session runs on demand, so it adds no estate-registry entry.

## Constraints

- Framework/configuration boundary (CLAUDE.md, ADR-0002). The format docs, template, parser, validator, tests and the `01-vision/` README are committed. Every year-goals note, draft or signed off, is vault content and stays local.
- New runner code is TypeScript on Node (ADR-0007), gated by `task check:node`.
- Notes are plain Markdown with the vault's YAML frontmatter, readable without mycelia or Obsidian plugins (anchor Scope and Non-goals).
- The draft lands in the root of `00-inbox/`, not in `00-inbox/capture/`. Items in the inbox root are never ingested (`00-inbox/README.md`).
- Committed text uses no real names, absolute paths or client names (CLAUDE.md).

## Open questions

1. **Secondary-goal shape: confirm at the gate.** Define proposes a short list: each secondary goal is one statement plus the areas it touches (REQ-004), with no chart and no cap. The issue asks for a lighter structure. A list keeps the session short, and #38 picks quarterly focus mainly from the primary goal's pillars [assumed]. A smaller chart would add a second structure to parse and validate for little steering value. If the operator prefers a small chart, REQ-004 and its criterion change before freeze.
2. **Unknown area links: confirm at the gate.** Define proposes a warning, not a rejection (REQ-005), because a dangling `[[link]]` is fine under the vault convention, and an area may be created later in the year.
3. **Second sign-off for the same year: confirm at the gate.** Define proposes that sign-off refuses when the year already has a signed-off note (REQ-014), so mid-year change goes through the dated changes section instead of a replacement. The alternative is to replace the note and archive the old one.
4. **How changes are made to a signed-off note.** The note records dated changes (REQ-007). Whether the operator edits them by hand or an agent-guided amendment flow adds them is not decided. Define treats the flow as out of scope. If it's wanted, it needs a follow-up issue, which the orchestrator creates.
5. **Appetite: confirm at the gate.** Define proposes one week of focused work (see [problem.md](problem.md#appetite-and-no-gos)). The operator hasn't stated one.
6. **Stale issue text.** #36's body still says "Related: #28" and its acceptance says "valid 9×9 chart". Per the operator, the acceptance now reads "a valid chart of at most 8 pillars × 8 actions around the centre goal". The operator updates the issue body, as with the existing open item for #27.

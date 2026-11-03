<!-- tier: full -->
# Define: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Phase: Define | Started: 2026-11-03 | Status: Draft (revised after the Define gate's adjustments, 2026-11-03)
> Relates to: Issue #36 · Session history: [`log.md`](../log.md)

## Contents

- [Requirements](requirements.md): REQ-001 to REQ-021, with REQ-008 struck, and one deferred item (#46)
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

1. **A documented year-goals note format, one note per year.** It holds one or more main goals, each drafted as a Mandala Chart (a centre goal, pillars, and actions per pillar, where a partly filled chart is valid), a short list of secondary goals, the areas each pillar or secondary goal touches, a sign-off status and dated changes. The format stays open to sub-goal or quarterly breakdowns it doesn't define: [REQ-001](requirements.md#requirements), [REQ-004](requirements.md#requirements), [REQ-007](requirements.md#requirements), [REQ-017](requirements.md#requirements), [REQ-020](requirements.md#requirements).
2. **A parser and validator for that format, with tests in `task check:node`.** Errors are kept for content that makes the note unreadable. Every rule about how the operator structures their goals is a warning, including more than 3 main goals, which is strongly discouraged: [REQ-002, REQ-003, REQ-005, REQ-006](requirements.md#requirements), [REQ-018, REQ-019, REQ-021](requirements.md#requirements).
3. **An agent-guided goal-setting session whose draft lands in `00-inbox/`:** [REQ-009 to REQ-011](requirements.md#requirements), [REQ-015](requirements.md#requirements).
4. **Sign-off.** A draft becomes the year's goals only after the operator signs it off, and then it lives in `01-vision/`. Signing off again updates the year's goals and archives the earlier note: [REQ-012 to REQ-014](requirements.md#requirements).
5. **The new top-level `01-vision/` folder,** which ships with only a README and keeps its content local: [REQ-016](requirements.md#requirements).

How main and secondary goals fit together now that a year can hold several main goals: a goal worth charting is a main goal, and anything lighter is a one-line secondary goal. The only difference between them is the chart. A main goal with no pillars gets a warning suggesting it become a secondary goal (REQ-021).

### Non-goals

- **Goals, state or inventories in area notes.** Areas hold accumulated knowledge only (2026-11-03 ruling, #28 closed as not planned). A pillar may name areas, but only as places where knowledge accumulates.
- **An agent-guided flow for amending a signed-off note during the year.** Deferred to #46. This session defines only the dated changes section that flow would write to (REQ-007, REQ-014).
- **A goal lifecycle model** (states such as achieved early or abandoned). It's kept open on purpose: a changes entry can record either in free text (REQ-007), and nothing in the format rules either out.
- **The quarterly breakdown of a goal** (#38). The format tolerates one (REQ-020) but doesn't define it.
- **Linking goals to vault notes** (#37), **goal-aware prioritisation** (#39), **in-quarter guidance** (#40), **quarterly retro** (#41) and **year review** (#42). They read this session's format; none of them is built here.
- **Renumbering the existing PARA folders.** `01-vision/` slots in between `00-inbox/` and `10-projects/`.
- **A scheduled job.** The session runs on demand, so it adds no estate-registry entry.

## Constraints

- Framework/configuration boundary (CLAUDE.md, ADR-0002). The format docs, template, parser, validator, tests and the `01-vision/` README are committed. Every year-goals note, whether draft, signed off or archived, is vault content and stays local.
- New runner code is TypeScript on Node (ADR-0007), gated by `task check:node`.
- Notes are plain Markdown with the vault's YAML frontmatter, readable without mycelia or Obsidian plugins (anchor Scope and Non-goals).
- The draft lands in the root of `00-inbox/`, not in `00-inbox/capture/`. Items in the inbox root are never ingested (`00-inbox/README.md`).
- A replaced note is moved to `40-archive/`, not deleted, because "history is the point" (CLAUDE.md).
- Committed text uses no real names, absolute paths or client names (CLAUDE.md).

## Open questions

Settled at the Define gate (2026-11-03): secondary goals are a short list (REQ-004); missing area links get a warning (REQ-005); signing off again updates the year's goals (REQ-014); the amendment flow is deferred to #46; and the appetite is one week.

1. **More than 8 pillars, or more than 8 actions in a pillar: warning, not error. Confirm.** The operator's earlier answer called 8 × 8 a maximum. The gate then asked for every rule about how the operator structures their goals to be loosened to a warning, so REQ-021 warns rather than rejects. If the 8 × 8 maximum should stay a hard rule, REQ-021's first two cases move back into REQ-003 before freeze.
2. **Stale issue text.** #36's body still says "Related: #28", names a single "primary goal", and its acceptance says "valid 9×9 chart". Per the operator's answers, the acceptance now reads "a signed-off year-goals note whose main goals each pass the validator (charts of up to 8 pillars × 8 actions around the centre goal, partly filled allowed)". The operator updates the issue body, as with the existing open item for #27.
3. **Mission wording. Does the anchor need a second update?** The anchor's Mission says "a Mandala Chart with a primary goal plus secondary goals", which now reads as exactly one charted goal. Define reads it as compatible: the recommended case is still one main goal, and the verdict stays aligns. But if the operator wants the anchor to reflect several main goals, that's a separate `extend` to the Mission, drafted with them. The approved anchor update touches only Scope, and the operator earlier asked for the Mission to stay unchanged.

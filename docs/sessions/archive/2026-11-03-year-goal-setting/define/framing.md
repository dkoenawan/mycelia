<!-- tier: full -->
# Framing: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Part of [index](index.md) · Define

## Problem checks

### Solution-first (XY)

- **Need behind the request:** the operator wants to state, once a year and with the agent's help, what they're trying to achieve. That statement has to be in a form mycelia's agents can steer by, so effort follows the goals instead of growing the vault evenly.
- **Outcome:** the operator confirmed that the requested fix is the need (2026-11-03). The Mandala Chart is the operator's chosen goal-setting method, and both #36 and the anchor's Mission name it. So the problem statement keeps it, as a centre goal with pillars and actions per pillar, and a partly filled chart is valid. At the Define gate the operator widened the issue's "one primary goal" in two ways. First, a year may hold several main goals, each charted; more than 3 is strongly discouraged but never refused. Second, the format must not confine how a goal is broken down. So the chart is the need, but how many charts a year holds, and how strictly their shape is enforced, are not.

**Candidate solutions:** implementation choices kept out of the requirements for Design to settle:
- How the chart is laid out in Markdown: a 9×9 grid table, or nested headings and lists. REQ-017 only requires every element to be visible as text.
- How sign-off happens: a task command, or an agent step at the end of the session that moves the note and sets its status. REQ-013 states only the result.
- How the session runs: a TypeScript runner that drives `claude` through the agent provider (ADR-0007), or an interactive slash command or skill.
- Several main goals as one note per year, or as one note per goal. Define chose one note per year holding all main goals (REQ-002, REQ-014): it keeps the current-goals lookup to one file and gives the changes section one place to live.
- A smaller chart for secondary goals. Rejected at the Define gate in favour of a short list (REQ-004).
- How a replaced note is kept: Define chose moving it to `40-archive/` (REQ-014). Keeping version history inside the note was the alternative.

### Symptom and cause

- **Observed symptom:** mycelia knows where things live (PARA) but not what the operator is trying to achieve this year, so the agent can only grow the vault evenly [observed: #36, Problem].
- **Cause:** the framework has no place and no format for year goals. No note format, runner, script, control file or ADR mentions goals [observed: search of `src/`, `scripts/`, `control/`, the PARA READMEs and `docs/adr/`, 2026-11-03]. Areas were once meant to hold goals (#28), but that was ruled out on 2026-11-03 [observed: log.md, Key decisions].

## Anchor

- **State:** complete. The markers appear once in `README.md`. Vision, Mission, Scope and Non-goals are all present and non-empty, and no restatement elsewhere in the README conflicts with them (CLAUDE.md's "What mycelia is for" points to the anchor). The structure passes, but Scope line 2 ("Area profiles (state, goals and inventories)…") contradicts the operator's 2026-11-03 ruling that areas hold knowledge and goals live only in the vision layer. That line is corrected below. At the Define gate, the Mission's "a Mandala Chart with a primary goal plus secondary goals" was also found to read as exactly one charted goal, which conflicts with the gate's ruling that a year may hold several main goals. That phrase is reworded below, so the Mission now reflects several main goals.
- **Verdict:** aligns
- **Rests on:**
  - Scope: "Goal pursuit: yearly goal setting, quarterly focus, in-quarter guidance, and agent-drafted quarterly retros and year reviews built from vault evidence." Yearly goal setting is named outright.
  - Scope: "Framework only: generic defaults, schemas and shareable area templates. Every operator's notes and estate stay local configuration." The format is committed, and the notes stay local (REQ-016).
  - Non-goal: "Even growth: the agent follows the operator's goals and focus, and isn't meant to fill every area." This work gives the agent goals to follow.
  - Non-goals: "Committing an operator's notes…", "A database or proprietary store…" and "Depending on Obsidian plugins". None is crossed: the notes are plain Markdown, kept local, with no plugin.
  - Mission, as updated below: "Yearly goals (one or more main goals, each a Mandala Chart, plus secondary goals) and quarterly focus and retros steer where that effort goes."

### Anchor update

- **Action:** extend
- **Elements:** scope (one line replaced) and mission (one phrase replaced). Everything else in the anchor is unchanged, including the Mission's "work out what the operator still needs to know or own".
- **Agreed text:**

**1. Scope:** replace the line

> - Area profiles (state, goals and inventories) and a structure that grows from evidence: new areas, sub-areas and resource branches are proposed, then accepted or pruned by the operator.

with

> - A structure that grows from evidence: areas hold the knowledge that accumulates over the year, and new areas, sub-areas and resource branches are proposed, then accepted or pruned by the operator. The operator's goals and direction live in the goal-pursuit layer, not in areas.

The operator approved this text as written on 2026-11-03.

**2. Mission:** in the Mission paragraph, replace the phrase

> Yearly goals (a Mandala Chart with a primary goal plus secondary goals)

with

> Yearly goals (one or more main goals, each a Mandala Chart, plus secondary goals)

The rest of the Mission paragraph stays as it is. The operator chose this rewording at the Define gate on 2026-11-03.

## Overlaps

- **Registry:** none found. There's no `docs/registry/`, so ADRs in `docs/adr/` were searched instead.
- **ADRs:** none found that conflict. ADR-0002 (framework/instance separation), ADR-0005 (default areas taxonomy), ADR-0006 (inbox capture ingestion) and ADR-0007 (TypeScript/Node runners) constrain this work, and it follows them: local notes, no goals in areas, draft in the inbox root rather than `capture/`, TS runner code. ADR-0005's area taxonomy is read only, as the target of pillar area links.
- **Existing constructs:** none found that already hold goals. The ingester (`src/ingest/`) writes `30-resources/` notes from `00-inbox/capture/` and leaves the inbox root alone, so a draft there doesn't collide with it.

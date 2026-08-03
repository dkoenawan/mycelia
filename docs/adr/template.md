<!--
Template for an Architecture Decision Record (MADR-style, trimmed).
Copy this file to docs/adr/<NNN>-<kebab-case-title>.md, next number = current count + 1.
Remove this comment block in the copy.
-->

---
id: "<NNN>"
title: <short decision title>
date: <YYYY-MM-DD>
status: proposed | accepted | superseded
deciders: [<names>]
supersedes: <NNN or omit>
---

## Context

What problem forced this decision? Include the constraints that made it non-obvious —
without them the ADR loses its explanatory power. Reference the research brief this
decision is based on, if one exists (`docs/research/<file>.md`).

## Decision Drivers

- <driver 1 — e.g. cost, maintainability, agent-agnosticism>
- <driver 2>
- <driver 3>

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Option A (chosen)** | | | — chosen |
| Option B | | | |
| Option C | | | |

## Decision Outcome

Chosen option: **<Option>**, because <reasoning tied back to the decision drivers>.

## Consequences

- **Now easier:** <what becomes simpler>
- **Now harder:** <what becomes more complex>
- **New constraints:** <what must hold going forward>

## Revisit Conditions

A specific, observable condition that should trigger revisiting this decision — not
"if requirements change." E.g. "if mycelia scripts grow past N files" or "if a second
maintainer needs onboarding in under 10 minutes and today's flow doesn't achieve that."

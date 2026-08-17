---
id: "0003"
title: Session write-back protocol
date: 2026-08-17
status: accepted
deciders: [operator]
supersedes:
---

## Context

Nothing in mycelia's `CLAUDE.md` instructs an agent to write progress back into the vault
as a side effect of doing work. Today, a real learning from a session — a fix, a decision,
a pattern worth reusing — exists only in the chat transcript unless the operator remembers
to ask for it to be written down. That is backwards: "the one rule" (move information
toward the operator without requiring them to come looking) is violated by the operator
having to be the one who remembers.

Session *start* behavior (proactively surfacing stale projects, areas overdue for review,
or jobs needing recurring attention) is explicitly out of scope for this decision — the
operator wants that to stay a plain greeting for now, deferred until there's a concrete
design for what "needs attention" means. This ADR covers session *end* / write-back only.

## Decision Drivers

- The operator should never have to ask "did you write that down?"
- Ordinary progress and durable, reusable learnings are different things and should not
  be filed the same way — otherwise either the project notes get polluted with one-off
  status trivia, or `30-resources/` gets polluted with project-specific detail nobody else
  will ever need.
- Must fit the existing PARA + frontmatter conventions already defined in `CLAUDE.md`,
  not introduce a parallel filing system.
- Cheap enough to apply as a habit on every session that touches a project/area, not a
  ceremony reserved for special occasions.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Update the touched note in place + link out when reusable (chosen)** | Matches existing PARA shape; no new note type; reusable knowledge still gets a stable, cross-linkable home | Requires judgment call each session ("is this reusable?") | — chosen |
| Always mirror everything into `30-resources/` | Never misses a reusable learning | Floods `30-resources/` with project-specific detail; defeats its purpose as cross-project reference | Rejected — pollutes the one directory meant to stay curated |
| `daily/` as the single write-back point, everything indexed through it | One place to check for "what happened" | Adds a mandatory daily-note ceremony even when nothing daily-shaped occurred; not what the issue asked for | Rejected — operator confirmed this issue is about per-activity write-back, not a daily log requirement |

## Decision Outcome

Chosen option: **update the project/area note being worked on in place, and additionally
write or update a `30-resources/` note only when the learning is reusable beyond that one
project/area.**

Concretely:

1. **While/after doing work in a `10-projects/` or `20-areas/` note:** update that note
   directly — progress, decisions made (including decisions deferred, not just decisions
   taken), and bump `updated:`. This is not optional ceremony; it is the same edit a human
   maintaining the note would make.
2. **Durability bar for a `30-resources/` write:** would this help in a *different*
   project or area, not just this one? A reusable pattern, a gotcha, a corrected
   assumption, a fixed process → yes, write/update the resource note and link it from the
   project/area note with `[[wikilink]]`. Something that only describes what happened in
   this one project → no, it stays local to that note.
3. **Corrections from the operator** (`type: feedback`) always clear the durability bar —
   a correction made once should never need to be made twice, by definition of what
   `type: feedback` is for (see `CLAUDE.md`'s note format section).
4. **`daily/` is unaffected by this decision** — it remains agent-written per existing
   convention, but nothing here makes it mandatory per session. That stays separate.
5. **Session start remains a plain greeting for now.** Proactively surfacing stale
   projects/areas or recurring-schedule items is deferred — it needs its own design pass
   (what "stale" or "needs attention" means, cheaply, without re-reading the whole vault)
   before it becomes a rule. Tracked as a follow-on, not decided here.

## Consequences

- **Now easier:** durable learnings accumulate in `30-resources/` as a natural side effect
  of doing project/area work, instead of depending on the operator asking for a write-up.
- **Now harder:** every session doing project/area work carries one extra judgment call
  (reusable or not) — a small, recurring cost accepted in exchange for not losing
  information.
- **New constraints:** `30-resources/` notes must stay linkable from the project/area notes
  that motivated them, per existing `[[wikilink]]` convention — this decision does not
  introduce a new note type or directory.

## Revisit Conditions

Revisit if `30-resources/` starts accumulating project-specific notes that don't get reused
elsewhere within a few months — that would mean the durability bar is set too low. Revisit
session-start scope separately, as its own decision, once there's a concrete design for
what "a project/area that hasn't been worked on" or "needs a recurring schedule update"
means operationally.

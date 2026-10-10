# Framing: Resource lifecycle MVP — inbox → resources ingestion

> Part of [index](index.md) · Define

## Problem checks

### Solution-first (XY)

- **Need behind the request:** when the operator comes across material worth keeping (a social post, an article), they want to capture it in one step and have it filed as reusable reference, connected to the areas and projects it bears on, without doing the filing and linking themselves. See NEED-01 to NEED-03 in [problem.md](problem.md).
- **Outcome:** the requested fix moved to Candidate solutions. The problem statement states the need; the daily scheduled agent is the operator's chosen shape for meeting it, and the requirements describe its behaviour without fixing how it's built.

**Candidate solutions:**
- A daily scheduled agentic job that reads captured items from the inbox, turns each into a `30-resources/` note, and links it to one or more `20-areas/` or `10-projects/` notes (issue #12, as stated by the operator).

### Symptom and cause

- **Observed symptom:** captured material has no path from `00-inbox/` to `30-resources/` other than the operator filing it by hand. `00-inbox/README.md` says to "file them onward … once they have a home", and no runner or script does so [observed: `00-inbox/README.md`, `scripts/`].
- **Cause:** known and structural, not a defect: the framework has no capture-to-resource workflow yet (the README roadmap lists routing and circulation as not built) [observed: `README.md` Roadmap]. How much captured material is actually lost or left unfiled today isn't measured [assumed].

## Anchor

- **State:** missing: the root `README.md` has no `<!-- compass:anchor -->` markers. It does carry anchor-like wording (the opening tagline, "The idea", "Framework vs. configuration", "Design commitments"), which the agreed text reuses.
- **Verdict:** aligns
- **Rests on:** Scope lines "Agent workflows that capture, file, connect and summarise vault content" and "Framework only: generic defaults and schemas; every operator's notes and estate stay local configuration"; Non-goal "Committing an operator's notes, estate or paths to the framework repository, or requiring an instance to be its own repo or fork". The ingester's output stays local, uncommitted vault content (REQ-034), so it doesn't cross that non-goal.

### Anchor update

- **Action:** create
- **Elements:** vision, mission, scope, non-goals
- **Agreed text:**

Approved by the operator on 2026-09-28, as drafted:

```markdown
<!-- compass:anchor -->
## Project anchor

### Vision

A second brain that the operator's agents feed, instead of one the operator feeds: the operator reads and steers, and stops being the message bus between their own systems.

### Mission

Mycelia is an installable framework (vault conventions, an estate registry and runner tooling) that lets scheduled agents write, file and connect an operator's knowledge in plain Markdown, and keeps their automated estate visible and healthy, with autonomy licensed by machine-checkable gates.

### Scope

- Vault structure and conventions: PARA directories, note format and linking, as plain Markdown in git, readable without mycelia.
- The estate registry and health checks for scheduled jobs, with failures pushed to the operator rather than logged.
- Runner tooling (the shared library, install and bootstrap scripts) for scheduled agents that land their own work behind gates.
- Agent workflows that capture, file, connect and summarise vault content.
- Framework only: generic defaults and schemas; every operator's notes and estate stay local configuration.

### Non-goals

- Committing an operator's notes, estate or paths to the framework repository, or requiring an instance to be its own repo or fork.
- A database or proprietary store; the vault stays plain Markdown in git.
- Depending on Obsidian plugins.
<!-- /compass:anchor -->
```

## Overlaps

There's no construct registry (`docs/registry/`). ADRs live in `docs/adr/`, and I searched them.

- **Overlap: `inbox_note()` in `scripts/lib/common.sh`, and `00-inbox/README.md`.** Agents already write operator-decision items into `00-inbox/`, named `YYYY-MM-DD-{slug}.md` with `type: reference`. Nothing marks them as different from captures. The operator chose a dedicated capture folder, `00-inbox/capture/`, and only that folder is ingested (REQ-001, REQ-002, REQ-036).
- **Tension: ADR-0003 (session write-back).** ADR-0003 keeps `30-resources/` curated and rejected flooding it. Ingestion adds a second, bulk path into `30-resources/`. This isn't a contradiction, because ADR-0003 governs session write-back, not capture. Its revisit condition (resources that never get reused) should be watched. Recorded here, not blocking.
- **Aligns: ADR-0005 (areas taxonomy).** It defines area slugs as `[[wikilink]]` targets, and the convention that areas and projects link out to `30-resources/` notes. Ingestion's two-way linking follows it (REQ-015 to REQ-017). The generated area notes' "Resources …" paragraph is the section back-links are appended to.
- **Constraint: ADR-0002 and the CLAUDE.md framework/configuration boundary.** Vault content is gitignored, and an instance is never its own repo. So the ingester's outputs aren't committed, and its ledger is a local gitignored file. The operator accepted `commits: false` for this job, with an explanatory note in its registry entry (REQ-034, REQ-038). This is a documented exception to CLAUDE.md's "`commits: false` is a defect". Ignored files survive a branch checkout, so the lost-work failure that rule guards against doesn't apply.
- **Deviation: CLAUDE.md "one unit of work per run".** The operator chose one daily run that works through items oldest first, up to a fixed cap (REQ-003, REQ-004). Selection stays deterministic, and each item is still its own unit with its own gate and ledger record (REQ-024, REQ-025, REQ-028). Making the policy configurable is #16.
- **No conflict found** with ADR-0001 (install/Taskfile tooling) or ADR-0004 (release versioning). Both still apply: the new runner gets a `task` entrypoint (REQ-037), and the release smoke test keeps passing (REQ-039).

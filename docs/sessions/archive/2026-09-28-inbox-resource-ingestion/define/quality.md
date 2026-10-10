<!-- tier: full -->
# Quality: Resource lifecycle MVP — inbox → resources ingestion

> Part of [index](index.md) · Define

## Quality coverage (ISO/IEC 25010:2023)

| Characteristic | Covered by | Not applicable because |
|---|---|---|
| Functional suitability | REQ-001, REQ-003 to REQ-009, REQ-012 to REQ-023, REQ-028, REQ-029 | |
| Performance efficiency | REQ-004, REQ-041 | |
| Compatibility | REQ-013, REQ-015, REQ-016, REQ-017, REQ-034 | |
| Interaction capability | REQ-007, REQ-009, REQ-020, REQ-029, REQ-035, REQ-036 | |
| Reliability | REQ-022, REQ-024, REQ-025, REQ-027, REQ-031, REQ-032, REQ-033 | |
| Security | REQ-002, REQ-010, REQ-011, REQ-040 | |
| Maintainability | REQ-037, REQ-038, REQ-039 | |
| Flexibility | REQ-018, REQ-035, REQ-037 | |
| Safety | | The ingester reads and writes Markdown notes on the operator's machine. It can't cause physical, health or environmental harm. Harm to data (loss or overwrite) is covered under Reliability and Security. |

Compatibility here means the ingester's notes coexist with hand-written and bootstrap-generated notes and with Obsidian. They use the standard frontmatter and resolvable wikilinks (REQ-013, REQ-015), append without rewriting (REQ-016, REQ-017), and leave git-tracked files alone (REQ-034). Flexibility here means it works on any installer's taxonomy (REQ-018) and from a fresh clone (REQ-035, REQ-037).

## NFR measures

| Requirement | Scale | Tolerable | Goal |
|---|---|---|---|
| REQ-041 | Minutes of wall-clock time from run start to exit, for 10 eligible text capture items of up to 2,000 words each against 50 placement targets | 60 | 15 |
| REQ-004 | Eligible capture items processed per run | 10 | 10 |
| REQ-011 | Files changed by a run outside its allowed write set, including on the prompt-injection fixture | 0 | 0 |
| REQ-010 | Outbound requests per run that aren't GET or HEAD, go to a URL not in the capture item being processed (or its redirects), or carry stored credentials | 0 | 0 |

## Assumptions and dependencies

**Assumptions:**
- The operator drops no more than 10 items on a typical day, so the fixed cap keeps up (OUT-01).
- Reading every placement target's name and description on every run is affordable at MVP vault size (tens of notes). Routing that scales without re-reading everything is #13.
- A capture item's last-modified time is a good enough stand-in for when it was dropped (REQ-003).
- Wikilinks resolve by filename stem across the vault, as with Obsidian's default link resolution, so stems must be unique vault-wide (REQ-022).
- Vault content under the PARA directories isn't versioned by git. The durability of resources, archived originals and the ledger rests on the local filesystem and the operator's own backups. The operator accepted this (Open question answers, 2026-09-28).
- Appending to a bootstrap-generated area note leaves its empty `-` placeholder item in place, because the operator asked for append-only edits (REQ-016).
- Installing the scheduler entry (for example a crontab line), and adding the job to the operator's `control/estate.local.yaml`, are manual steps for the operator, as for every other job in the estate.

**Dependencies:**
- The `claude` CLI, resolvable from the scheduler's bare environment (`resolve_claude()` in `scripts/lib/common.sh`): relied on by REQ-008, REQ-012 to REQ-015, REQ-020 and REQ-032.
- Outbound network access to public web pages: relied on by REQ-008 and REQ-010.
- Area and project notes existing as link targets (ADR-0005, `scripts/bootstrap-areas.sh`): relied on by REQ-015, REQ-016, REQ-018 and REQ-019.
- The operator's scheduler and their local estate registry entry: relied on by OUT-01, and documented by REQ-038.
- The operator's decision to accept `commits: false` for this job (2026-09-28): relied on by REQ-034 and REQ-038.
- The ADR-0004 release smoke test: relied on by REQ-039.

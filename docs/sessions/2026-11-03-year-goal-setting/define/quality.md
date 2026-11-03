<!-- tier: full -->
# Quality: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Part of [index](index.md) · Define

## Quality coverage (ISO/IEC 25010:2023)

| Characteristic | Covered by | Not applicable because |
|---|---|---|
| Functional suitability | REQ-002, REQ-004, REQ-006, REQ-007, REQ-009, REQ-010, REQ-012, REQ-013, REQ-014 | |
| Performance efficiency | | There's one note per year, holding a few charts of up to about 64 actions each and a short list. Parsing and validating it is trivially small work, and the session's pace is set by the operator's conversation, not by the system. |
| Compatibility | REQ-006, REQ-017, REQ-020 | |
| Interaction capability | REQ-003, REQ-005, REQ-009, REQ-019, REQ-021 | |
| Reliability | REQ-011, REQ-014 | |
| Security | REQ-016 | |
| Maintainability | REQ-001, REQ-018 | |
| Flexibility | REQ-002, REQ-004, REQ-016, REQ-019, REQ-020, REQ-021 | |
| Safety | | The feature only reads and writes Markdown notes inside the vault. It takes no action outside the vault and can't cause physical, health or environmental harm. |

Notes on the less obvious rows:
- **Security** here means confidentiality: an operator's goals are personal material and must never reach the public framework repository (REQ-016).
- **Compatibility** covers the downstream agents #37 to #42 through the parser's output (REQ-006), any Markdown reader, including Obsidian without plugins (REQ-017), and extra content the format doesn't define, such as a quarterly breakdown from #38 (REQ-020).
- **Flexibility** is the operator's Define-gate direction, "let's not confine us too much". It covers several main goals, partly filled charts, warnings instead of errors for structure (REQ-002, REQ-019, REQ-021), unrecognised content tolerated (REQ-020), and installation by other operators with nothing personal shipped (REQ-016).
- **Reliability** covers an interrupted session keeping its work (REQ-011), and a re-sign-off that keeps the earlier note and its changes rather than losing them (REQ-014).

## NFR measures

| Requirement | Scale | Tolerable | Goal |
|---|---|---|---|
| REQ-016 | year-goals note files (draft, signed off or archived, in `00-inbox/`, `01-vision/` or `40-archive/`) listed by `git ls-files` in a clone where the session, sign-off and a re-sign-off have run | 0 | 0 |
| REQ-017 | goal elements (centre goals, pillars, actions, areas touched, secondary goals) of the documented example note that aren't visible as text in GitHub's Markdown preview and in plugin-free Obsidian | 0 | 0 |
| REQ-018 | items listed in REQ-018 (including each warning and each rejection case) that have no test run by `task check:node` | 0 | 0 |

## Assumptions and dependencies

**Assumptions:**
- The operator sets goals for one year at a time, and runs the session before or early in that year.
- The operator won't usually fill a whole chart at the first sitting, so a partly filled chart is the normal case (the reason for REQ-002 and REQ-011).
- Most years hold one to three main goals, so the more-than-3 warning (REQ-019) rarely fires.
- A short list is enough structure for secondary goals for #38 to #42 to read.
- `20-areas/` notes are named by their filename stem, so an area link can be checked against a file's existence (vault note format, CLAUDE.md).

**Dependencies:**
- The `claude` CLI, reached through the existing agent provider (`src/ingest/agent/`, ADR-0007): relied on by REQ-009, REQ-010 and REQ-011.
- Node 22.18 or later and the `task check:node` gate (Taskfile, ADR-0007): relied on by REQ-018.
- The 2026-11-03 ruling that areas hold knowledge and not goals (log.md), and the approved anchor Scope update (framing.md): relied on by REQ-005 and REQ-015.
- The vault `.gitignore`'s pattern of keeping the PARA folders' content local (including `40-archive/`) while committing their READMEs: relied on by REQ-014 and REQ-016.
- #46 (the amendment flow) depends on this session's changes section (REQ-007), not the other way round. Downstream consumers #37 to #42 likewise read the parser's output, and are relied on only by OUT-02's check.

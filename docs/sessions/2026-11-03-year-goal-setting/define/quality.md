<!-- tier: full -->
# Quality: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Part of [index](index.md) · Define

## Quality coverage (ISO/IEC 25010:2023)

| Characteristic | Covered by | Not applicable because |
|---|---|---|
| Functional suitability | REQ-002, REQ-004, REQ-006, REQ-007, REQ-009, REQ-010, REQ-012, REQ-013 | |
| Performance efficiency | | There's one note per year, with at most 1 centre goal, 8 pillars, 64 actions and a short list. Parsing and validating it is trivially small work, and the session's pace is set by the operator's conversation, not by the system. |
| Compatibility | REQ-006, REQ-017 | |
| Interaction capability | REQ-003, REQ-005, REQ-009, REQ-014 | |
| Reliability | REQ-008, REQ-011, REQ-014 | |
| Security | REQ-016 | |
| Maintainability | REQ-001, REQ-018 | |
| Flexibility | REQ-002, REQ-004, REQ-016 | |
| Safety | | The feature only reads and writes Markdown notes inside the vault. It takes no action outside the vault and can't cause physical, health or environmental harm. |

Notes on the less obvious rows:
- **Security** here means confidentiality: an operator's goals are personal material and must never reach the public framework repository (REQ-016).
- **Compatibility** covers two consumers: the downstream agents #37 to #42 through the parser's output (REQ-006), and any Markdown reader, including Obsidian without plugins (REQ-017).
- **Flexibility** covers partly filled charts and optional secondary goals (REQ-002, REQ-004), and installation by other operators with nothing personal shipped (REQ-016).

## NFR measures

| Requirement | Scale | Tolerable | Goal |
|---|---|---|---|
| REQ-016 | year-goals note files (draft or signed off, in `00-inbox/` or `01-vision/`) listed by `git ls-files` in a clone where the session and sign-off have run | 0 | 0 |
| REQ-017 | chart elements (centre goal, pillars, actions, areas touched, secondary goals) of the documented example note that aren't visible as text in GitHub's Markdown preview and in plugin-free Obsidian | 0 | 0 |
| REQ-018 | violation kinds listed in REQ-003 and REQ-007 that have no test run by `task check:node` | 0 | 0 |

## Assumptions and dependencies

**Assumptions:**
- The operator sets goals for one year at a time, and runs the session before or early in that year.
- The operator won't usually fill all 64 actions at the first sitting, so a partly filled chart is the normal case (the reason for REQ-002 and REQ-011).
- A short list is enough structure for secondary goals for #38 to #42 to read. This is to be confirmed at the gate (index Open question 1).
- `20-areas/` notes are named by their filename stem, so an area link can be checked against a file's existence (vault note format, CLAUDE.md).

**Dependencies:**
- The `claude` CLI, reached through the existing agent provider (`src/ingest/agent/`, ADR-0007): relied on by REQ-009, REQ-010 and REQ-011.
- Node 22.18 or later and the `task check:node` gate (Taskfile, ADR-0007): relied on by REQ-018.
- The 2026-11-03 ruling that areas hold knowledge and not goals (log.md), and the approved anchor Scope update (framing.md): relied on by REQ-015 and REQ-005.
- The vault `.gitignore`'s pattern of keeping PARA folders' content local while committing their README: relied on by REQ-016.
- Downstream consumers #37 to #42 read the parser's output. They depend on this work, not the other way round, and are relied on only by OUT-02's check.

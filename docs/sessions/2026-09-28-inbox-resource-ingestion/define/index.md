<!-- tier: full. The main doc (D12). Summarise and link; never restate a sub-doc's content. -->
# Define: Resource lifecycle MVP — inbox → resources ingestion

> Phase: Define | Started: 2026-09-28 | Status: Draft, ready for the Define gate
> Relates to: Issue #12 · Session history: [`log.md`](../log.md)

## Contents

- [Requirements](requirements.md): REQ-001 to REQ-042 live; REQ-043 and REQ-044 deferred to #17 and #16
- [Framing](framing.md): the XY and symptom checks, the anchor (created, aligns), and overlaps with `inbox_note()` and ADRs 0002, 0003 and 0005
- [Problem](problem.md): context, NEED-01 to NEED-06, evidence, impact, OUT-01 to OUT-07, appetite
- [Quality](quality.md): ISO/IEC 25010:2023 coverage, NFR measures, assumptions and dependencies
- [Diagrams](diagrams.md): impact map, context diagram, traceability per outcome, as-is and to-be

## Framing

- **Tier:** full: it adds a new scheduled capability that crosses `00-inbox/`, `30-resources/`, `20-areas/`, `10-projects/`, `40-archive/`, the runner library and the estate registry, and it changes how the inbox (the operator's only triage queue) is used. Confirmed by the operator on 2026-09-28.
- **Verdict:** aligns with the project anchor, which this session creates. See [framing.md](framing.md).

## Problem statement

The operator files captured material by hand, and the inbox those captures land in is also where agents raise the operator's decisions. So capture costs filing work, and captures dilute the one triage queue. Needs: NEED-01 (capture in one step), NEED-02 (resources linked to their areas and projects), NEED-03 (one clear ask when judgement is needed), NEED-04 (decisions untouched), NEED-05 (installable from defaults), NEED-06 (safe when reading untrusted material unattended). Outcomes: OUT-01 to OUT-07. This is a summary; each claim is tagged with its evidence in [problem.md](problem.md).

## Scope

1. Ingest only the dedicated capture folder, and never touch decision items: [REQ-001](requirements.md#requirements), [REQ-002](requirements.md#requirements), [REQ-035](requirements.md#requirements), [REQ-036](requirements.md#requirements).
2. One daily run, oldest first, up to 10 items; held items are skipped: [REQ-003](requirements.md#requirements) to [REQ-006](requirements.md#requirements).
3. Text and Markdown captures, with read-only URL retrieval for thin items: [REQ-007](requirements.md#requirements) to [REQ-011](requirements.md#requirements).
4. One resource note per item, linked both ways to existing areas and projects; the original is archived: [REQ-012](requirements.md#requirements) to [REQ-019](requirements.md#requirements), [REQ-021](requirements.md#requirements), [REQ-022](requirements.md#requirements).
5. No fit, a failed fetch or an unsupported type holds the item with one ask, and a resolved ask is archived: [REQ-007](requirements.md#requirements), [REQ-009](requirements.md#requirements), [REQ-020](requirements.md#requirements), [REQ-023](requirements.md#requirements), [REQ-026](requirements.md#requirements).
6. A per-item gate, undo on failure, a ledger, a daily-note summary, and exit status: [REQ-024](requirements.md#requirements) to [REQ-033](requirements.md#requirements).
7. Framework packaging: no git-tracked changes, the capture folder README, a `task` entrypoint, an example registry entry, the smoke test and privacy: [REQ-034](requirements.md#requirements) to [REQ-042](requirements.md#requirements).

### Non-goals

- **Routing that scales** without re-reading every area, project and resource: #13.
- **Project lifecycle** (archival, outcome records): #14.
- **Resource lifecycle** (evolving or merging existing resources, de-duplication, archive-with-reason): #15.
- **A configurable batch policy** (order, cap, cadence): #16 (deferred REQ-044).
- **File captures** (PDFs, images, screenshots): #17 (deferred REQ-043).
- **Creating, renaming or deleting area or project notes.** When nothing fits, the ingester asks instead (REQ-018, REQ-020).
- **Committing the ingester's output.** Resources, archived originals and the ledger stay local vault content (REQ-034).
- **Editing area or project notes beyond appending a back-link** (REQ-016).
- **A mobile or web capture surface.** That's roadmap Layer 3 (Circulation).

## Constraints

- **Framework/configuration boundary (CLAUDE.md, ADR-0002).** No vault content or `*.local.*` file is committed, and an instance is never its own repo.
- **Public-repo privacy (CLAUDE.md).** No real names, personal areas or projects, absolute paths, or he/his/him for the operator in any committed file.
- **Runner conventions (CLAUDE.md "Writing runners").** `set -euo pipefail`, source `scripts/lib/common.sh`, validate before acting, deterministic selection, no swallowed errors, named-file staging. Two deviations were agreed with the operator: a capped batch per run instead of one unit per run, and `commits: false` because every output is gitignored (see [framing.md](framing.md#overlaps)).
- **Estate registry (CLAUDE.md).** The job is documented in `control/estate.example.yaml`, and the operator registers it in their local registry.
- **Taskfile convention (ADR-0001)** and **release smoke test (ADR-0004).**
- **Note format (CLAUDE.md).** Resource notes use the standard frontmatter.
- **Appetite:** about one week of agent-driven sessions.

## Decisions taken in Define

- **Where a held capture waits (the operator left this choice to Define).** A capture with no fitting area or project stays where it is in `00-inbox/capture/`, and the ask is a separate note in `00-inbox/`, outside the capture folder. The item isn't moved to a holding folder. It's then skipped, with no new ask, for as long as its ask is open and its content is unchanged (REQ-005). Editing the item (for example, adding an `[[area]]` link) or deleting the ask makes it eligible again (REQ-006). Why this option:
  - The operator acts in one place, the capture note itself.
  - The ask's link to the item never breaks.
  - A decision item is never inside the ingested folder, so OUT-03 holds by construction.
  - Repeat asks are prevented by state the operator can see (the open ask), not only by the ledger.

  The same hold applies to a failed fetch (REQ-009), an unsupported file type (REQ-007) and repeated check failures (REQ-026).
- **Thresholds set by Define for the operator to confirm at the gate:** the per-run cap is 10 (REQ-004); "thin" means fewer than 50 words outside frontmatter and URLs (glossary); an ask is raised after 3 consecutive check failures (REQ-026).

## Open questions

All questions resolved. The operator answered every framing question on 2026-09-28: tier, anchor, inbox separation, input shapes, URL retrieval, batching, archiving, no-fit behaviour, one note per item, two-way links, local-only output, the gate, the outcomes and the appetite. The thresholds above can be adjusted at the Define gate.

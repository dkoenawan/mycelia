<!-- tier: full. The main doc (D12). Summarise and link; never restate a sub-doc's content. -->
# Define: Notion inbox: capture from phone into the vault inbox

> Phase: Define | Started: 2026-10-10 | Status: Draft, ready for the Define gate
> Relates to: Issue #21 · Session history: [`log.md`](../log.md)

## Contents

- [Requirements](requirements.md): REQ-001 to REQ-044 live (31 Must, 12 Should, 1 Could); none deferred
- [Framing](framing.md): the XY check (Notion moved to candidate solutions), symptom and cause, the anchor (complete, aligns, no update), and overlaps with the ADR-0006 ingester, #16 and ADRs 0002, 0005 and 0007
- [Problem](problem.md): context, NEED-01 to NEED-06, evidence, impact, OUT-01 to OUT-07, appetite
- [Quality](quality.md): ISO/IEC 25010:2023 coverage, NFR measures, assumptions and dependencies
- [Diagrams](diagrams.md): impact map, context diagram, traceability per outcome, as-is and to-be

## Framing

- **Tier:** full. It adds a new capability across several components: a third-party API, a stored secret, a setup command, a new scheduled job and registry entry, and a hand-off into the ADR-0006 ingester. Confirmed by the operator on 2026-10-10.
- **Verdict:** aligns with the project anchor, with no anchor change. See [framing.md](framing.md).

## Problem statement

The vault's only way in is a file created on the Linux machine that holds it, and most captures come up when the operator has only their phone. So captures wait or are lost, and the operator stays the courier between phone and vault. Needs: NEED-01 (capture from the phone in seconds), NEED-02 (see each capture's outcome from the phone), NEED-03 (one guided setup), NEED-04 (credential, vault and workspace protected unattended), NEED-05 (opt-in, nothing operator-specific committed), NEED-06 (retries, then one ask). Outcomes: OUT-01 to OUT-07. See [problem.md](problem.md).

## Scope

1. Setup: one command that takes a key and a shared parent page, creates the source inbox from a template with an instructions row, stores the key and ID in local config, and is safe to re-run: [REQ-001](requirements.md#requirements) to [REQ-009](requirements.md#requirements).
2. Pull: oldest first, up to 10 per run, converted to Markdown capture items, at most once per source item, and later edits ignored: [REQ-010](requirements.md#requirements) to [REQ-013](requirements.md#requirements), [REQ-021](requirements.md#requirements), [REQ-024](requirements.md#requirements).
3. Ingest in the same run, through the existing ingester and only for the connector's own items: [REQ-014](requirements.md#requirements); optional area-or-project hint: [REQ-023](requirements.md#requirements).
4. Status write-back (`New`, `Ingested`, `Failed` with a reason), retries, stop after 3 failures with one ask, and resume: [REQ-015](requirements.md#requirements) to [REQ-020](requirements.md#requirements).
5. Security: the key, the write set, and the workspace changes allowed: [REQ-022](requirements.md#requirements), [REQ-025](requirements.md#requirements) to [REQ-027](requirements.md#requirements).
6. Run behaviour: can't-start, mid-run faults, locking, ledger, daily note, exit status, any schedule, preflight, rate limits: [REQ-028](requirements.md#requirements) to [REQ-036](requirements.md#requirements), [REQ-043](requirements.md#requirements), [REQ-044](requirements.md#requirements).
7. Framework packaging: registry example, opt-in behaviour, doctor, template, privacy, README: [REQ-037](requirements.md#requirements) to [REQ-042](requirements.md#requirements).

### Non-goals

- **Other capture sources** (Obsidian mobile with git sync, email, a chat bot). The requirements are source-neutral where cheap, but Notion is the only source built.
- **A plain Notion page as the inbox.** The source inbox is a database only.
- **Images, files, embeds and other non-text content** from source items. They're left out and noted (REQ-012); file captures in the ingester are #17.
- **Two-way sync.** Edits made in Notion after a pull are ignored (REQ-021), and nothing flows from the vault back to Notion except status and reason.
- **Archiving or deleting rows in Notion.** Rows stay, with their status (REQ-022).
- **A configurable order or per-run cap.** Those stay fixed, as in ADR-0006. Making them configurable is #16. Only the schedule is configurable, through the scheduler (REQ-035).
- **Changing the ingester's behaviour** for items dropped into the capture folder by hand (REQ-014, REQ-038).
- **Committing anything from the operator's Notion workspace** (REQ-040, REQ-041).

## Constraints

- **Framework/configuration boundary (CLAUDE.md, ADR-0002).** The key, the source inbox ID and all capture content stay local and gitignored. Only the generic template and code are committed.
- **Public-repo privacy (CLAUDE.md).** No real names, IDs, absolute paths or personal details, and the operator is "they" in committed prose.
- **Runner conventions (CLAUDE.md "Writing runners", ADR-0007).** TypeScript on Node under `src/`, gated by `task check:node`; validate before acting, deterministic selection, no swallowed errors. The agreed ADR-0006 exceptions carry over: a capped batch per run, and `commits: false` with a registry `note` (see [framing.md](framing.md#overlaps)).
- **Estate registry (CLAUDE.md).** The pull job is documented in `control/estate.example.yaml` (REQ-037), and the operator registers it in their local registry with their chosen cron.
- **Reuse, don't duplicate, the ingester's security layers (operator, Q4).**
- **Taskfile convention (ADR-0001)** and **release smoke test (ADR-0004).**
- **Appetite:** two to three implementation sessions. REQ-023 is deferred first if over.

## Decisions taken in Define

The operator left these to Define. They're open to change at the gate.

- **A held item maps to `Failed`.** When the ingester holds a pulled item (no fit, a failed fetch, or its own 3 check failures), the source item becomes `Failed` with a reason naming the ingester's ask. The connector doesn't raise a second ask, and it doesn't re-pull the item, because it's already in the vault and is resolved there as ADR-0006 describes (REQ-016). When it's later ingested, the status catches up at the next pull run (REQ-020).
- **"N" is 3**, the same as the ingester's strike count, and applies only to pull failures (REQ-018). Failures inside ingestion follow the ingester's own 3-strike rule, so an item never gets two asks.
- **A stopped item resumes when its status is set back to `New`** (REQ-019). The ask says so.
- **Edits are ignored from the moment an item is pulled**, not only once it's ingested. A held item is resolved in the vault, not in Notion (REQ-021).
- **An area-or-project hint that matches no existing area or project** isn't added as a wikilink, so the ingester places the item as if there were no hint (REQ-023).
- **Setup won't silently replace a source inbox it can no longer reach.** It stops and says how to start over, so there's never a second inbox the phone isn't using (REQ-009).

## Open questions

All questions resolved. The operator answered every framing question on 2026-10-10: tier, XY, the Notion object, the pull/ingest boundary, the status lifecycle, the content supported, setup, the schedule, the anchor and the appetite. The decisions above and the thresholds (10 per run, 3 failures, the REQ-043 timings) can be adjusted at the Define gate. Two items are for Design, not Define: the Notion API behaviour assumed in [quality.md](quality.md#assumptions-and-dependencies), and whether the connector's outbound channel needs its own ADR ([framing.md](framing.md#overlaps)).

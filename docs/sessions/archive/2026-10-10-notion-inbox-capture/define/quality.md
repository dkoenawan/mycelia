<!-- tier: full -->
# Quality: Notion inbox: capture from phone into the vault inbox

> Part of [index](index.md) · Define

## Quality coverage (ISO/IEC 25010:2023)

| Characteristic | Covered by | Not applicable because |
|---|---|---|
| Functional suitability | REQ-002, REQ-003, REQ-010, REQ-011, REQ-014 to REQ-018, REQ-020, REQ-023 | |
| Performance efficiency | REQ-010, REQ-043, REQ-044 | |
| Compatibility | REQ-014, REQ-022, REQ-030, REQ-038 | |
| Interaction capability | REQ-006, REQ-008, REQ-012, REQ-016, REQ-018, REQ-019, REQ-032, REQ-036, REQ-042 | |
| Reliability | REQ-007, REQ-009, REQ-013, REQ-017, REQ-021, REQ-028, REQ-029, REQ-031, REQ-033 to REQ-035 | |
| Security | REQ-004, REQ-005, REQ-008, REQ-022, REQ-024 to REQ-026 | |
| Maintainability | REQ-001, REQ-027, REQ-037, REQ-040, REQ-041 | |
| Flexibility | REQ-035, REQ-038, REQ-039 | |
| Safety | | The connector moves text between a hosted note service and Markdown files on the operator's machine. It can't cause physical, health or environmental harm. Harm to data (loss, duplication or overwrite) is covered under Reliability, and harm through the credential or untrusted content under Security. |

Compatibility here means the connector coexists with the ingester and the operator's own Notion workspace. It drives the ingester rather than replacing it (REQ-014), never runs alongside it (REQ-030), touches only its own rows' status and reason (REQ-022), and leaves installs without Notion unchanged (REQ-038). Flexibility here means it runs on any schedule (REQ-035) and stays opt-in (REQ-038, REQ-039).

## NFR measures

| Requirement | Scale | Tolerable | Goal |
|---|---|---|---|
| REQ-043 | Minutes of wall-clock time a pull run spends outside ingestion (querying, reading, converting, writing captures, updating statuses), from ledger timestamps, for 10 eligible source items of up to 2,000 words each | 5 | 1 |
| REQ-044 | Source items recorded as failed in a run because the capture source rate-limited requests | 0 | 0 |
| REQ-010 | Eligible source items processed per pull run | 10 | 10 |
| REQ-025 | Occurrences of the API key outside the connector config, across the repository tree, the ledger, run output, the daily note, asks and capture items | 0 | 0 |
| REQ-026 | Files changed by a pull run outside its allowed write set, including on the prompt-injection fixture | 0 | 0 |

## Assumptions and dependencies

**Assumptions:**
- The operator captures no more than 10 items between pull runs on a typical day, so the fixed cap keeps up (OUT-01). Making the cap configurable is #16.
- An internal Notion integration can create a database under a page that has been shared with it, and can read and update that database's rows. It can't create one at the top level of a workspace. To be confirmed in Design against the API version chosen.
- An internal integration's key doesn't expire on its own. It stops working only when it's revoked or the integration loses access, which REQ-028, REQ-029 and REQ-036 report.
- A row's creation time in the capture source is a good enough stand-in for when it was captured (REQ-010).
- The operator accepts that capture content passes through a third-party hosted service before it reaches the vault. The vault, not the capture source, is the store of record (anchor non-goal, [framing.md](framing.md#anchor)).
- The connector config can sit somewhere already outside the ingester agent's read scope and already gitignored, such as `control/*.local.*` (ADR-0006, ADR-0002). Where exactly is a Design choice.
- Installing the scheduler entry, and adding the job to the operator's `control/estate.local.yaml`, are manual steps for the operator, as for every other job in the estate.

**Dependencies:**
- The ADR-0006 ingester (`src/ingest/`), with its checks, rollback, asks, lock and ledger: relied on by REQ-014, REQ-016, REQ-020, REQ-024, REQ-026 and REQ-030.
- The Notion public API, and outbound network access to it: relied on by REQ-002, REQ-003, REQ-006, REQ-007, REQ-009 to REQ-011, REQ-015 to REQ-018, REQ-022, REQ-029 and REQ-044.
- A test Notion workspace with an internal integration, for the Test phase: relied on by the acceptance criteria of REQ-002 to REQ-007, REQ-009, REQ-022, REQ-025 and REQ-026.
- The Notion mobile app on the operator's phone: relied on by OUT-01 and OUT-02.
- The agent provider (Claude Code, ADR-0007), through the ingester: relied on by REQ-014 and REQ-028.
- The operator's scheduler and their local estate registry entry: relied on by REQ-035, and documented by REQ-037.
- The `commits: false` exception in ADR-0006: relied on by REQ-027 and REQ-037.
- The ADR-0004 release smoke test: relied on by REQ-038.

<!-- tier: full -->
# Problem: Notion inbox: capture from phone into the vault inbox

> Part of [index](index.md) · Define

### Context

**Situation:** since ADR-0006, anything dropped into `00-inbox/capture/` becomes a linked `30-resources/` note on the next ingester run [observed: ADR-0006, `00-inbox/capture/README.md`]. That folder is on the Linux machine that holds the vault, and the only way to drop something into it is to create a file there, for example in VS Code or Obsidian on that machine [observed: issue #21].

**Complication:** most of the operator's captures come up away from that machine, when they have only their phone [observed: issue #21]. Opening an editor on the Linux machine for each one is impractical [observed: issue #21], so captures either wait until the operator is back at the machine or are lost [assumed]. The README roadmap already names "a mobile surface for reading and capture" as unbuilt Layer 3 work [observed: `README.md` Roadmap].

### Need and stakeholders

- **NEED-01:** When the operator comes across something worth keeping while away from the vault's machine, they want to capture it on their phone in seconds, so that it reaches the vault's capture flow without them moving it there by hand later.
- **NEED-02:** When a phone capture has been processed, the operator wants to see its outcome (ingested, or failed and why) from the phone, so they know whether it landed or needs action without opening the vault.
- **NEED-03:** When the operator (or another installer) first connects a capture source, they want one guided command that takes an API key and sets up the phone-side inbox from a template, so they don't build a schema or edit config by hand.
- **NEED-04:** When the pull runs unattended on remote, untrusted content with a stored credential, the operator wants the credential, the rest of the vault, their configuration and their capture-source workspace protected, so they can let it run unsupervised.
- **NEED-05:** When someone installs mycelia without wanting phone capture, that installer wants the connector to be opt-in, and the framework to carry no operator's capture-source details, so their install is unaffected and the repository stays publishable.
- **NEED-06:** When a capture can't be brought in, the operator wants it retried and, if the failure persists, exactly one actionable ask, so failures are pushed to them rather than left silently in a queue on the phone.

### Evidence

- Adding to `00-inbox/` today means opening an editor on the Linux machine, which is impractical [observed: issue #21].
- The operator wants to capture into a Notion database from their phone and have mycelia pull it in daily, or on another schedule they choose, marking each row's outcome [observed: issue #21; operator's answers, 2026-10-10].
- The capture folder plus the ingester already turn a text or link file into a linked resource note [observed: ADR-0006, `README.md` "Inbox ingestion"].
- The ingester supports `.md` and `.txt` only. PDFs and images aren't supported [observed: `00-inbox/capture/README.md`; #17].
- The ingester's agent can't read `control/`, `.state/` or hidden folders [observed: ADR-0006 "Read scope"].
- Mobile capture is on the roadmap and unbuilt [observed: `README.md` Roadmap, Layer 3].
- The operator captures no more than 10 items on a typical day [assumed; the same assumption as ADR-0006].
- Captures are delayed or lost today because of the editor step; the scale isn't measured [assumed].
- Notion's API can't create a database at the top level of a workspace for an internal integration. It needs a parent page shared with the integration [assumed; to confirm in Design against the API version chosen].

### Impact and why now

- **If nothing changes:** captures made away from the machine depend on the operator remembering them and later typing them in at the Linux machine. That's the manual message-bus work the anchor's vision says the operator should stop doing [observed: README anchor, Vision]. Material that's lost never reaches the ingester, so it's never linked to the areas and projects it bears on [assumed].
- **Why now:** the ingester (ADR-0006, #12) shipped on 2026-10-10, so a capture that reaches the capture folder is now filed with no further work [observed: commit `df97e3d`]. The missing piece is getting the capture there from the phone [observed: issue #21].

### Success outcomes

| Outcome | Signal | Target | Checked when | For need |
|---|---|---|---|---|
| OUT-01 | Share of phone captures that reach a final state in the vault (ingested, or held with one ask) by the end of the first pull run after they were captured, on runs with no more than 10 eligible captures | 100% | 30 days after the first scheduled pull run, from the connector's ledger | NEED-01 |
| OUT-02 | Phone captures the operator re-typed or copied into the vault by hand at the Linux machine | 0 | 30 days after the first scheduled pull run, operator report | NEED-01 |
| OUT-03 | Share of pulled source items whose status in the source inbox matches their vault outcome after the run (Ingested when ingested; Failed with a reason when held, failed or stopped) | 100% | At the Test phase against a test workspace, and 30 days after the first scheduled run by comparing the ledger with the source inbox | NEED-02 |
| OUT-04 | On a fresh clone with a test workspace: one setup command, given a key and a shared parent page, produces a working source inbox and local config; a pull run then ingests a sample capture; a second setup run creates nothing new | Passes | At the Test phase | NEED-03 |
| OUT-05 | (a) Occurrences of the API key outside the connector config (tracked files, logs, ledger, daily note, asks, capture items, vault notes); (b) files a run changed outside its allowed write set, including on a prompt-injection fixture; (c) changes in the capture-source workspace other than status and reason on processed rows | 0 for each | At the Test phase, and 30 days after the first scheduled run | NEED-04 |
| OUT-06 | On a fresh clone with no connector config: the release smoke test and `task ingest-inbox` behave as before; the session's diff contains no operator-specific or personal content | Passes; 0 matches | At the Test phase | NEED-05 |
| OUT-07 | (a) Capture items or resource notes per source item; (b) asks per source item per failure episode; (c) source items failing for more than 3 runs without an ask | (a) at most 1; (b) exactly 1 when stopped or held, otherwise 0; (c) 0 | At the Test phase, and 30 days after the first scheduled run, from the ledger and `00-inbox/` | NEED-06, NEED-01 |

### Appetite and no-gos

- **Appetite:** two to three implementation sessions. If the work runs over, the area-or-project hint (REQ-023) is the first thing deferred to a follow-up issue.
- **No-gos:** see [Non-goals](index.md#non-goals).

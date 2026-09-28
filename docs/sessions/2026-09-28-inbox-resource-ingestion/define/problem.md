<!-- tier: full -->
# Problem: Resource lifecycle MVP — inbox → resources ingestion

> Part of [index](index.md) · Define

### Context

**Situation:** new notes created in Obsidian default to `00-inbox/`, and the inbox README tells the operator to file them onward to `10-projects/`, `20-areas/` or `30-resources/` "once they have a home" [observed: `00-inbox/README.md`]. The same folder is where agents raise decisions for the operator, through `inbox_note()` [observed: `scripts/lib/common.sh`]. Nothing files captured material automatically [observed: `scripts/`].

**Complication:** the operator now wants to capture material they come across (social posts, articles) without filing it themselves [observed: issue #12]. Since ADR-0005 (2026-09-27), areas exist as `[[wikilink]]` targets, so there's something to link resources to [observed: `docs/adr/0005-default-areas-taxonomy-and-bootstrap.md`]. Captured material filed by hand competes with the operator's decisions in the one queue they're meant to triage [assumed].

### Need and stakeholders

- **NEED-01:** When the operator comes across material worth keeping, they want to drop it into the vault in one step, so they can move on without filing it.
- **NEED-02:** When captured material becomes a resource, the operator wants it connected to the areas and projects it bears on, in both directions, so they find it from where they'll need it.
- **NEED-03:** When a capture can't be filed without their judgement, the operator wants one clear, actionable ask in the inbox, raised once, so their triage queue stays short.
- **NEED-04:** When agents raise decisions in the inbox, the operator wants the ingester to leave those items untouched, so no decision is ever lost or silently filed.
- **NEED-05:** When someone else installs mycelia, that installer wants the ingester to work from framework defaults, with no operator's personal content in the repository, so they can adopt it for their own vault.
- **NEED-06:** When the ingester reads untrusted material from captures and the web unattended, the operator wants the rest of their vault, their configuration and their credentials protected, so they can let it run without supervision.

### Evidence

- The operator wants to drop any material (for example a social post or article) into the inbox and have a daily agent turn it into linked resources [observed: issue #12].
- The inbox is also the channel for agent-raised decisions, with no marker that tells them apart from captures [observed: `scripts/lib/common.sh` `inbox_note()`, `00-inbox/README.md`].
- No runner files inbox items today; filing is manual [observed: `scripts/`, `00-inbox/README.md`].
- Areas now exist as link targets, and the convention is that areas and projects link out to `30-resources/` notes [observed: ADR-0005, `20-areas/README.md`].
- Vault content, including every output the ingester would write, is gitignored [observed: `.gitignore`, ADR-0002].
- Social-post URLs are often behind login walls, so fetching them can fail [assumed].
- The operator captures fewer than 10 items on a typical day [assumed].
- Unfiled captures currently sit in the inbox or go unrecorded; how many is unmeasured [assumed].

### Impact and why now

- **If nothing changes:** the operator stays the message bus for their own knowledge. Every capture needs a manual filing and linking pass, or it sits in the inbox, where it dilutes the decision queue and risks decisions being missed [assumed]. Material that isn't filed doesn't get linked to the areas it bears on, so it's not found when it's needed [assumed].
- **Why now:** the areas taxonomy just landed (ADR-0005, #9), so link targets exist for the first time [observed: ADR-0005]. The operator has asked for the whole user story as an MVP, with the scale-dependent parts split out to #13, #14 and #15 [observed: `log.md` decision, 2026-09-28].

### Success outcomes

| Outcome | Signal | Target | Checked when | For need |
|---|---|---|---|---|
| OUT-01 | Share of capture items that reach a final state (ingested, or held with an ask) within 2 daily runs of being dropped, on days when no more than 10 items are dropped | 100% | 30 days after the first scheduled run, from the ledger | NEED-01 |
| OUT-02 | (a) Share of resources linked both ways to at least one area or project; (b) in a spot check of 10 resources, placements the operator agrees with; (c) share of items with no fitting area or project that got an ask instead of a resource | (a) 100%; (b) at least 8 of 10; (c) 100% | 30 days after the first scheduled run, from the ledger and an operator spot check | NEED-02, NEED-03 |
| OUT-03 | Files in `00-inbox/` outside the capture folder, not created by the ingester, that the ingester modified, moved or deleted | 0 | At the Test phase against a fixture, and 30 days after the first scheduled run by checksum comparison | NEED-04 |
| OUT-04 | Captures the operator filed or linked by hand, other than by answering an ask | 0 | 30 days after the first scheduled run, operator report | NEED-01 |
| OUT-05 | Asks raised per held item per hold | Exactly 1 | 30 days after the first scheduled run, from the ledger and `00-inbox/` | NEED-03 |
| OUT-06 | Files a run changed outside its allowed write set, including in a run on a prompt-injection fixture | 0 | At the Test phase, and 30 days after the first scheduled run from the ledger | NEED-06 |
| OUT-07 | On a fresh clone with default areas: `task ingest-inbox` ingests a sample capture, and the session's diff contains no personal content | Passes; 0 matches | At the Test phase | NEED-05 |

### Appetite and no-gos

- **Appetite:** about one week of agent-driven sessions for one operator.
- **No-gos:** see [Non-goals](index.md#non-goals).

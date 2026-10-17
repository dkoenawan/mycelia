# Reference: Notion capture connector

The Notion connector pulls rows from a Notion database (the *source inbox*) into
`00-inbox/capture/` and ingests them through the inbox ingester (ADR-0006). This page
lists its commands, files, formats and limits as built. For why it works this way, see
[the explanation](../../explanation/notion-capture/overview.md). For the security rules,
see [ADR-0008](../../adr/0008-credentialed-egress-for-capture-source-connectors.md).

Code: `integration/notion/` (`src/`, `template/`, `test/`).

## Commands

| Task | Runs | Does | Changes |
|---|---|---|---|
| `task notion:setup -- "<page link or ID>"` | `node integration/notion/src/cli.ts setup <page>` | Creates the source inbox under a page shared with the integration, adds the instructions row and writes the config. If a config already exists, it checks the stored inbox and reports it | The Notion workspace (one database and one row) and `control/notion.local.yaml`. With an existing config, it changes nothing except adding a missing instructions row |
| `task notion:pull` | `node integration/notion/src/cli.ts pull` | One pull run (see [Pull run](#pull-run)) | Gitignored vault content, local state, and Status and Reason of the rows it processes |
| `task notion:pull:preflight` | `node integration/notion/src/cli.ts pull --preflight` | The pull's can-start checks: config, key, access to the source inbox, gitignore probes and the ingester's own preflight | Nothing |

All three depend on `task deps:node`, which installs the pinned Node dependencies on
first use. `notion:setup` is interactive. It passes everything after `--` to the CLI as
one quoted argument, so the `?` and `#` in a page link survive the shell.

**Page argument.** Setup accepts a Notion page link, a dashed page ID, or a bare 32-hex
page ID. It takes the trailing 32 hex characters of a link and ignores any `?` or `#`
suffix. If the argument is missing or can't be parsed, setup prints its usage and exits
2 before it asks for the key.

**The key** is read from a hidden prompt (`Notion integration secret (input hidden):`)
when stdin is a terminal, otherwise from one line of stdin. Setup never reads it from
argv or the environment.

## Exit codes

From `node integration/notion/src/cli.ts`. go-task reports 201 for any non-zero exit, so
run the `node` command directly to see the code.

| Code | `pull` | `pull --preflight` | `setup` |
|---|---|---|---|
| 0 | Done, or nothing to do | Ready | Inbox created, or the existing one reported |
| 1 | At least one row failed or stopped. The other rows were processed | — | — |
| 2 | Can't start, and nothing was changed: not set up, config unsafe or malformed, key rejected, source inbox inaccessible, a write path not gitignored, or the ingester can't start | Not ready (same causes) | Can't proceed, and nothing was created: usage error, config path unsafe, key rejected, parent page not shared, stored inbox inaccessible, or network fault |
| 3 | Another pull run or `task ingest-inbox` holds the lock. Nothing was changed | — | — |
| 4 | Stopped early: Notion became unreachable or rejected the key, or the agent provider failed. Completed rows are kept, and nothing is recorded against the rest. Also returned for an unexpected internal error | Unexpected internal error | Unexpected internal error |
| 130 / 143 | Interrupted by SIGINT / SIGTERM. The shared lock is released | — | — |

## Files

| Path | Written by | Tracked by git? | Contents |
|---|---|---|---|
| `control/notion.local.yaml` | setup | No (`control/*.local.yaml`) | The [connector config](#connector-config). Mode 0600 |
| `.state/notion-pull/ledger.jsonl` | pull | No (`.state/`) | The [connector ledger](#ledger) |
| `00-inbox/capture/notion-*.md` | pull | No | [Capture items](#capture-item), until the ingester archives them |
| `00-inbox/YYYY-MM-DD-notion-stopped-*.md` | pull | No | [Stopped-row asks](#stopped-row-ask) |
| `daily/YYYY-MM-DD.md` | pull (appends) | No | The [Phone capture block](#daily-note-block) |
| `.state/ingest-inbox/lock` | pull (shared with the ingester) | No | The run lock. Pulls and `task ingest-inbox` never run at the same time |

Everything else a pull run writes (resource notes, archived originals, the ingester's
asks, its daily block and its ledger `.state/ingest-inbox/ledger.jsonl`) is the
ingester's, within the ingester's write set. Neither setup nor a pull runs git, and both
refuse to write a path git would track.

## Connector config

`control/notion.local.yaml`, written by setup through a temp file and a rename, mode
0600. It's the only file that holds the API key.

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Config format version. Any other value is rejected |
| `api_key` | string | The internal integration's secret |
| `database_id` | string | The source inbox database's ID. Shown in messages |
| `data_source_id` | string | The database's data source, used for queries and new rows (Notion API 2025-09-03) |
| `instructions_page_id` | string or `null` | The instructions row, which a pull never touches. `null` only if setup was interrupted before creating it, and the next setup run adds it |
| `status_property` | `status` or `select` | How the Status column was created: native Status (the normal case), or a select where a blank status means New |

Setup refuses to write the file (exit 2, nothing written) unless the path is under
`control/` and `git check-ignore` matches it. A pull refuses to start if the file is
missing, unsafe or malformed. `task doctor` check 9 reports the connector as not
configured (a note, not a failure) while the file is absent. Once the file exists, the
check passes only if it's gitignored, has mode 600 and parses as YAML.

## Source inbox

The database setup creates under the shared parent page, from
`integration/notion/template/source-inbox.json`.

**Title:** *Capture inbox*.

| Column | Notion type | Set by | Meaning |
|---|---|---|---|
| Name | title | the operator | The capture's title. Becomes the capture item's heading and part of its filename |
| Status | status (or select) | the connector; the operator only to retry | `New`, `Ingested` or `Failed`. See [Statuses](#statuses) |
| URL | url | the operator, optional | A link the capture is about. It's written into the capture item, so the ingester fetches it |
| Area or project | rich text | the operator, optional | The slug of an existing note in `20-areas/` or `10-projects/` (for example `career`). If one exists, the capture item links it as `[[slug]]` |
| Reason | rich text | the connector | Why a row is `Failed`. Truncated to 2,000 characters; the full reason is in the ledger |

The row's page body holds the capture's content.

**Instructions row:** *How to capture (read me)*, status `New`. It explains how to
capture, what the statuses mean, what content is supported, and that edits after a pull
are ignored. A pull never pulls it, changes it or records it.

## Statuses

| Status | Meaning | What happens next |
|---|---|---|
| `New`, or blank | Waiting to be pulled | The next pull with room takes it |
| `Ingested` | Pulled and ingested: a resource note exists and the original is archived | Nothing. The row is never pulled again |
| `Failed` | Needs a look. Reason says why | Depends on the reason, below |

Reasons the connector writes:

| Reason | Cause | Retried? |
|---|---|---|
| `couldn't read the row: …`, `couldn't convert the row: …`, `couldn't write the capture item: …`, `a capture item named … already exists` | A pull failure: the row couldn't be read, converted or written to the capture folder | Yes, at every pull. After 3 consecutive pull failures, the row stops |
| `stopped: set Status to New to retry` | 3 consecutive pull failures. One ask was raised in `00-inbox/` | Only after the operator sets Status to `New`, which resets the failure count |
| `held: <cause>; see ask <filename>` | The ingester held the capture item and raised its own ask. Causes: no area or project fitted; the capture is empty; a linked page couldn't be fetched; the capture isn't a supported kind; the ingester's check failed three times | No. Resolve the ingester's ask, and once the item is ingested (by a pull's session or `task ingest-inbox`), the next pull sets `Ingested` and clears Reason |
| `held: an ask in 00-inbox/ already holds it` | An ingester ask already held the capture item | As above |
| `held: the capture item … is no longer in the capture folder` | The capture item was removed by hand before ingestion | No |
| any other text | The capture item failed the ingester's per-item check and was rolled back | Yes, at the next pull. After three check failures the ingester holds it, and the reason becomes `held: …` |

Once a row has been pulled, the connector ignores edits to its content and to its Status.
The only exception is a stopped row set back to `New`. If a pulled row's status lags its
vault outcome, the next pull corrects it (shown as "status caught up").

## Pull run

In order:

1. **Can-start checks** (the preflight). If any fails, exit 2 with nothing changed.
2. **Lock.** Take `.state/ingest-inbox/lock`. If it's held, exit 3.
3. **Recover.** For each ledger `intent` with no `pulled` record, record it as pulled if
   its capture item exists (or the ingester's ledger names it). A capture item whose
   frontmatter `source_id` names a different row is never adopted, and the row is
   re-pulled instead.
4. **Query** rows whose Status isn't `Ingested`.
5. **Catch up.** Set `Ingested` and clear Reason on pulled rows that the ingester's ledger
   shows as ingested.
6. **Select.** Pulled items still waiting for ingestion come first, then eligible rows,
   oldest first by `(created_time, row ID)`, at most 10 in total. Eligible rows are
   unpulled, not stopped (unless set back to `New`), and either `New`, blank, or `Failed`
   by a pull failure. The rest wait for later runs.
7. **Per row:** read and convert the row, record `intent`, create the capture item
   (exclusive create), record `pulled`, ingest it through the ingester's session, set
   Status and Reason, and record the outcome. No new row starts after 40 minutes.
8. **Close** the ingester session, append the daily-note block if any row was processed,
   record `run-end`, and exit.

If Notion becomes unreachable or rejects the key, or the agent provider fails, the run
stops with exit 4. Rows already completed keep their outcome, and nothing is recorded
against the rest.

## Limits

| Limit | Value |
|---|---|
| Rows processed per run | 10, including pulled items waiting for ingestion. Fixed (#16) |
| Order | `created_time` ascending, ties by row ID. Notion rounds `created_time` to the minute |
| Consecutive pull failures before a row stops | 3 |
| Start cutoff | No new row starts after 40 minutes |
| Nested block depth read | 4 levels |
| Reason length | 2,000 characters, with an ellipsis |
| Request timeout | 30 seconds |
| Rate limiting (429) | Waits for `Retry-After` (capped at 60 s), up to 5 retries, then stops the run with exit 4. A rate limit never counts as a row failure |
| Pull overhead | At most 5 minutes outside ingestion for 10 rows of up to 2,000 words each (target 1 minute). Recorded as `pullMs` in `run-end` |
| API | Host `https://api.notion.com` only, `Notion-Version: 2025-09-03`, redirects refused |

## Capture item

One Markdown file per pulled row in `00-inbox/capture/`.

**Filename:** `notion-<slug>-<row id>.md`

- `<slug>`: the title in kebab case, ASCII only, at most 48 characters. `capture` if the
  title gives nothing usable (for example, an untitled row).
- `<row id>`: the row's full Notion ID, 32 lowercase hex characters, without dashes.

The name is the same every time for the same row, and two rows never share one, even if
they have the same title.

**Content:**

```markdown
---
source: notion
source_id: "<row ID as Notion returns it>"
captured: "<row created_time>"
---

# <title, or "Untitled capture">

<body as Markdown>

URL: <URL column, when set>

Left out: 1 image, 2 files.

Area or project: [[<slug>]]
```

The URL, Left out and Area or project lines appear only when they apply. The Area or
project line appears only if the slug names an existing `20-areas/<slug>.md` or
`10-projects/<slug>.md`. The row's own Notion page address is never written. The row ID
is only in frontmatter, which the ingester's URL extraction ignores.

**Supported content:**

- paragraphs
- headings 1–3 (as `#` to `###`)
- bulleted and numbered list items, nested
- to-dos (`- [ ]` / `- [x]`)
- links in text (`[text](url)`); bookmarks and link previews become links

Text styling is dropped and the text is kept.

**Left out**, and counted by kind in the `Left out:` line: images, files, PDFs, video,
audio, embeds, code blocks, quotes, callouts, toggles, tables, dividers, subpages,
databases, column layouts, equations, synced blocks, tables of contents, breadcrumbs,
templates, page links, and any other block type (as "unsupported block").

## Stopped-row ask

Raised once per stop episode in `00-inbox/`. The filename is
`YYYY-MM-DD-notion-stopped-<slug>.md`, with `-2`, `-3` and so on added if the name is
taken, and the slug is at most 40 characters. The frontmatter follows the vault note format with
`type: reference`, `source: notion` and `source_id`. It has no `ingest_item` field, so
the ingester ignores it. The body names the row and the last reason, and says to set
Status to New to retry.

## Daily-note block

Appended to `daily/YYYY-MM-DD.md` (UTC date) when a run processes at least one row:

```markdown
## Phone capture (HH:MM UTC)

- 2 ingested, 1 held from phone capture
- Resources: [[note-a]], [[note-b]]
- Asks: [[2026-01-01-ask-name]]
```

The counts are ingested (always shown), held, failed, stopped and "status caught up",
each when non-zero. The ingester writes its own block as well.

## Ledger

`.state/notion-pull/ledger.jsonl`. It's append-only JSON Lines, synced after each
append. A run that changes nothing leaves it byte-identical.

| `event` | Fields | Meaning |
|---|---|---|
| `run-start` | `run` | Written just before a run's first change |
| `intent` | `run`, `id`, `capture` | About to create this row's capture item |
| `pulled` | `run`, `id`, `capture`, `sha256` | The capture item exists. `sha256` is `recovered` when recovery adopted it |
| `item` | `run`, `id`, `capture`, `outcome`, optional `reason`, `ask`, `strike` | One outcome: `ingested`, `held`, `failed` (`strike: true` for a pull failure), `stopped`, `resumed` (a stopped row set back to New) or `synced` (status caught up) |
| `run-end` | `run`, `counts`, `pullMs`, `exit` | The run's outcome counts, time outside ingestion, and exit code |

`run` is the run's UTC timestamp. Where a row has several `intent` or `pulled` records,
the latest one wins: the capture name a row maps to is its latest `pulled` name, or
failing that its latest `intent`.

## Estate registry entry

A scheduled pull is registered in `control/estate.local.yaml` like the `notion-pull`
example in `control/estate.example.yaml`:

| Field | Value |
|---|---|
| `script` | `task -d ${repos}/<vault checkout> notion:pull` |
| `schedule` | The crontab expression, character for character |
| `ledger` | `.state/notion-pull/ledger.jsonl` |
| `gate` | `built-in per-item check; task notion:pull:preflight checks readiness` |
| `commits` | `false`, with a `note` saying every output is gitignored vault content or local state (ADR-0006) |
| `branch` | `null` |

Origin: #21

# How-to: Notion capture tasks

Goal-oriented guides for running the Notion capture connector. They assume setup has
already been done once (see the [tutorial](../tutorials/notion-first-phone-capture.md)).
Commands run from the root of the vault checkout.

- [Schedule the pull and register it](#schedule-the-pull-and-register-it)
- [Reconnect after the inbox is deleted or unshared](#reconnect-after-the-inbox-is-deleted-or-unshared)
- [Rotate the integration key](#rotate-the-integration-key)
- [Retry a Failed row](#retry-a-failed-row)
- [Run against a throwaway test workspace](#run-against-a-throwaway-test-workspace)

## Schedule the pull and register it

A job that isn't in the estate registry is invisible, so you add the cron entry and the
registry entry together.

1. **Check the pull can run.**

   ```bash
   task notion:pull:preflight
   ```

   It must exit 0.

2. **Pick a schedule.** The pull assumes no interval between runs, so any schedule
   works. Each run takes at most 10 rows. Three times a day is a reasonable start:
   `0 7,13,19 * * *`.

3. **Add the crontab line** with `crontab -e`. Cron doesn't source your shell profile,
   so put `task` and `node` on `PATH` in the crontab itself. Use real paths here: the
   crontab is local to your machine.

   ```
   PATH=<dir containing task>:<dir containing node>:/usr/bin:/bin
   0 7,13,19 * * * cd <vault checkout> && task notion:pull >> <log dir>/notion-pull.log 2>&1
   ```

   Claude Code must be logged in for the user the crontab belongs to.

4. **Register the job** in `control/estate.local.yaml`. Copy the `notion-pull` entry
   from `control/estate.example.yaml` and adjust it:

   ```yaml
   - id: notion-pull
     description: Pull the Notion capture inbox into 00-inbox/capture/ and ingest it, up to 10 items per run.
     repo: ${repos}/<vault checkout>
     script: "task -d ${repos}/<vault checkout> notion:pull"
     schedule: "0 7,13,19 * * *"          # exactly the crontab expression
     ledger: .state/notion-pull/ledger.jsonl
     gate: "built-in per-item check; task notion:pull:preflight checks readiness"
     commits: false
     branch: null
     log: ${logs}/notion-pull.log
     tier: standard
     max_silence_hours: 30                # longer than the longest gap in your schedule
     status: healthy
     note: >-
       commits: false is deliberate: every file this job writes is gitignored vault
       content or local state (ADR-0006). Its only other writes are the Status and
       Reason of the rows it processes in Notion. PATH must include task and node.
   ```

   - `schedule` must match the crontab expression character for character.
   - Keep `commits: false` *with* its `note`. `task doctor` fails a `commits: false` job
     that has no note.
   - Use the `${repos}` and `${logs}` placeholders from `control/roots.local.yaml`, not
     real paths.

5. **Verify.**

   ```bash
   task doctor
   ```

   The registry checks pass, and check 9 reports `control/notion.local.yaml` as
   gitignored, mode 600 and parsing. After the first scheduled run, the log shows the
   run and, if any row was processed, today's note in `daily/` has a *Phone capture*
   block.

To stop the job, remove the crontab line and the registry entry in the same change.

## Reconnect after the inbox is deleted or unshared

**Symptom:** `task notion:pull:preflight` or a pull exits 2 with *the source inbox
(database …) isn't accessible: it was deleted, or unshared from the integration*. Setup
says the same.

Work out which it is in Notion, then follow the matching case.

**The inbox still exists but lost its connection.** For example, the integration was
removed from the page.

1. Open the *Capture inbox*, or its parent page, and open its **...** menu.
2. Choose **Connections** and add the integration again.
3. Run `task notion:pull:preflight`. It exits 0.

Nothing else changes. The config, the ledger and every row's status are as they were.

**The inbox is in Notion's trash.**

1. Restore it from **Trash**.
2. Check that its connection is still there, as above.
3. Run `task notion:pull:preflight`.

**The inbox is gone for good.** Start over with a new inbox:

1. Delete the config:

   ```bash
   rm control/notion.local.yaml
   ```

2. Share a parent page with the integration (page **...** menu, then **Connections**),
   and run setup with its link. Paste the integration's secret at the prompt.

   ```bash
   task notion:setup -- "<page link>"
   ```

3. Run `task notion:pull:preflight`.

The ledger (`.state/notion-pull/ledger.jsonl`) can stay, because it's keyed by row ID and
the new inbox's rows have new IDs. Captures already ingested stay in the vault. Rows the
old inbox held that were never pulled are lost with it, so add them again in the new
inbox.

## Rotate the integration key

Do this if the secret may have leaked, or as routine hygiene. Don't re-run setup for
this. With a config present, setup never asks for a key, and deleting the config makes
setup create a new inbox.

1. **Regenerate the secret** on the integration's page in Notion (**Settings**,
   **Connections**, **Develop or manage integrations**, then your integration). The old
   secret stops working at once. Any pull that runs before step 2 exits 2 with *Notion
   rejected the API key*, and changes nothing.
2. **Replace `api_key`** in `control/notion.local.yaml` using an editor:

   ```bash
   $EDITOR control/notion.local.yaml
   ```

   Don't use `echo` or `sed` with the secret on the command line, because that leaves it
   in your shell history and the process list.
3. **Keep the file private.**

   ```bash
   chmod 600 control/notion.local.yaml
   ```

4. **Verify.**

   ```bash
   task notion:pull:preflight
   task doctor
   ```

   The preflight exits 0, and doctor check 9 passes.

## Retry a Failed row

A row's **Reason** says what kind of failure it is, and that decides what you do. See
the [reasons table](../reference/notion-capture/connector.md#statuses) for every reason.

| Reason starts with | What to do |
|---|---|
| `couldn't read the row`, `couldn't convert the row`, `couldn't write the capture item` | Nothing. The next pull retries it automatically. If it fails three runs in a row, it stops: see the next row of this table |
| `stopped: set Status to New to retry` | Fix the cause if you can. The ask in `00-inbox/` (`…-notion-stopped-…`) shows the last reason. For example, remove content the connector can't read. Then set the row's **Status** to **New** in Notion. The next pull retries it with its failure count reset. Delete the ask once the row is Ingested |
| `held: …; see ask <file>` | Open that ask in `00-inbox/` and do what it says. Typically you add an `[[area-or-project]]` link to the capture item in `00-inbox/capture/`, or create the area it needs and delete the ask. Then run `task ingest-inbox`, or let the scheduled ingester run. The next pull sets the row to **Ingested** and clears Reason. Changing Status in Notion does nothing here |
| `a capture item named … already exists` | A file with that name is already in `00-inbox/capture/`, and it isn't this row's. Move or remove it. The next pull retries the row |
| anything else | The capture item failed the ingester's check and was rolled back. The next pull retries it. After three check failures the ingester holds it, and the Reason changes to `held: …` |

To see the full history of one row, search the ledger for its ID as Notion writes it,
with dashes. That's the `source_id` in the capture item's frontmatter. The capture item's
filename carries the same ID without dashes.

```bash
grep '<source_id>' .state/notion-pull/ledger.jsonl
```

## Run against a throwaway test workspace

Use this when changing the connector, or to try it without touching your real Notion
workspace. Never point tests at the real one.

**Prepare the workspace.**

1. Create a separate Notion workspace for testing.
2. In it, create an internal integration (read, update and insert content), and copy
   its secret.
3. Create a test page and add the integration to it under **Connections**.

**Use a separate checkout.** The connector's config path is fixed:
`control/notion.local.yaml` in the checkout you run from. Run the test from a checkout
that isn't your daily vault, such as the framework-development clone.

1. Install and seed the areas:

   ```bash
   task install
   task bootstrap-areas
   ```

2. Connect the test page:

   ```bash
   task notion:setup -- "<test page link>"
   ```

3. Add rows in the test inbox, from the app or the web.
4. Pull them:

   ```bash
   task notion:pull:preflight
   task notion:pull
   ```

A real pull runs the ingester's agent, so it uses Claude Code and your model quota. It
writes real, gitignored vault content into that checkout: capture items, resource notes,
archived originals, asks, daily-note blocks, and both ledgers under `.state/`. Clean
these up afterwards, and delete the test inbox in Notion.

**Run the live API spike.** `integration/notion/test/live/spike.live.ts` checks the
connector's assumptions about the Notion API against the test workspace. It creates
databases under the test page and moves them to the trash when it's done.

1. Put the variables in an env file outside the repository, so the key stays out of
   your shell history:

   ```bash
   # e.g. $HOME/.notion-test.env, mode 600
   NOTION_TEST_KEY=<test integration secret>
   NOTION_TEST_PAGE_ID=<32 hex characters>
   ```

   `NOTION_TEST_PAGE_ID` must be the **bare 32-hex page ID**. The spike passes it to the
   API as-is, unlike `task notion:setup`, which parses links. From a link like
   `https://www.notion.so/Test-page-<id>?…`, take only the 32 hex characters after the
   last hyphen, without the `?…` part.

   Optional variables:

   | Variable | Purpose |
   |---|---|
   | `NOTION_TEST_UNSHARED_PAGE_ID` | A page *not* shared with the integration, for the negative case |
   | `NOTION_TEST_OLD_KEY` | A regenerated (dead) secret, to check it gets 401 |
   | `NOTION_TEST_VERSION` | A `Notion-Version` to try instead of the pinned one |

2. Run only the spike:

   ```bash
   set -a; . "$HOME/.notion-test.env"; set +a
   node --test integration/notion/test/live/spike.live.ts
   ```

   `npm run test:live` runs the spike along with the ingester's Claude Code live tests.

The checks print their results as `FINDING A1: …` through `FINDING A5: …` lines. Without `NOTION_TEST_KEY` and
`NOTION_TEST_PAGE_ID`, every check is skipped. If a finding differs from the ones in
[ADR-0008](../adr/0008-credentialed-egress-for-capture-source-connectors.md#live-api-findings),
update that ADR and the header of `integration/notion/src/adapters/notion/http-client.ts`.

Origin: #21

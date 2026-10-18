# Tutorial: your first phone capture

In this tutorial you connect mycelia to Notion, capture a note on your phone, and watch
it arrive in the vault as a linked resource note. It takes about fifteen minutes. At the
end you'll have a working *Capture inbox* in Notion and you'll have seen one capture go
through end to end.

You'll run each step by hand. Scheduling comes afterwards, in
[the how-to guides](../how-to/notion-capture.md#schedule-the-pull-and-register-it).

## Before you start

You need:

- a mycelia checkout where `task install` has run, with
  [go-task](https://taskfile.dev/installation/) and Node.js 22.18 or later
- Claude Code installed and logged in on this machine, which the ingester uses
- at least one note in `20-areas/` or `10-projects/` (run `task bootstrap-areas` if you
  have none)
- a Notion account, and the Notion app on your phone
- outbound HTTPS to `api.notion.com`

Check that the ingester itself is ready:

```bash
task ingest-inbox:preflight
```

If that fails, fix what it reports first. Phone capture runs through the ingester.

## 1. Create a Notion integration

1. In Notion, open **Settings**, then **Connections**, then **Develop or manage
   integrations**.
2. Create a new **internal** integration for your workspace. Name it something you'll
   recognise, such as *mycelia*.
3. Give it the capabilities to **read content**, **update content** and **insert
   content**.
4. Copy the integration's **secret**. You'll paste it once, in step 3. Don't put it in a
   file or a note.

## 2. Share a page with the integration

The connector can create its database only under a page your integration can see.

1. Create a page called *Capture* (any name works).
2. Open the page's **...** menu, choose **Connections**, and add your integration.
3. Open **Share** and choose **Copy link**. Keep the link for the next step.

## 3. Run setup

From the root of your checkout, run setup with the page link in quotes:

```bash
task notion:setup -- "<the link you copied>"
```

When it asks for `Notion integration secret (input hidden):`, paste the secret and press
Enter. Nothing shows as you paste. That's expected.

You should see a line like:

```
Created the source inbox "Capture inbox" (database …, status as status); settings saved to control/notion.local.yaml. …
```

Back in Notion, the *Capture* page now holds a database called **Capture inbox**, with
one row: *How to capture (read me)*. Open that row and read it. It's written for you on
your phone.

Run setup again:

```bash
task notion:setup -- "<the link you copied>"
```

This time it says **Already set up** and names the same database. Setup never creates a
second inbox.

## 4. Check the pull is ready

```bash
task notion:pull:preflight
```

You should see `preflight ok: source inbox (database …) reachable, ingester ready`.
The preflight changes nothing, so you can run it as often as you like.

## 5. Capture something on your phone

1. Open the Notion app and go to **Capture inbox**.
2. Add a row. Give it a title, such as *Agentic workflows*.
3. Open the row and write a line or two in its page: a short paragraph, or a bullet
   list.
4. Optionally, paste a link into the **URL** column, and put the name of one of your
   area notes (for example `career`) in **Area or project**.

Leave **Status** alone. A new row starts as **New**, which means "waiting to be pulled".

Give the app a moment to sync.

## 6. Pull it into the vault

On the machine, run one pull:

```bash
task notion:pull
```

The log shows the row being processed and ends with it **ingested**. It takes a minute
or so, because the ingester's agent reads your capture and decides where it belongs.

## 7. See where it went

- **In Notion**, on your phone: the row's Status now reads **Ingested**. The
  instructions row is untouched.
- **In `30-resources/`**: there's a new note for your capture, with a summary and key
  takeaways, linked from the area or project it fits.
- **In `40-archive/capture/`**: the original capture item is there, named
  `notion-agentic-workflows-<32 hex characters>.md`. Open it to see what the connector
  wrote: frontmatter with `source: notion`, the row's ID as `source_id`, and the time
  it was captured, then your title and text.
- **In `daily/`**: today's note has a **Phone capture** block saying
  `1 ingested from phone capture`, with a link to the new resource note.

Run the pull once more:

```bash
task notion:pull
```

It finds nothing to do and changes nothing. A row is pulled only once, and edits you make
to it afterwards are ignored.

## What you've done

You connected a Notion inbox to the vault, captured a note on your phone, and saw it
filed as a linked resource note, with its outcome shown back on the phone.

Next:

- Schedule the pull and register it in your estate:
  [how-to guides](../how-to/notion-capture.md).
- Look up what each status and reason means:
  [reference](../reference/notion-capture/connector.md#statuses).
- Understand why the connector works the way it does:
  [explanation](../explanation/notion-capture/overview.md).

Origin: #21

---
name: capture-readme
description: What the capture folder is for — material dropped here is ingested daily into linked 30-resources/ notes
type: reference
created: 2026-10-04
updated: 2026-10-04
---

Drop anything you want to keep and come back to here: pasted text, a note, or just a
link. You don't need to paste the article; the ingester fetches a link's content itself.

**What happens next.** Once a day, `task ingest-inbox` takes the items in this folder,
oldest first, up to 10 a run. Each one becomes a note in `30-resources/` with a summary
and key takeaways, linked to the areas and projects it serves, and the original moves to
`40-archive/capture/`.

**Choosing where it goes.** Add an `[[area-or-project]]` link to the item and it's placed
there. Otherwise the ingester picks from your existing `20-areas/` and `10-projects/`
notes.

**When an item can't be placed** (nothing fits, a link can't be fetched, the file type
isn't supported), it stays here unchanged and the ingester raises one ask about it in
`00-inbox/`. Decisions and asks never live in this folder, and nothing else in
`00-inbox/` is ever ingested.

**Supported:** `.md` and `.txt` files. PDFs and images aren't supported yet.

**Good to know.**

- To work out where an item belongs, the ingester's agent may read notes anywhere in the
  vault except `control/`, `.state/`, hidden folders and `node_modules/`. Keep secrets
  out of ordinary notes.
- Links are fetched directly; environment proxies aren't used.
- Everything here stays on your machine: this folder's contents are gitignored, and only
  this README is part of the framework.

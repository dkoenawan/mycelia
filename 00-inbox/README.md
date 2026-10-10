---
name: inbox-readme
description: What belongs in the inbox and how it gets cleared
type: reference
created: 2026-08-01
updated: 2026-10-04
---

# 00-inbox

Anything needing the operator's decision, and anything captured but not yet filed.

This is the **only** queue the operator is expected to triage. Keep it short and keep every item
actionable — noise here defeats the purpose of the whole system. Agents write here when a
decision is genuinely theirs; otherwise they land the work behind a gate and report it in the
daily note.

The inbox has two uses:

- **`00-inbox/capture/`** — material to be ingested: pasted text, a note, or just a link.
  `task ingest-inbox` turns each item into a linked `30-resources/` note and archives the
  original. See `capture/README.md`.
- **The rest of `00-inbox/`** — decisions and asks for the operator, including the asks the
  ingester raises when it can't place a capture. These are never ingested.

New notes created in Obsidian default to `00-inbox/capture/`, where they're ingested the next
morning. A note meant for a specific project or area can be created in that folder too — add an
`[[area-or-project]]` link to it and it's placed there.

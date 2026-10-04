---
id: "006"
title: Inbox capture ingestion — a capture subfolder, a confined read-only agent, and a capped batch
date: 2026-10-04
status: proposed
deciders: [operator]
---

## Context

`00-inbox/` is the operator's only triage queue (CLAUDE.md, "Where things go"), but it
was doing two jobs: holding decisions and asks that agents raise for the operator, and
holding raw material the operator drops in to read later (pasted text, a bare link).
Raw material piled up and was never turned into reusable `30-resources/` notes linked
from the areas and projects they serve, so the queue the operator is meant to keep
short kept growing. Tracked in issue #12; the full requirement set and design are in
`docs/sessions/2026-09-28-inbox-resource-ingestion/`.

Three constraints make the decision non-obvious:

- **Shared inbox.** Agent-raised decisions must never be ingested, moved or edited
  (OUT-03). Whatever marks a note as "material" has to be unmistakable.
- **Untrusted input next to private notes.** Captures, and the pages they link to,
  come from outside. The agent that summarises them should be able to read the vault
  to judge where they belong, which means private notes and hostile text meet in one
  context (OUT-06).
- **Runner rules written for committing jobs.** CLAUDE.md says one unit of work per
  run and that `commits: false` is a defect. An ingester whose every output is
  gitignored vault content can't commit it without breaking ADR-0002.

## Decision Drivers

- OUT-03: the inbox's decision queue is never touched by ingestion.
- OUT-06: a hostile capture or page can't write outside the item's write set, reach
  configuration or secrets, or send anything off the machine.
- The framework/configuration boundary (ADR-0002): vault content stays local.
- The one-queue rule: anything the ingester can't place becomes exactly one
  actionable ask, never a pile.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Capture subfolder `00-inbox/capture/` (chosen)** | Structural, visible in Obsidian, can't be set by accident; the rest of `00-inbox/` is untouched by construction | One more folder; Obsidian's new-note folder has to point at it | — chosen |
| A frontmatter marker on inbox notes | No new folder | `.txt` and pasted notes have no frontmatter; a missing marker silently ingests or silently skips | Easy to get wrong in both directions |
| A new top-level capture folder | Fully separate from the inbox | A second place the operator has to look; breaks "the inbox is where things arrive" | More surface for the operator |
| **A tool-using agent with read-only tools, confined by a hook in the ingester (chosen)** | Can read target bodies and nearby notes to decide placement; enforcement is code the ingester owns and tests | Wider read exposure to an injected agent | — chosen |
| A tool-less model given a catalogue | Smallest exposure | Can't read a target's body; placement is guessed from descriptions | Placement quality |
| An agent with WebFetch | Simplest fetching | Private-note reads, outbound requests and untrusted input in one agent form an exfiltration channel | Rejected (D6) |
| **A capped batch, up to 10 items per run (chosen)** | A daily run keeps up with a normal day's captures | Departs from "one unit of work per run" | — chosen, with per-item gates |
| One item per run | Matches the runner rule literally | A day's captures take a week to clear | Doesn't keep the queue short |
| **`commits: false`, outputs gitignored (chosen)** | Vault content stays local (ADR-0002) | Departs from "`commits: false` is a defect" | — chosen, with a required `note` |
| Commit outputs to a branch | Matches the runner rule literally | Commits vault content into the framework repo | Breaks ADR-0002 |

## Decision Outcome

Chosen: **only `00-inbox/capture/` is ingested**, by a deterministic TypeScript runner
(`task ingest-inbox`, ADR-0007) whose one model-driven step is an agent with read-only
tools.

- **Scope of ingestion.** Files directly in `00-inbox/capture/` other than its README
  and dot-files. Everything else under `00-inbox/` is read only for ask frontmatter, and
  only asks the ingester itself created (and recorded in its ledger) are ever modified
  or moved.
- **Read scope (operator's choice, Q5).** The agent may read the whole vault with Read,
  Glob and Grep, except `control/`, `.state/`, every hidden folder at any depth and
  `node_modules/`. A PreToolUse hook in the ingester's own code enforces this, backed by
  a `canUseTool` callback; settings files aren't loaded. Reads are limited to `.md` and
  `.txt` files of at most 256 KB, and searches can't be rooted at the repository root.
- **No egress is the main containment.** The agent has no network, shell, write,
  sub-agent or MCP tools. URLs are fetched by deterministic code before the agent runs,
  only for URLs in the capture item, GET only, with private addresses refused at connect
  time. The agent's only output is one JSON object; links to URLs that weren't in the
  capture are removed from model text, so even a clicked link in the resulting note
  can't carry data out.
- **Six injection layers**, from input to disk: (1) HTML cleaning that drops hidden text,
  scripts, comments and invisible characters; (2) a system-prompt instruction hierarchy
  with nonce-delimited untrusted blocks, and tool output treated as data; (3) the
  capability confinement above; (4) output validation with a per-call canary and an
  allow-list of existing area and project slugs; (5) rendering where the ingester picks
  every path and sanitises every string; (6) a post-write check with exact diffs, a
  write-set assertion and rollback.
- **Worst case accepted.** A successful injection can skew one resource note's content,
  place it under up to three wrong but existing areas or projects, force a single ask,
  copy text from an in-scope note into that one local note, or waste its own item's
  turn and time budget. It can't write, move or delete any file, choose a path, read
  `control/`, `.state/`, hidden folders or anything outside the repository, run
  commands, make network requests, or affect another item. Denied tool calls and
  `injection_suspected` flags are pushed to the daily note.
- **The capped batch** — the agreed departure from "one unit of work per run": up to 10
  eligible items per run, oldest first by modified time then name, each with its own
  journal, check, rollback and ledger record. The CLAUDE.md runner rule carries a
  pointer to this exception.
- **`commits: false`** — the agreed departure from "`commits: false` is a defect", for
  jobs whose every output is gitignored vault content or local state. Such a job must
  carry a `note` in the registry saying so; `doctor.sh` check 7 already enforces a note
  for every `commits: false` job.
- **Local state.** The ledger and the per-item journal live in `.state/ingest-inbox/`,
  gitignored. Holds are visible in the ask notes' own frontmatter, so a lost ledger
  can't cause a repeat ask.
- **Obsidian.** The committed `.obsidian/app.json` sets the new-note folder to
  `00-inbox/capture` (Q1) and ignores `node_modules/` in Obsidian's views.
- **Platforms.** Linux and macOS. Windows is untested in the MVP; use WSL (D17).
- **Proxies.** The fetcher ignores environment proxies; supporting `HTTPS_PROXY` is a
  follow-up.

## Consequences

- **Now easier:** the operator drops text or a bare link into one folder and finds a
  linked, summarised resource note the next morning; anything that can't be placed
  becomes exactly one ask.
- **Now harder:** the read scope means an injected agent can see most of the vault.
  Secrets don't belong in ordinary notes; they belong in `control/*.local.*` or outside
  the vault, which the agent can't read. The model provider sees whatever the agent
  reads, as in any Claude Code session over the vault.
- **New constraints:** the ingester never runs `git add`, `git commit` or `git checkout`,
  and refuses to start if any path it writes isn't gitignored. Any new job declaring
  `commits: false` must meet this ADR's condition and carry a `note`.

## Revisit Conditions

- ADR-0003's condition: resource notes that are rarely linked or reused after a few
  months of ingestion.
- The daily capture volume regularly exceeding the 10-item cap (#16).
- Operators wanting resource notes versioned, which would reopen ADR-0002.
- A stored injection observed in practice (instructions planted in an earlier capture
  or archived original): narrow `readScope()` to exclude `00-inbox/capture/` and
  `40-archive/capture/`.

# mycelia

A framework for running a second brain that your agents feed, instead of one you feed.

Most personal knowledge systems fail the same way: they need constant input, the input is
work, and the work is the thing you were trying to reduce. Mycelia inverts that. Scheduled
agents do the writing; you read a digest and steer. The vault is plain Markdown in git, so
it stays yours, portable, and readable without this tool.

> **Status: early.** Layers 0 and 1 are usable. Circulation and growth are specified but
> not built. See [Roadmap](#roadmap).

## The idea

A mycelial network connects separate organisms, routes nutrients between them, and grows.
Mycelia does the same three things for the systems you already run:

1. **Connect** — one registry that knows every scheduled job, repo, and agent you have.
2. **Route** — move information to where it is needed, so you stop being the message bus.
3. **Grow** — capture every correction once, so each cycle starts from a higher floor.

## Why a registry comes before note-taking

If you already run scheduled agents, you have probably met these failure modes:

- **Silent death.** A shared credential expires. Every job fails within seconds of its next
  trigger. Each writes to its own log file. Nobody finds out for days.
- **Green but useless.** A job edits files and exits without committing. The logs report
  success every night while the next branch checkout quietly deletes the work.
- **Finished but unlanded.** A branch passes its tests, is never merged, and a later agent
  keeps improving the thing that branch was meant to replace.
- **Drift.** A queue is exhausted, nothing re-aims the agent, and it spends months producing
  progressively less valuable work — still reporting success the whole time.

None of these are capability problems. The agents work. What is missing is something that
knows what *should* be running and notices when it isn't. That is the estate registry, and
it is why mycelia starts there.

## Layout

```
mycelia/
├── 00-inbox/       # the only queue you triage
├── 10-projects/    # PARA: active, time-bound
├── 20-areas/       # PARA: ongoing responsibility — life admin included
├── 30-resources/   # PARA: reference, standards, captured corrections
├── 40-archive/     # PARA: done or dormant
├── daily/          # agent-written daily notes
├── control/        # the estate registry, the areas manifest, and their schemas
├── scripts/        # bash runners, and the shared library they build on
├── src/            # TypeScript runners (the inbox ingester) and their shared library
├── test/           # tests for src/, run by `task check:node`
└── handoff/        # TUI design specification
```

PARA is used because it is well-understood and tool-agnostic. The vault opens in Obsidian
with no plugins; `.obsidian/app.json` is committed so the config is reproducible.

## Install

```bash
git clone <this-repo> mycelia && cd mycelia
cp control/roots.example.yaml  control/roots.local.yaml    # your paths
cp control/estate.example.yaml control/estate.local.yaml   # your jobs
$EDITOR control/roots.local.yaml control/estate.local.yaml
```

Then open the directory in Obsidian, or just use it as files.

## Framework vs. configuration

This repository holds **fundamentals only**. Your estate never enters it:

| Committed — the framework | Local — your configuration |
|---|---|
| Vault structure and conventions | Every note you write |
| `control/*.example.yaml` (schema, documented) | `control/*.local.yaml` (your jobs, real paths, and areas) |
| `scripts/lib/common.sh`, `src/` | `FEEDBACK.md`, logs, Obsidian workspace state |
| `package.json` and its lockfile | `node_modules/`, runner state in `.state/` |

Anything matching `*.local.*` is gitignored, as is all vault content — the PARA directories
ship with only a README explaining what belongs inside them.

Keep that boundary if you fork this. It is what lets you pull framework updates without
merge conflicts against your own notes, and what keeps paths, client names, and personal
material out of a public repository.

## Inbox ingestion

Drop pasted text, a note, or a bare link into `00-inbox/capture/` (Obsidian's new-note
folder). The ingester turns each item into a `30-resources/` note with a summary and key
takeaways, links it from the areas and projects it serves, and moves the original to
`40-archive/capture/`. Anything it can't place stays where it is, and it raises one ask in
`00-inbox/`. The rest of `00-inbox/` is never ingested. See
[`00-inbox/capture/README.md`](00-inbox/capture/README.md) and
[ADR-0006](docs/adr/0006-inbox-capture-ingestion.md).

**Needs:** go-task, Node.js 22.18 or later, Claude Code installed and logged in (or
`ANTHROPIC_API_KEY` set), and at least one note in `20-areas/` or `10-projects/`
(`task bootstrap-areas` creates the defaults). Linux and macOS; on Windows, use WSL.

```bash
task ingest-inbox:preflight   # check readiness; changes nothing
task ingest-inbox             # one run: oldest first, up to 10 items
```

Schedule it daily like the `inbox-ingest` example in `control/estate.example.yaml`, with
`task` and `node` on the scheduler's PATH. The first run installs the pinned Node
dependencies (`task deps:node`). The ingester never commits. Everything it writes is
gitignored vault content or local state, and its ledger is
`.state/ingest-inbox/ledger.jsonl`. Each run appends a summary block to the day's note in
`daily/`.

Exit codes from `node src/ingest/cli.ts`:

| Code | Meaning |
|---|---|
| 0 | Done, or nothing to do. |
| 1 | At least one item failed its check and was rolled back. The other items were processed. |
| 2 | Can't start, and nothing was changed: the capture folder is missing, an output path isn't gitignored, there are no areas or projects, or Claude Code is missing or logged out. |
| 3 | Another run is in progress. Nothing was changed. |
| 4 | The run stopped early: the agent provider failed mid-run (for example auth or a rate limit), the network was down, or an interrupted earlier run couldn't be rolled back cleanly. No strike is recorded, and the remaining items stay eligible. |

Known issues:

- `task ingest-inbox` reports go-task's exit status 201 for any failure, not the codes
  above. Run `node src/ingest/cli.ts` directly to see the ingester's own code.
- An expired Claude subscription login that `claude auth status` still reports as logged
  in gets past preflight. The run then stops with exit 4, without saying how to log in,
  after it may have written the ledger and, for items held before the first agent call,
  an ask and the daily note. The next run fails preflight with the login message. A rate
  limit gets past preflight the same way. See ADR-0007.
- When a run stops early (exit 4), the daily note doesn't say so.
- A resource note often gets a `-2` suffix, because the archived original already has the
  item's name.

Origin: #12

## Writing a runner

`scripts/lib/common.sh` provides logging, `claude` resolution that survives cron's bare
environment, git-safety helpers, and vault writers. The conventions it enforces are derived
from observed failures, not preference:

- **One unit of work per run**, chosen by a deterministic rule ("the first unchecked item"),
  never "decide what matters most." Undirected agents drift.
- **Keep state in a committed ledger** so a missed day costs nothing — the next run reads
  the ledger and continues.
- **Run a gate before landing.** The gate is what licenses autonomy.
- **On failure, still commit the ledger.** Record what broke, revert the work, stop.
- **Stage named files only.** `git_commit_files` refuses `.` and `-A` by design.
- **Use a dedicated branch, restore the original on exit**, so unattended work never
  collides with what you have checked out.
- **Never swallow errors to keep cron quiet.** A log file nobody reads is not monitoring.

New workflow runners are TypeScript on Node under `src/`, gated by `task check:node`, and
follow the same rules; `src/lib/` mirrors the `common.sh` helpers they need
([ADR-0007](docs/adr/0007-typescript-node-runners-and-agent-provider.md)).

Full detail in [`CLAUDE.md`](CLAUDE.md), which doubles as the instruction file agents read
when working in the vault.

## Roadmap

| Layer | What it does | Status |
|---|---|---|
| 0 — Substrate | Vault structure, conventions, shared runner library | ✅ |
| 1 — Nervous system | Estate registry; health checks that push alerts instead of logging them | ◐ registry done |
| 2 — Routing | Dispatch jobs to model tiers so routine work uses cheaper models | ○ |
| 3 — Circulation | Daily digest; a mobile surface for reading and capture | ○ |
| 4 — Growth | Weekly planner that re-aims the estate; feedback channel that steers it | ○ |
| — Inbox ingestion | Turn captures into linked resource notes, daily | ✅ |
| — TUI | Terminal workspace: tasks, journal, threads, live telemetry | ○ spec in `handoff/` |

## Design commitments

**Plain Markdown in git.** No database, no proprietary store. History, backup, and conflict
resolution come free, and the vault outlives this tool.

**Autonomy is licensed by gates.** Where a machine-checkable gate exists, agents land their
own work. Where none exists, they open a PR and surface it. Review is the exception, not the
default path — because review is where systems like this stall.

**Failures are pushed, not logged.** Monitoring that requires you to go looking is not
monitoring.

## License

MIT

<!-- compass:anchor -->
## Project anchor

### Vision

A second brain that the operator's agents feed, instead of one the operator feeds: the operator reads and steers, and stops being the message bus between their own systems.

### Mission

Mycelia is an installable framework (vault conventions, an estate registry and runner tooling) that lets scheduled agents write, file and connect an operator's knowledge in plain Markdown, and keeps their automated estate visible and healthy, with autonomy licensed by machine-checkable gates.

### Scope

- Vault structure and conventions: PARA directories, note format and linking, as plain Markdown in git, readable without mycelia.
- The estate registry and health checks for scheduled jobs, with failures pushed to the operator rather than logged.
- Runner tooling (the shared library, install and bootstrap scripts) for scheduled agents that land their own work behind gates.
- Agent workflows that capture, file, connect and summarise vault content.
- Framework only: generic defaults and schemas; every operator's notes and estate stay local configuration.

### Non-goals

- Committing an operator's notes, estate or paths to the framework repository, or requiring an instance to be its own repo or fork.
- A database or proprietary store; the vault stays plain Markdown in git.
- Depending on Obsidian plugins.
<!-- /compass:anchor -->

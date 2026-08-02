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
├── control/        # the estate registry and its schema
├── scripts/        # runners, and the shared library they build on
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
| `control/*.example.yaml` (schema, documented) | `control/*.local.yaml` (your jobs and real paths) |
| `scripts/lib/common.sh` | `FEEDBACK.md`, logs, Obsidian workspace state |

Anything matching `*.local.*` is gitignored, as is all vault content — the PARA directories
ship with only a README explaining what belongs inside them.

Keep that boundary if you fork this. It is what lets you pull framework updates without
merge conflicts against your own notes, and what keeps paths, client names, and personal
material out of a public repository.

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

# CLAUDE.md — conventions for agents working in mycelia

This repository is both a **vault** (Obsidian-compatible Markdown) and a **control plane**
(the registry of the operator's automated estate). Read this before writing anything here.

## The one rule

Mycelia exists to **reduce the operator's workload**. Every change should move information toward
them without requiring him to come looking. If a change adds something for them to maintain,
it is probably wrong.

## Note format

Every note carries YAML frontmatter:

```markdown
---
name: <short-kebab-case-slug>        # must match the filename stem
description: <one line — used to judge relevance during recall>
type: project | area | resource | feedback | reference | daily
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

Body. Link related notes with [[wikilinks]] — this is what makes the vault a network
rather than a folder of files. A `[[link]]` to a note that does not exist yet is fine;
it marks something worth writing.
```

For `type: feedback` (a correction the operator made, captured so it never has to be made twice),
always include **Why:** and **How to apply:** lines. The why is what survives; without it the
rule gets misapplied later.

## Where things go

| Directory | Use |
|---|---|
| `00-inbox/` | Anything needing the operator's decision, and anything captured but not yet filed. This is the **only** queue they are expected to triage — keep it short and each item actionable. |
| `10-projects/` | Active, time-bound. Has a finish line. |
| `20-areas/` | Ongoing responsibility with no finish line — client engagements, life admin, health, finances. |
| `30-resources/` | Reference that applies across projects: standards, patterns, playbooks. Migrated corrections live here. |
| `40-archive/` | Finished or dormant. Move, don't delete — history is the point. |
| `daily/` | `YYYY-MM-DD.md`, one per day, agent-written. |

## The estate registry

`control/estate.local.yaml` is the single source of truth for every automated job. **A job
that is not registered is invisible**, and invisible failures are the ones that last for
days. If you add, change, or retire a scheduled job anywhere, update the registry in the
same change.

The committed `control/estate.example.yaml` documents the schema and is the file to read
when you need to know what a field means. The `.local.` version is the operator's actual
estate and is never committed.

Schema, one entry per job:

| Field | Meaning |
|---|---|
| `id` | Unique, kebab-case. |
| `repo` | Path to the repo it operates on, written with `${roots}` placeholders. |
| `script` | Path to the runner, same placeholder rules. |
| `schedule` | Cron expression, matching the live crontab exactly. |
| `ledger` | Repo-relative committed file holding progress state, or `null`. |
| `gate` | Command that must pass before work may land, or `null` if none exists. |
| `commits` | Whether the job commits its own work. **`false` is a defect**, not a configuration — it means the job's output is lost on the next branch switch. |
| `branch` | Branch it commits to. A dedicated branch is safer than `main`. |
| `log` | Path to its log file, same placeholder rules. |
| `tier` | `cheap` \| `standard` \| `deep`. Declared now, unused until the routing layer exists. |
| `max_silence_hours` | Health check flags the job if it has not run within this window. |
| `status` | `healthy` \| `degraded` \| `broken` — current known state, with a `note` explaining anything not healthy. |

## Framework vs. configuration — the boundary that matters most

Mycelia is a **framework other people install**. The operator's estate is a *configuration*
of it. These never mix.

**Committed (the framework):** vault structure, conventions, `scripts/lib/`, and
`control/*.example.yaml` — schema and documentation, using fictional jobs.

**Local (the configuration):** `control/*.local.yaml`, `FEEDBACK.md`, logs, and **all vault
content**. The PARA directories ship with only a README; everything written into them stays
on the machine.

When you learn something from a real incident, commit the *lesson*, never the incident.
"A job that does not commit its own work will lose it to the next checkout" belongs in the
framework. Which repo it happened in, on what date, does not.

This repository is public and world-readable. Before writing anything, assume a stranger
will read it.

**Never commit:**
- Real names, email addresses, or usernames — including in paths like `/home/<user>/…`.
- Client, employer, or customer names. Refer to engagements by neutral alias
  (`side-business`, `client-a`), and keep the mapping in the gitignored roots file.
- Absolute filesystem paths. Use the `${home}` / `${repos}` / `${logs}` placeholders
  defined in `control/roots.example.yaml`.
- Credentials, tokens, hostnames, or internal URLs.

**Where machine-specific truth lives:** `control/roots.local.yaml`, gitignored. It is the
only file that maps placeholders to real directories. This keeps the registry publishable
*and* keeps the estate portable to another machine — the privacy constraint and the
portability win are the same change.

**When writing prose,** refer to the human as "the operator" and use they/them. Vault
*content* under `10-projects/`, `20-areas/`, etc. is the operator's own material and may
name whatever they choose; this rule governs the committed framework — README, CLAUDE.md,
`control/`, and `scripts/`.

## Writing runners

Scripts in `scripts/` source `lib/common.sh`. The patterns below are not stylistic
preferences — each is derived from a failure mode that recurs in unattended agent work.

**Do:**
- `set -euo pipefail`, and validate inputs before doing anything.
- Resolve `claude` explicitly; cron does not source a shell profile.
- **One** unit of work per run, chosen by a *deterministic* rule ("the first unchecked item"),
  never "decide what is most valuable". Undirected agents drift.
- Keep state in a **committed ledger** so a missed day costs nothing.
- Run a **gate** before landing anything. The gate is what licenses autonomy.
- On failure: revert the work, record the failure in the ledger, commit *the ledger only*, stop.
  A failed run should still leave a trace of why.
- Stage **named files only**. Never `git add -A` or `git add .`.
- If you change branches, restore the original branch before exiting.

**Do not:**
- Leave work uncommitted at exit. The next branch checkout destroys it silently, while the
  logs still read as success. This is the most expensive failure in unattended agent work.
- Swallow errors to keep cron quiet. Suppressing a non-zero exit removes the only alert
  channel a scheduled job has, and outages then last as long as nobody happens to look.
- Pipe through `tee` into a log the scheduler already redirects to — it duplicates every line.

## Working with the operator

- Assume high technical fluency — a senior engineer or architect. Skip basics.
- Report outcomes plainly. If something failed, say so with the evidence.
- Prefer landing work behind a gate over asking. Asking is the expensive path — it puts them
  back in the loop, which is the thing mycelia exists to prevent.
- When a decision genuinely is theirs, write it to `00-inbox/` as a note with a clear ask,
  rather than blocking on it.

## Two checkouts, two roles — do not conflate them

There is one framework repo (`github.com/<owner>/mycelia`), but the operator runs two
independent local clones of it with different jobs:

- **Framework-development checkout** — where framework changes happen: feature branches,
  ADRs, script changes, PRs back to the repo. Ordinary git-development hygiene applies here.
- **Second-brain checkout** — the operator's daily-use instance: stays on `main`, pulls
  framework updates, accumulates real vault notes and real `.obsidian/` state from actual
  Obsidian use. It is not expected to branch, and its Obsidian churn is normal, not a signal
  of anything wrong.

**In the framework-development checkout:** a local branch sitting behind an already-merged
`origin/main` (no local `main` yet, or local `main` stale) is routine, expected git state —
not evidence of repo confusion or something to investigate and narrate. Resolve it plainly:
fast-forward or create local `main` from `origin/main`, then move on. Do not treat "which
checkout/role am I in" as something to re-derive and explain each session — check `git
remote -v` and the branch name if genuinely unsure, decide once, and act.

**In the second-brain checkout:** `.obsidian/*` files being modified or untracked (besides
the committed `app.json`) is expected from normal use, not a git anomaly requiring
explanation. If `.gitignore` isn't catching a new one, that's a framework-level `.gitignore`
gap to fix (see the `.obsidian/` block above) — not something to narrate per session.

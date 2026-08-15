---
id: "001"
title: Use Taskfile (go-task) for install/doctor/update scripts
date: 2026-08-03
status: accepted
deciders: [operator]
---

## Context

Mycelia will ship an `install.sh`-equivalent, a `doctor`-equivalent health check, and a
future update/version-check step. `docs/research/task-runner-tooling.md` compared five
options — plain bash, Taskfile/go-task, just, make, uv/uvx — against dependency cost,
learning curve, cron/unattended fit, maintenance burden, and agent-agnosticism, with live
examples for each.

That research's own recommendation was plain bash, on the strength of prior art: every
confirmed real-world installer+doctor pair found (rustup, nvm, oh-my-zsh, direnv,
Homebrew, mise) ships its install/doctor mechanism as plain shell, not a task runner.

The research brief under-weighted one constraint: **cross-OS compatibility**. Mycelia's
current scripts assume a POSIX-ish bash environment. That assumption doesn't hold if this
framework is ever run by someone on native Windows (not WSL) — a real possibility for a
framework meant to be installed by third parties, not just the operator's own Linux/macOS
machines. Bash scripts don't solve this; a Taskfile with a single cross-platform binary
does, because `task` itself runs identically on Windows/macOS/Linux, independent of which
shell is available underneath.

## Decision Drivers

- **Cross-OS compatibility** — the deciding driver, not previously weighted in the
  research brief. A third party installing mycelia should not need bash/WSL specifically.
- Agent-agnosticism — must not require any specific AI agent to invoke.
- Willing to accept a new binary dependency as an explicit, flagged tradeoff, rather than
  optimizing purely for "zero dependencies" as the research brief did.

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Taskfile / go-task (chosen)** | Single cross-platform binary — same behavior on Windows/macOS/Linux; declarative task definitions; matches operator's existing familiarity | Adds a required dependency no confirmed close analogue (rustup, mise, nvm) uses for this exact role; contributors must install `task` before running anything | — chosen |
| Plain bash (research brief's own recommendation) | Zero dependency; matches every confirmed installer/doctor precedent found in research | Does not solve cross-OS: assumes POSIX/bash, breaks on native Windows | Rejected specifically on the cross-OS driver |
| just | Similar profile to Taskfile, friendlier syntax | Same binary-dependency cost as Taskfile without operator's existing familiarity advantage | Not chosen — no reason to prefer over Taskfile given equivalent tradeoffs |
| make | Preinstalled on Unix/macOS | Not preinstalled on Windows; build-tool semantics (timestamps/targets) are a poor fit for idempotent scripts | Fails the cross-OS driver same as bash, plus semantic mismatch |
| uv / uvx | Good unattended-execution properties if scripts were Python | Bundles a full language migration, not an incremental tooling swap | Out of scope — no driver here calls for a language change |

## Decision Outcome

Chosen option: **Taskfile (go-task)**. The dependency cost flagged in
`docs/research/task-runner-tooling.md` is accepted explicitly, as a known and deliberate
tradeoff, in exchange for genuine cross-platform behavior that plain bash cannot provide.

## Consequences

- **Now easier:** mycelia can be installed and doctored identically on Windows, macOS,
  and Linux, without a WSL/Cygwin/Git-Bash workaround layer.
- **Now harder:** contributors and forks must install the `task` binary before running
  anything — this is friction the plain-bash path didn't have. `README.md`'s install
  section must document this prerequisite clearly, and ideally check for it (a
  `task --version` sanity check or equivalent as the very first thing a `Taskfile.yml`
  requires).
- **New constraints:** any logic still written as bash *inside* Taskfile task bodies
  (`cmds:`) remains subject to the same POSIX-shell assumption as before — Taskfile
  solves *invocation* portability, not the portability of whatever shell commands a task
  actually runs. Tasks that need genuine cross-shell command portability (not just
  cross-platform invocation) will need further attention when they're written.

## Revisit Conditions

If a significant fraction of real installs turn out to be on Linux/macOS only (the
cross-OS driver never materializes in practice), reconsider dropping back to plain bash
to shed the dependency, per the research brief's original recommendation.

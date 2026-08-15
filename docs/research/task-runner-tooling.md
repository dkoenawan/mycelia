# Research: task runner / installer tooling for mycelia

**Status: research, not a decision.** This does not choose an approach — see
`docs/adr/0000-adr-process.md` for how a decision gets recorded once the operator has
reviewed this. Tracked in [issue #1](https://github.com/dkoenawan/mycelia/issues/1).

## The question

Mycelia will ship `install.sh`, `doctor.sh`, and a future update/version-check script.
What should run them: plain bash (today's approach), a task runner (Taskfile/go-task,
just, make), or a language + runner combination (uv/uvx, if scripts became Python)?

## Constraints these tools are judged against

- **Agent-agnostic** — must work identically for a human or any agent (not just Claude
  Code) that can read files and run bash. No vendor lock-in.
- **Cron/unattended fit** — must run from cron's bare environment: no shell profile
  sourced, minimal `PATH`. See `scripts/lib/common.sh`'s `resolve_claude()`, which exists
  specifically to work around this for the `claude` binary.
- **Dependency cost** — mycelia's stated design commitment is "plain Markdown in git, no
  proprietary store, no lock-in." A new required binary is a cost to weigh explicitly,
  not a free upgrade.
- **Contributor/fork friction** — someone cloning mycelia fresh should get to a working
  install with as few prerequisites as possible.

## Decision framework

| Option | Dependency cost | Learning curve | Cron/unattended fit | Maintenance burden | Agent-agnostic |
|---|---|---|---|---|---|
| **Plain bash** (current) | None — universal on Linux/macOS | Zero — already the codebase's language | Best possible: no binary to locate beyond bash itself | Low tooling burden; all discipline (help text, structure) is self-imposed in `lib/common.sh` | Yes — no tool-specific invocation |
| **Taskfile / go-task** | Go binary, not preinstalled anywhere (brew/npm/snap/direct binary) | New YAML DSL layered over the bash you still write inside it | Needs the `task` binary resolvable via absolute path or PATH in cron — same class of gotcha as any external binary | Contributors must install `task` before anything runs (chicken-and-egg for a framework meant to be zero-friction); adds a schema version to track | Yes in principle, but adds a required install step before either a human or an agent can run anything |
| **just** | Rust binary, not preinstalled (brew/cargo/apt/curl-install) | Small DSL, closer to Makefile syntax but friendlier; fast pickup for bash-literate users | Same PATH/absolute-path caveat as go-task | Lighter than YAML, but still a binary prerequisite; historically a single-maintainer project (bus-factor to note for a framework meant to outlive one person) | Same caveat as Taskfile |
| **make** | Preinstalled on virtually all Linux distros and macOS (via Xcode CLT) | "Known" but genuinely idiosyncratic — tabs-vs-spaces, file-timestamp/target model, `.PHONY` boilerplate for anything that isn't a real build artifact | Best of the three runners — `make` is normally already on cron's PATH | Zero install friction for contributors, but you fight Make's build-tool semantics (timestamps, targets) for tasks that are really just "run this idempotent script" | Yes, no extra install step |
| **uv / uvx** (Python rewrite) | `uv` itself is a single Rust binary, but the real cost is migrating scripts to Python + PEP 723 inline metadata | Two layers: Python itself (larger surface than bash), plus the PEP 723 inline-script-metadata convention | Genuinely good for unattended execution — `uv run` builds an ephemeral venv per script, no "did the venv activate" failure mode. Still needs `uv` resolvable in cron's PATH, and adds first-run network dependency-resolution as a new failure mode bash doesn't have | Highest burden of all five — this is a language migration bundled with a tool choice, not an incremental addition | Yes, same caveat as the others once installed |

## Live examples

**Confirmed by direct fetch:**
- [`casey/just`](https://github.com/casey/just) — its own root `justfile` defines `ci`,
  `check`, `test`, `shellcheck`, and `outdated` recipes. Verification-flavored (shellcheck
  + outdated-deps checks are doctor-adjacent) but this is CI/dev-workflow tooling for
  working *on* the project, not an end-user install+verify flow.
- [`rust-lang/rustup`](https://github.com/rust-lang/rustup) — `rustup-init.sh` at repo
  root. Plain (non-strict-POSIX) shell that does its own inline pre-flight checks: OS/arch
  detection via `uname` and ELF inspection, required-command checks (curl/wget, mktemp,
  chmod, mkdir), TLS capability checks. This *is* effectively an inline doctor-before-
  install pattern, done in the same shell script rather than a separate tool.
- [`stephanj/rag-genie`](https://github.com/stephanj/rag-genie) — root `Taskfile.yml`
  has explicit `env:verify` ("Verify the project environment setup") and `env:setup`
  tasks. The closest confirmed real-world Taskfile match to an install+doctor pair —
  note this is a smaller, less-established repo, not a marquee project.
- [`sourcegraph/doctree`](https://github.com/sourcegraph/doctree) — root `Taskfile.yml`
  has a `setup` task ("Installs dependencies and initializes submodules"), no dedicated
  doctor/verify task. Build-tooling-flavored, from a well-known org.

**Confirmed via search, not independently re-verified:**
- Homebrew's `install.sh` (hosted at `Homebrew/install`, plain bash, `curl | bash`
  pattern) and `brew doctor` (implemented in Ruby inside the main `Homebrew/brew`
  codebase — install and doctor are different languages entirely, not one script).
  Exact current file path for `doctor.rb` was not independently confirmed (a direct
  fetch attempt at one plausible path 404'd); treat the Ruby-implementation claim as
  reliable, the exact path as unconfirmed.
- `nvm-sh/nvm` — `install.sh` at repo root, plain bash, no separate doctor command.
- `ohmyzsh/ohmyzsh` — `tools/install.sh`, plain sh, environment-variable driven, no
  dedicated doctor script found.
- `starship/starship` — `install.sh`; no `doctor` but has `starship check` (config
  validation) and `starship bug-report` (diagnostic bundle) — same intent, different
  naming.
- `direnv/direnv` — `install.sh` at repo root, plain POSIX sh, detects kernel/arch,
  downloads a binary. No doctor equivalent found.
- `jdx/mise` (formerly rtx) — has an actual **`mise doctor`** command (including a
  `mise doctor path` subcommand), the closest real naming-convention match to mycelia's
  own `doctor.sh`. Notably, mise's *own* development tasks use its own built-in task
  runner (`mise.toml`/`tasks.toml`), not go-task or just — a tool built by people
  adjacent to this exact space didn't reach for a third-party task runner for its own
  repo tooling.

**Not researched (flagged rather than guessed):** a real-world example of `uv`/PEP 723
used specifically as an install/doctor delivery mechanism. This is speculative territory
if mycelia ever moved to Python — no existing precedent was found to point to.

## Pattern across the prior art

Every real-world "ship a script that installs and later verifies itself" example found
uses **plain shell for the installer**, with the doctor/check concept implemented either
(a) inline in the same shell script as pre-flight checks (rustup), (b) as a command in
the tool's *own* runtime CLI once installed and written in its main implementation
language (Homebrew's Ruby `brew doctor`, mise's Rust `mise doctor`), or (c) under a
different name with the same intent (starship's `check`/`bug-report`).

**None of the confirmed installer/doctor examples use Taskfile, just, or make as the
delivery mechanism itself.** Task runners only appeared (rag-genie, doctree) as
developer-experience tooling for working on a project's own codebase — not as what an
end user or agent runs to install or verify a fresh clone.

## Recommendation

**Plain bash**, continuing the pattern `scripts/lib/common.sh` already established, is
the option best supported by both the constraint table and the prior art. It has zero
dependency cost, works identically for any agent or human, has no cron-PATH gotcha
beyond bash itself, and mirrors what every close analogue (rustup, nvm, oh-my-zsh,
direnv, starship) actually ships. The task-runner options solve a problem (declarative
dependency graphs, parallelism) mycelia's install/doctor/update scripts don't have — a
handful of sequential, idempotent checks — while adding exactly the kind of dependency
mycelia's own design philosophy argues against. `make`'s zero-install advantage is real,
but its build-tool semantics are a poor fit for idempotent scripts, and no confirmed
"doctor" precedent exists for it either.

This is a recommendation for the operator to confirm or override — not yet a decision.
Once decided, record it as `docs/adr/0001-install-and-update-tooling.md`.

# Research: framework vs. local-instance separation patterns

**Status: research, not a decision.** This does not choose an approach — see
`docs/adr/0000-adr-process.md` for how a decision gets recorded once the operator has
reviewed this. Tracked in [issue #1](https://github.com/dkoenawan/mycelia/issues/1).

## The problem this is scoped to

Mycelia is a single git repo that is simultaneously (a) a distributed framework —
structure, conventions, example configs, scripts — and (b) a locally customized
instance, via gitignored local files (`control/*.local.yaml`, vault content) written
into the same clone. It is not a fork, not a template-generated-once copy: the same
checkout plays both roles, separated by `.gitignore` rather than by repo boundary.

Open question: how does a user `git pull` upstream framework improvements into an
already-customized clone without conflicts, and get a signal when a local config
file's expected schema has drifted from what the framework now expects? (There is an
inert `version: 1` field in `control/estate.example.yaml` today — nothing reads it.)

**Headline finding, upfront:** none of the five researched tools has mycelia's exact
shape (single repo, two roles, split by `.gitignore`). Four of the five nonetheless
have transferable *mechanisms* for either the pull-without-clobbering half or the
migration-signal half of the problem; none has both in one tool; and **no tool
researched has a working "config schema version outdated, see changelog" prompt** —
this appears to be a genuine, unfilled gap across the ecosystem, not something
already solved elsewhere. Any implementation mycelia builds here is closer to a novel
contribution than an adaptation.

## Comparison table

| Tool | Source/local separation | Update mechanism | Breaking-change / migration signal | Agent-agnostic | One-line fit |
|---|---|---|---|---|---|
| **chezmoi** | A **source state** (`~/.local/share/chezmoi`, a git repo of Go-templated dotfiles) is rendered through a **config file** (`~/.config/chezmoi/chezmoi.toml`, holding machine-specific `data` values, itself often produced from a `.chezmoi.toml.tmpl` at `chezmoi init` time) into the **target state** applied onto `$HOME`. Local, machine-specific values live only as template variables — never as literals in tracked files. [Concepts](https://www.chezmoi.io/reference/concepts/) | `chezmoi update` = `git pull --autostash --rebase` in the source dir, then `chezmoi apply` (equivalently `chezmoi git pull -- --autostash --rebase && chezmoi diff` to preview first). Because local values are re-injected from the config/data at every `apply` rather than hardcoded in the pulled files, an upstream template edit cannot clobber a local value — there is nothing local *in* the file to lose. [Daily operations](https://www.chezmoi.io/user-guide/daily-operations/) | A real, citable mechanism exists: chezmoi supports a **`.chezmoiversion`** file in the source state declaring the minimum chezmoi version the source state requires; if the installed `chezmoi` binary is older, it refuses to apply with an explicit version-mismatch error. This is a hard gate on the *tool* version, not on the *user's local config schema* — no equivalent was found for chezmoi's own `chezmoi.toml` schema evolving. [`.chezmoiversion` docs](https://www.chezmoi.io/reference/source-state-attributes/#chezmoiversion), [Release history](https://www.chezmoi.io/reference/release-history/) — searched for a config-schema-version equivalent and did not find one; flagged as absent rather than confirmed-absent-everywhere. | Yes — standalone Go binary, no agent/LLM dependency. | **Closest overall analogue.** "Local values only ever exist as template variables, resolved fresh on every apply" is the core mechanism worth adapting — it's the general principle behind why a gitignore split already protects mycelia's local files, and `.chezmoiversion` is a directly copyable pattern for gating the *framework/tooling* version, if not the config schema itself. |
| **yadm** | Architecturally different from chezmoi: a **bare git repo** (`$HOME/.local/share/yadm/repo.git`) with `$HOME` as the work tree, so dotfiles are tracked directly in place rather than copied from a separate source dir. Machine variance is handled by **alternates** — files suffixed `##hostname.foo`, `##os.Linux`, etc., or `.j2` Jinja templates — resolved per-machine by `yadm alt` (auto-run via `yadm.auto-alt`). Alternates are themselves committed to the repo, not gitignored-local, so the local/framework boundary is drawn differently than mycelia's. [Alternates](https://yadm.io/docs/alternates) | Effectively a plain `git pull`/`yadm pull` against the bare repo, followed by re-running `yadm alt` to re-resolve which alternate wins per machine. No single named "update" command stitches pull+realt into one step the way `chezmoi update` does — this exact workflow is not spelled out as a unit in yadm's docs; flagged as unverified beyond the two separate documented pieces. [FAQ](https://yadm.io/docs/faq) | No config-schema-version or migration-prompt mechanism for yadm's own config was found. | Yes — POSIX shell script wrapping git, no agent dependency. | **Structurally a bit closer to mycelia** (files live in their real place, one repo, not a copy-then-diff model) but weaker than chezmoi on the "protect local values" half, since alternates are file-*selection*, not value-*injection* — they don't stop an upstream edit to a non-alternate file from landing directly on top of local edits the way template variables do. |
| **Homebrew taps** | A tap is a plain git repo of formula files, cloned by `brew tap <user>/<repo>` into Homebrew's own managed directory — genuinely a different location from installed package state. Installed packages/receipts (the Cellar) live entirely outside the tap and aren't git-tracked at all. [Taps](https://docs.brew.sh/Taps) | `brew update` pulls each tapped repo directly — an ordinary git fetch/pull, with no local-value-clobbering problem to solve because there is no concept of local customization living inside a tap. | No end-user-facing config-schema-migration signal exists. The closest real analog is Homebrew's **`revision`** and **`compatibility_version`** fields — a machine-checked breaking-change-propagation mechanism (`brew bump-revision` / `brew bump-compatibility-version`) — but it governs binary-rebuild compatibility between formulae, not end-user config files. [Homebrew/homebrew-core Maintainer Guide](https://docs.brew.sh/Homebrew-homebrew-core-Maintainer-Guide) | Yes — no agent involved. | **Weakest analogy, confirmed.** A tap has no concept of local customization living alongside the framework in the same repo/clone — installed state is categorically separate. Nothing about mycelia's gitignore-split, single-clone problem is present here. |
| **Terraform modules** | Clean separation by construction, and genuinely a *different repo* from the consumer's own infra code: a versioned module source (`source = "terraform-aws-modules/vpc/aws"`, `version = "~> 2.0"`) is fetched into `.terraform/modules/` on `terraform init`; the consumer's `.tfvars` and state file live in their own repo entirely. This is a package-dependency model, not mycelia's same-repo-two-roles pattern — but it is the right analogue for the narrower "signal a breaking change to a downstream consumer" sub-problem. [module block reference](https://developer.hashicorp.com/terraform/language/block/module), [Version Constraints](https://developer.hashicorp.com/terraform/language/expressions/version-constraints) | Not pull-and-reapply — **version pinning plus manual re-resolution**. `terraform init -upgrade` re-resolves the newest version satisfying a constraint. The one hard, tool-enforced gate that does exist is `required_version` in the `terraform` block: if the installed binary doesn't satisfy it, every command refuses to run with an explicit error — the closest real "config-schema-version-as-gate" analog found in this research, though it gates the *binary*, not a `.tfvars` file's shape. | **The strongest concrete, adoptable pattern found overall.** Well-maintained public modules pair a semver `version` with dedicated per-major-version upgrade docs. Confirmed live: `terraform-aws-modules/terraform-aws-eks`'s [`docs/UPGRADE-20.0.md`](https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/docs/UPGRADE-20.0.md) and [`UPGRADE-21.0.md`](https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/docs/UPGRADE-21.0.md), plus `terraform-aws-modules/terraform-aws-vpc`'s [`UPGRADE-3.0.md`](https://github.com/terraform-aws-modules/terraform-aws-vpc/blob/master/UPGRADE-3.0.md) — "Backwards Incompatible Changes" sections, before/after HCL diffs, variable rename tables, literal `terraform state mv`/`state rm` remediation commands. Documentation convention, not tool-enforced automation — nothing forces a consumer to read it before upgrading. | Yes — pure IaC tooling convention, no agent dependency. | **Closest analogue for the migration-signal half specifically.** Directly adoptable for mycelia's dormant `version: 1` field: make it a real, checked value, and pair each schema-breaking change with a `control/UPGRADE-N.md` documenting exactly what changed and what to edit in `*.local.yaml`. |
| **cookiecutter / Yeoman** | **Confirmed contrast case, not a candidate solution.** `cookiecutter gh:user/repo` (or `yo <generator>`) prompts for template variables, renders templates into a brand-new directory **once**, and the result has zero ongoing tracked relationship back to the template repo. Yeoman's own comparison material states this gap explicitly: "if your template evolves too, how do you apply those updates to the subprojects you generated with it? Yeoman has not-so-good support for this, and Cookiecutter has none." [Compare Cookiecutter to Yeoman](https://www.cookiecutter.io/article-post/compare-cookiecutter-to-yeoman) | None, by design — one-shot generation is the entire model. | N/A for the base tools. The community recognized this exact gap and built a bolt-on fix: **cruft**, layered on cookiecutter, adds `.cruft.json` (records the template repo + the exact commit SHA a project was generated from), `cruft update` (diffs upstream template changes since that SHA and offers to apply them onto the already-customized project), `cruft check` (CI-friendly drift detection), and `cruft link` (retrofits tracking onto a pre-existing project). Proof the ecosystem needed mycelia's problem badly enough to build a dedicated tool — though cruft still assumes template and instance are *separate* repos/directories, unlike mycelia's single clone. [cruft docs](https://cruft.github.io/cruft/), [cruft README](https://github.com/cruft/cruft/blob/main/README.md) | cruft: yes, plain Python CLI, no agent dependency. | **Weakest fit for the base tools, confirmed by design.** **cruft is the most structurally relevant bolt-on to study**: its "template ref + last-synced commit SHA, diffed on update" pattern is a minimal, concrete design for "what changed upstream since I last reconciled," directly adaptable as a hidden marker file recording which framework commit a `*.local.yaml` was last validated against. |

## Closest and weakest analogues, explicitly

- **Closest overall: chezmoi.** Its governing rule — machine-specific values exist
  only as template variables, never as literals in tracked files, so they are
  re-injected fresh on every apply rather than merged — is the general principle that
  already makes mycelia's gitignore split safe against `git pull` clobbering. Its
  `.chezmoiversion` file is a real, citable, directly-copyable pattern for gating the
  minimum framework/tooling version a local instance requires. It does **not** solve
  config-schema migration signaling — same open gap mycelia has.
- **Best migration-signal precedent: Terraform's ecosystem convention** of pairing a
  semver-style `version` with a dedicated `UPGRADE-N.md` per breaking change (confirmed
  live in `terraform-aws-modules/terraform-aws-eks` and `terraform-aws-vpc`). This is
  the most directly adoptable idea for mycelia's dormant `version: 1` field: make it
  load-bearing, and when it changes, ship `control/UPGRADE-2.md` alongside it.
- **Most structurally relevant bolt-on: cruft.** `.cruft.json`'s "template ref + last-
  synced commit hash, diffed on update" is a minimal, concrete answer to "what changed
  upstream since I last reconciled" — adaptable as a marker recording which framework
  commit a `.local.yaml` was last checked against, even though cruft's own design
  assumes separate repos.
- **Weakest analogue: Homebrew taps.** There is no local-customization-within-the-same-
  clone concept in a tap at all; installed state lives entirely outside the tap repo.
- **cookiecutter/Yeoman (base tools): weakest by design, and deliberately so** — the
  clean contrast case proving mycelia's problem (ongoing pull into a customized
  instance) is a different lifecycle from one-shot generation. The gap they leave is
  exactly why cruft exists.

## What no tool solved

Across all five, **no tool has a working "your local config's schema is outdated
relative to the framework, here's what changed" prompt** — not chezmoi's own config,
not yadm's, not Terraform's `.tfvars` (only the *binary* version is gated, via
`required_version`), not Homebrew, not cookiecutter/Yeoman. Migration signaling that
does exist (Terraform module upgrade docs, chezmoi's `.chezmoiversion`) is either
(a) a hard version gate on the *tool*, not the *local config's shape*, or (b) a
documentation convention nothing enforces — a consumer who never reads the upgrade
doc gets no error, just a possibly-broken config at runtime.

This means a mycelia solution for the `version: 1` field would be assembling
existing pieces (a checked version number + a per-bump upgrade note, in the
Terraform-module style) rather than adopting a single tool's ready-made mechanism —
none exists to copy wholesale.

## Recommendation

Adopt the **Terraform-module upgrade-doc convention** as the concrete mechanism:
make `version:` in `estate.local.yaml` load-bearing (read and compared by the future
`doctor.sh`/update-check script against `estate.example.yaml`'s current value), and
require any commit that bumps it to add a `control/UPGRADE-N.md` alongside it,
following the same shape as `terraform-aws-modules`' upgrade docs (backwards-
incompatible changes, before/after examples, exact edits needed). Borrow chezmoi's
underlying *principle* — local values should be re-injected rather than hardcoded
where possible — as a design lens for any future schema changes, even without
adopting chezmoi itself. This is a recommendation for the operator to confirm or
override, not yet a decision — once decided, record it as
`docs/adr/0002-framework-instance-separation.md`.

# Research: release/versioning policy

**Status: research, superseded by decision.** The recommendation below was reviewed and
accepted as `docs/adr/0004-release-versioning-policy.md`. This file remains as the
inventory and external survey behind that decision. Tracked in
[issue #4](https://github.com/dkoenawan/mycelia/issues/4).

## The problem this is scoped to

v0.1.0 was tagged by hand on the PR #3 merge commit, with hand-written release notes,
because something needed to exist to point at. There is no policy yet for what triggers
a release, what a version number is measured against, how a changelog gets produced, or
whether any automated check runs before a tag is cut. This research inventories what
already exists in the repo that a policy would need to account for, so the design pass
isn't guessing at the starting state.

## Current release state

Exactly one release exists: `v0.1.0`, tagged `2026-08-15T09:57:14Z` on `b0bd660` (the
merge commit for PR #3, "Install/doctor tooling via Taskfile"). Both the git tag message
and the GitHub release notes are hand-written, with an "Included" section and a "Known
gaps" section. The known-gaps section already names this exact problem:

> "Upgrade tooling (`control/UPGRADE-N.md` convention from ADR-0002) is specified but
> untested — schema is still version 1."

No automation cut this release. A person tagged `main` "whenever it seemed reasonable" —
precisely the state issue #4 asks to replace.

## ADR-0002's schema versioning (already load-bearing, narrower than a release)

`docs/adr/0002-framework-instance-separation.md` made `version:` in
`control/estate.example.yaml` load-bearing — currently `version: 1`
(`control/estate.example.yaml:17`). The decision (lines 70-75, 83-87) scopes this
strictly to **the `control/*.example.yaml` schema**, not the framework as a whole:

- Any breaking change to that schema bumps `version:`.
- The bump must ship `control/UPGRADE-<N>.md` alongside it, modeled on
  `terraform-aws-modules`'s `UPGRADE-N.md` convention (see
  `docs/research/framework-instance-separation.md` for the original research behind
  that choice).

`scripts/doctor.sh` already enforces this mechanically (lines 78-178): it compares the
local `version:` against the example's, points the user at the matching
`UPGRADE-<N>.md` if behind, and self-checks that every version from 2 up to the current
one has a corresponding upgrade doc on disk — failing loudly with an "ADR-0002
violation" message if one is missing.

**This machinery has never been exercised.** No `UPGRADE-*.md` file exists anywhere in
the repo. Schema version has never moved past 1, so none has been required yet. The
first schema-breaking change will be the first real test of both the convention and
`doctor.sh`'s self-check.

**Open question for the release-policy design pass, not resolved here:** does a
framework *release* need to track 1:1 with schema `version:`, or are they independent
axes (framework releases on its own cadence/trigger; schema version bumps only when the
`control/*.example.yaml` shape actually breaks, independent of whether a release
happens around it)? Nothing in ADR-0002 ties the two together either way — it's silent
on framework-level releases entirely.

## ADR process constraints

`docs/adr/0000-adr-process.md`: lightweight, MADR-inspired, standalone-file format.
ADRs are numbered `0000`, `0001`, ... in the order written. Status lifecycle is
`proposed` → `accepted` → `superseded` (via a `supersedes:` field pointing at the ADR
it replaces). Exploratory comparison material that isn't yet a decision belongs in
`docs/research/` — this file — kept separate from `docs/adr/` "so a reader can tell
exploratory material from committed decisions at a glance." The next ADR number in
sequence is `0004`.

`docs/adr/0000-adr-process.md`'s consequences section (lines 57-59) already commits
that "any change to `control/*.example.yaml` schema... should get an ADR if the change
isn't obviously reversible or trivial." It does not explicitly list release policy as
ADR-worthy, but issue #4 asks for one regardless, and the topic (what a release means,
what triggers one) is squarely a non-trivial, non-obviously-reversible decision by the
same standard.

## Repo structure relevant to "what does a release version"

- No `CHANGELOG*` file anywhere in the repo.
- No `VERSION*` file anywhere in the repo.
- `Taskfile.yml` defines exactly two tasks: `install` and `doctor`. Nothing
  release-related.
- `scripts/` contains only `install.sh`, `doctor.sh`, and `lib/` — no release script,
  no changelog generator.
- `.github/` does not exist at all in the repo — confirms issue #4's claim that there
  is currently zero CI. No workflow runs on any push, PR, or tag.

## All existing ADRs (decision history for context)

- **0000** — ADR process itself. Accepted. Establishes the MADR-lite format, numbering,
  and the `docs/adr/` vs. `docs/research/` split used by this document.
- **0001** — Use Taskfile/go-task for install/doctor/update scripts, chosen over plain
  bash for cross-OS support. Accepted.
- **0002** — Config stays plain local YAML; no second repo for instances. Made
  `version:` and the `UPGRADE-N.md` convention load-bearing for the
  `control/*.example.yaml` schema specifically. Accepted.
- **0003** — Session write-back protocol: work done in a `10-projects/`/`20-areas/`
  note gets written back into that note; reusable learnings additionally get filed in
  `30-resources/` and linked with `[[wikilink]]`. Accepted.

## Prior issues/PRs touching release, version, changelog, or CI

None found. `gh issue list` and `gh pr list` searches across "release", "version",
"changelog", and "CI" (state: all) return nothing besides issue #4 itself. This is
genuinely unstarted territory — no prior discussion, partial attempt, or superseded
decision to reconcile against.

## What this research does not answer

This is an inventory, not a recommendation. In particular it does not resolve:

- Whether framework release version and schema `version:` should be the same number,
  independent numbers, or one derived from the other.
- What should trigger a release (every merge to `main`? manual? tied to schema bumps
  specifically?).
- What a release version is measured *against* — the file/directory structure, the
  `control/*.example.yaml` schema, something else, or some combination.
- Whether changelogs should be hand-written (as v0.1.0 was) or generated from commits/PR
  titles.
- Whether a release should require a smoke-test gate (e.g. `task doctor` against a
  fresh clone) before tagging, given `.github/workflows/` doesn't exist yet to run one.

These are the actual decision points for the ADR that follows this research.

## External survey: versioning/release frameworks in the wild

The internal inventory above establishes what mycelia has today. This section surveys
established versioning/release conventions, how each actually works, and where they're
used, so the follow-on ADR picks deliberately rather than by default.

### Semantic Versioning (SemVer 2.0.0)

`MAJOR.MINOR.PATCH`. MAJOR bumps on backward-incompatible changes, MINOR on
backward-compatible additions, PATCH on backward-compatible fixes. Full spec:
[semver.org](https://semver.org/). A version **must** declare a public API (in code or
docs) — the number's meaning is entirely relative to that declared surface. It gives
consumers one number to check before upgrading: did the contract I depend on change.
0.x is explicitly exempted from the breaking-change rule — "anything may change at any
time" — the accepted stance for pre-1.0 software, directly relevant since mycelia is at
v0.1.0. Adopted near-universally by language package managers (npm, Cargo) as the
resolution contract.

**Known critique:** Rich Hickey's ["Spec-ulation"](https://github.com/matthiasn/talk-transcripts/blob/master/Hickey_Rich/Spec_ulation.md)
(2016) argues SemVer's core problem is that "things mean what they mean until they
don't" — a major bump is really an admission "you are screwed," and breaking changes
arguably shouldn't be versioned at all but renamed as a different artifact, since
consumers can't act on the number alone without reading the diff anyway. This weakens
SemVer's value proposition for a project like mycelia, which is git-pulled rather than
resolved by a package manager — nothing mechanically blocks an incompatible pull the
way a resolver blocks an incompatible package version.

### Conventional Commits

Commit message grammar — `type(scope): description`, with `feat:`, `fix:`, `type!:`,
or a `BREAKING CHANGE:` footer. [conventionalcommits.org](https://www.conventionalcommits.org/en/about/).
Turns commit history into a machine-parseable signal, removing the human judgment call
SemVer otherwise requires at release time: `feat` → minor, `fix` → patch,
`!`/`BREAKING CHANGE` → major, mechanically. Two dominant tools consume this —
**semantic-release** (fully automated: on merge to main, computes version, generates
changelog, tags, publishes, no human release step) and **release-please** (accumulates
commits into an open "Release PR"; merging that PR cuts the release — same automation
with a manual gate). Originated at Angular; standard across the semantic-release/
release-please-adopting npm ecosystem. Cost: requires commit discipline from *every*
contributor, not just the maintainer — a real cost for a project with occasional
agent-authored commits and a single operator, since only automated linting (e.g.
commitlint) keeps the signal reliable without policing it by hand.

### CalVer (Calendar Versioning)

Version encodes a date, not compatibility — e.g. `YY.0M`. [calver.org](https://calver.org/).
Works when **release cadence/support window** is the fact users need, not API
compatibility. **Ubuntu** uses `YY.MM` because LTS (5-year) vs. non-LTS (9-month)
support windows are the decision-relevant fact, and CalVer makes that legible at a
glance without a separate support matrix. **Twisted** uses a three-segment CalVer
explicitly because it bundles many independently-evolving subcomponents, making a
single SemVer-style compatibility promise across the whole bundle meaningless — "like
an operating system." General heuristic: SemVer suits **libraries** with one checkable
API surface; CalVer suits **systems/bundles** with many independently-breaking parts,
where "how current is this" matters more than "will my integration break."

### Zero-based / continuous versioning ("0ver")

Not a formal spec — a deliberate stance of staying at `0.x` indefinitely as an explicit
signal: "no compatibility promise yet, don't build load-bearing automation against
this." SemVer itself sanctions it via the 0.x exemption. A legitimate do-nothing-yet
option: mycelia could simply stay 0.x and defer the whole policy question, though issue
#4 was opened precisely because "tag whenever it seems reasonable" already felt
uncomfortable.

### Dual-axis versioning precedent — the part closest to mycelia's actual shape

Mycelia already has two things that could each carry a version: the framework as a
whole, and the `control/*.example.yaml` schema (ADR-0002's `version: 1`, already
independent, already mechanically checked by `doctor.sh`). Three real precedents for
exactly this split:

- **Helm** — `Chart.yaml` carries two independent fields: `version` (the chart/
  packaging version, bumped when templates/config structure change) and `appVersion`
  (the version of the deployed application, purely informational, no effect on chart
  resolution). [helm.sh/docs/topics/charts](https://helm.sh/docs/topics/charts/). The
  cleanest analogue: chart `version` ≈ mycelia's overall framework release; the
  *pattern* of one field for "the packaging changed" and a separate field for "the
  payload changed," tracked independently, maps directly onto framework-release-version
  vs. schema-version.
- **Terraform** — CLI/core version (`required_version`) and each provider's version
  (`required_providers`) are fully independent axes with independent constraint syntax;
  compatibility between them isn't assumed, it's checked.
  [developer.hashicorp.com/terraform/language/providers/requirements](https://developer.hashicorp.com/terraform/language/providers/requirements).
- **Kubernetes** — API group versions (`v1`, `v1beta1`, ...) move on their own
  deprecation schedule, fully decoupled from the numbered Kubernetes release train; an
  object can stay addressable at `v1beta1` across many Kubernetes releases.
  [kubernetes.io/docs/concepts/overview/kubernetes-api](https://kubernetes.io/docs/concepts/overview/kubernetes-api/).

Common thread: **when a "release" bundles things that break on different schedules,
forcing them onto one number either produces false-positive major bumps (framework
released, schema didn't change) or hides real ones (schema broke, release number didn't
move).** ADR-0002's schema `version:` already exists and is already mechanically
checked — it doesn't need to be invented, only *related to* whatever the
framework-level number becomes.

### Changelog tooling

- **conventional-changelog** — the base library `semantic-release` and others build on;
  parses conventional-commit history into a changelog.
- **semantic-release** / **release-please** — see above.
- **git-cliff** — Rust changelog generator, config-driven (`cliff.toml`), reads
  conventional commits *or* custom regex parsers if the convention isn't fully adopted,
  outputs Keep-a-Changelog-style output. [git-cliff.org](https://git-cliff.org/). Can
  retrofit onto a repo with only loosely-conventional history via custom parsers —
  lower discipline bar than semantic-release.

All four require *some* structured commit input to produce anything better than a raw
git log.

## Initial recommendation

This is a recommendation for the operator to confirm or override, not yet a decision —
once decided, it should be recorded as `docs/adr/0004-release-versioning-policy.md`,
following the pattern set by `docs/adr/0002-framework-instance-separation.md`.

- **Framework-level release version → SemVer, with 0.x treated as a deliberate stance,
  not a placeholder.** Mycelia has a real public contract other people install against
  — vault directory structure, `CLAUDE.md` conventions, `Taskfile` targets,
  `control/*.example.yaml` shape — which is exactly what SemVer wants a "declared
  public API" to be. CalVer buys nothing here: there's no support-window/cadence story
  (single operator, no LTS promise), the only reason it earns its keep for
  Ubuntu/Twisted. Stay in 0.x deliberately until the framework surface feels stable
  enough that a break would actually hurt an installer — that's the real trigger for
  1.0, not a calendar date or a vibe.

- **Don't collapse framework version and schema `version:` into one axis — follow the
  Helm pattern.** ADR-0002's `version:` should keep meaning exactly one thing: "the
  `control/*.example.yaml` shape changed incompatibly, and `UPGRADE-<N>.md` exists to
  fix it." A framework release can ship with or without a schema bump; a schema bump
  doesn't have to wait for a framework release. Tie them in one direction only: **any
  release that includes a schema-version bump must include the paired
  `UPGRADE-<N>.md`**, enforced by `doctor.sh`'s existing self-check (already present,
  currently untested) as the release-time gate — not a shared version number.

- **Trigger: manual tag, not merge-triggered automation, for now.** Full
  semantic-release-style automation assumes a contribution volume and enforced commit
  discipline (commitlint, PR templates) mycelia doesn't have — one operator, occasional
  agent-authored commits. Automating this now adds machinery to police a convention
  nobody's violating yet. Revisit if/when there's more than one contributor or release
  frequency makes manual tagging the actual bottleneck.

- **Changelog: hand-written still, but adopt Conventional Commits as commit hygiene
  now, tooling later.** Prefixing commits (`feat:`/`fix:`/`docs:`) costs nothing extra
  per commit and is exactly the kind of thing worth doing before it's needed — it's
  what would make a `git-cliff` retrofit a same-day job later instead of a rewrite of
  history. Don't adopt `git-cliff` or `release-please` yet; there isn't enough release
  volume to amortize the setup cost, and a hand-written release note (as v0.1.0 already
  did) stays higher-signal than an auto-generated one at this scale.

- **The one thing the policy should force:** it should be the thing that finally
  exercises the untested `UPGRADE-N.md`/`doctor.sh` path — stating that a
  schema-breaking change cannot ship without both a `version:` bump and a passing
  `doctor.sh` self-check, ideally as a real CI gate once `.github/workflows/` exists,
  not just a documented convention nobody runs.

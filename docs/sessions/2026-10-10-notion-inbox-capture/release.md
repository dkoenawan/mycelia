# Release: Notion inbox: capture from phone into the vault inbox (#21)

> Phase: Deploy | Started: 2026-10-17 | Status: Ready for release (PR #23 open, CI green; the operator merges after Close)
> Requirements: [`define/requirements.md`](define/requirements.md) · Verification: [`verification.md`](verification.md)

## Version / target

**What "deploy" means here.** This repo has no deploy skill and no deploy Taskfile target. Its release path is set by ADR-0004 (`docs/adr/0004-release-versioning-policy.md`) and `.github/workflows/release.yml`:

1. A PR to `main`.
2. The operator merges it.
3. The operator chooses a SemVer `vMAJOR.MINOR.PATCH` tag and pushes it.
4. The tag push runs `release.yml`. It validates the tag's shape, then runs `task install && task doctor:ci` on a bare checkout.

Release notes are hand-written. Installers then get the release by `git pull`. For the operator, "deployed" also means their second-brain checkout has pulled it and has the connector set up and scheduled. Those steps are under *Operator post-merge steps* below.

- **Source:** branch `feat/21-notion-inbox-capture`, head `913a1d8`. The branch is pushed, and `main` has nothing that isn't in it.
- **PR:** #23, "feat: Notion phone capture into the vault inbox (#21)", into `main`. It's open and not merged. The PR doesn't close #21; that happens at Close.
- **Merge order (operator's decision).** The PR is merged **after Close**, so the Close docs (the credentialed-egress ADR and the Diátaxis docs) ship in PR #23 too. The operator merges it in the GitHub UI after approving it as code owner. No `--admin` merge is used. Deploy counts as done with the PR ready and CI green.
- **Tag: `v0.4.1`, the operator's choice.** The operator pushes it **after the merge**. No tag has been pushed yet.
  - The latest tag is `v0.4.0`, and the earlier ones were `v0.3.0`, `v0.2.0` and `v0.1.0`.
  - This change adds an optional, opt-in feature to the public framework surface: three new `task` targets, a README section, an example estate job and doctor check #9.
  - Nothing existing breaks. Without `control/notion.local.yaml`, behaviour is unchanged (REQ-038, REQ-039).
  - The `src/ingest/run.ts` → `src/ingest/session.ts` refactor is internal. `task ingest-inbox` behaves the same.
  - **Operator's reasoning:** the feature is optional and minor, so a PATCH bump fits.
  - **Policy note:** ADR-0004's 0.x policy would read a new backwards-compatible feature as a MINOR bump (`v0.5.0`, which Deploy first proposed). The operator chose `v0.4.1` knowing this. `release.yml` validates only the tag's shape, and `v0.4.1` passes it.
- **Schema version / `control/UPGRADE-N.md`: no bump needed.** `control/estate.example.yaml` gains one example job, `notion-pull`, using only existing fields. No field is added, renamed or retyped, so ADR-0002's `version:` stays at `1` and no `UPGRADE-2.md` is required. Doctor check #8 passes ("framework still at version 1 — no UPGRADE docs required yet") in the bare-checkout smoke test below.

## What changed

- **Connector (`integration/notion/`).** This is new code with domain, application and adapter layers and its own tests.
  - Setup creates the source inbox and its instructions row and stores the key and IDs in a gitignored, mode-600 config (REQ-002 to REQ-009).
  - The pull run takes items oldest first, up to 10 per run. It writes capture items, ingests them, and updates each row's Status/Reason (REQ-010 to REQ-024).
  - The connector handles the key safely and limits what it writes (REQ-025 to REQ-027, REQ-040, REQ-041).
  - It handles can't-start, outage, lock and exit-code cases (REQ-028 to REQ-030, REQ-033, REQ-034).
  - It keeps a ledger and writes a daily-note summary (REQ-031, REQ-032).
  - It works on any schedule, stays fast on a large batch and handles rate limits (REQ-035, REQ-043, REQ-044).
- **Taskfile.** Adds `notion:setup`, `notion:pull` and `notion:pull:preflight` (REQ-001, REQ-036).
- **Ingester refactor.** The shared session logic moved from `src/ingest/run.ts` into `src/ingest/session.ts` so the pull can drive the ingester (REQ-014). Pulls and `task ingest-inbox` share one lock (REQ-030).
- **`scripts/doctor.sh` check #9.** It reports the connector as not configured without failing (REQ-038, REQ-039). When the connector is configured, it checks that the config is gitignored, mode 600 and parses. It makes no network call.
- **`control/estate.example.yaml`.** Adds a fictional `notion-pull` job with `commits: false` and the ADR-0006 explanatory note (REQ-037).
- **README.** Adds a *Phone capture (Notion)* section (REQ-042).
- **Tooling.** `tsconfig.json` and `package.json` include `integration/*/` in typecheck, lint and test, so `task check:node` and CI cover the connector.
- **Defect fixed during Test.** Two rows with the same title got the same capture filename, which broke REQ-011, REQ-016, REQ-017 and REQ-020 outside their fixtures (VER-044, VER-045). It was fixed in `aa38209`: captures are now named by the full row ID. Live re-verification passed (VER-046, VER-047).

All 44 requirements are verified ([`verification.md`](verification.md)).

## Completeness

**Manifest.** This repo has no single release manifest like `marketplace.json`. What ships is the git tree at the tagged commit, and installers reach it through these entry points:

- the `Taskfile.yml` targets
- the README's documented commands
- the `package.json` and `tsconfig.json` globs that bring code under the gates
- `control/estate.example.yaml`
- the `scripts/doctor.sh` checks

Each was checked as it ships, which means against a fresh clone of the pushed branch, not the working checkout.

**Everything listed exists and is complete:**

- **Taskfile targets.** All three new targets run `node integration/notion/src/cli.ts` with `setup`, `pull` or `pull --preflight`. That file and every module it imports are tracked: 43 files under `integration/`, with nothing untracked or ignored there.
- **No stubs.** `grep` for `TODO`, `FIXME`, `XXX` and "not implemented" over `integration/notion/src` and `src/ingest` found nothing. `find integration -empty` found no empty files or directories.
- **Release smoke test on head `913a1d8`.** The bare-checkout smoke test passes 8/8.
- **README.** Every command the README section names exists as a Taskfile target, and every path it names exists or is created by setup: `control/notion.local.yaml`, `.state/notion-pull/ledger.jsonl` and `00-inbox/capture/`.
- **Gitignore.** `git check-ignore --no-index` confirms all three paths above are gitignored, so nothing the connector writes can be committed.
- **Estate example.** The `notion-pull` entry fills every schema field, and its `script` points at a real target.

**Nothing complete is left out:**

- Every source file under `integration/notion/src/` is reachable from `cli.ts`.
- `integration/notion/test/**/*.test.ts` falls under the `package.json` `test` glob, and `integration/notion/test/live/*.live.ts` falls under `test:live`. Both `src` and `test` are in `tsconfig.json`'s `include`, so `task check:node` gates all of it: 191/191 on head.
- The template `integration/notion/template/source-inbox.json` is tracked, and setup loads it (REQ-040, VER-002).
- No component built this session sits outside the tree or outside the gates.

**Result:** complete. There are no gaps.

## Deploy steps run

1. **Gate.** Re-ran `task check:node` on head `913a1d8`: 191 tests, 191 pass, 0 fail.
2. **Release smoke test, bare checkout.** Cloned the pushed branch into a scratch directory at `913a1d8` and ran `task install && task doctor:ci`: 8/8 checks passed.
   - Check #8: "framework still at version 1 — no UPGRADE docs required yet".
   - Check #9 note: "Notion connector not configured (optional)".
   - This is the same check `release.yml` will run on the tag push. The scratch clone was then deleted.
3. **PR.** Opened PR #23 into `main` with `gh pr create`. The body summarises what ships, the test outcome including the capture-name defect and its fix, the proposed tag, and the absence of a schema bump. It has no closing keyword for #21.
4. **PR CI.** Ran `gh pr checks 23`. `ci / check-node` passed on both runs: 29s on the push event and 31s on the pull_request event.
5. **Merge readiness.** The PR is `MERGEABLE` with no conflicts, but its merge state is `BLOCKED`. The `main` ruleset requires one approving code-owner review. All 28 commits are signature-verified, so the required-signatures rule is satisfied.

The following were **not run**. They're the operator's, after Close:

- approving and merging PR #23 in the GitHub UI, after the Close docs land on the branch
- pushing tag `v0.4.1` on the merge commit, after the merge
- writing the release notes
- the steps on the operator's second-brain checkout. Deploy doesn't wait on these.

## How it was confirmed working

**Pre-merge, done:**

- the gate (191/191)
- the bare-checkout smoke test (8/8), which is what `release.yml` runs
- PR CI green
- the live end-to-end verification in [`verification.md`](verification.md), including the re-run of the fixed defect on `aa38209`

**Post-merge, still to do (after Close; Deploy doesn't wait on these).** Each check is confirmed when:

- **Tag push (`v0.4.1`).** Both `release.yml` jobs, `validate-tag` and `smoke-test`, pass on the pushed tag (`gh run list --workflow release.yml`).
- **Operator's checkout.** The steps below finish with all of the following:
  - `task notion:pull:preflight` exits 0
  - `task doctor` shows check #9 passing ("control/notion.local.yaml is gitignored, mode 600 and parses")
  - a test row captured from the phone reaches `00-inbox/capture/` and is set to `Ingested` on the first scheduled pull, with a *Phone capture* block in that day's note

### Operator post-merge steps (second-brain checkout)

Placeholders use the `control/roots.example.yaml` convention. Substitute real values locally, and never commit them.

1. **Pull the release.** On `main`, run `git pull`.
2. **Install.** Run `task install`. Node, the npm dependencies and a logged-in Claude Code are needed, as for the ingester.
3. **Create the Notion integration and share a parent page.** Follow README *Phone capture (Notion)* steps 1 and 2 in the real workspace.
4. **Set up the connector.** Run `task notion:setup -- "<link to the shared parent page>"` and paste the integration secret at the hidden prompt.
   - This creates *Capture inbox* with its instructions row.
   - It writes `control/notion.local.yaml`, which is gitignored and mode 600.
   - Running it again is safe, because it reports the existing inbox.
5. **Preflight.** Run `task notion:pull:preflight`. It must exit 0, and it changes nothing. Then run `task doctor` and confirm check #9 passes.
6. **Optional first pull.** Capture one test row from the phone and run `task notion:pull` once by hand to watch it go through.
7. **Add a cron entry.** Pick a schedule. Any interval works (REQ-035). For example:

   ```
   0 7,13,19 * * * cd ${repos}/<vault checkout> && task notion:pull >> ${logs}/notion-pull.log 2>&1
   ```

   - Cron doesn't source a shell profile, so set `PATH` in the crontab (or wrap the command) to include `task` and `node`.
   - Claude Code must be logged in for the user cron runs as.
8. **Register the job.** Add a `notion-pull` entry to `control/estate.local.yaml`, modelled on the example in `control/estate.example.yaml`:
   - `schedule` must match the crontab line **exactly**.
   - Use `commits: false`, keeping its explanatory note.
   - Use `ledger: .state/notion-pull/ledger.jsonl` and `log` pointing at the cron log.
   - Set `max_silence_hours` to suit the schedule.
   - Set `status: healthy`.

## Rollback

- **Before merge.** Close PR #23 without merging. Note that after Close, the PR also carries the Close docs. Nothing has changed on `main` or in any installer's checkout.
- **After merge, before tagging.** Open a PR that reverts the merge commit (`git revert -m 1 <merge sha>`). The change is purely additive, so the revert is clean, apart from `src/ingest/run.ts`, where the refactor reverts with it.
- **After tagging.** Don't delete or move a published tag. Cut a new tag from the revert. Following the operator's choice for this release, that's `v0.4.2`.
- **Operator's checkout.**
  - Remove the cron line and the `notion-pull` entry from `control/estate.local.yaml` in the same change.
  - Delete `control/notion.local.yaml`, and revoke the integration in Notion if it's no longer wanted.
  - Nothing committed needs undoing, because the connector writes only gitignored vault content and local state (REQ-027).
  - Captures already ingested stay as ordinary vault notes.
  - In Notion, the connector only ever changed rows' Status and Reason (REQ-022). The rows and the *Capture inbox* database stay, and the operator can delete them by hand.

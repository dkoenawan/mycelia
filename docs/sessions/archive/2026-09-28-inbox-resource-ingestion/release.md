# Release: Resource lifecycle MVP — inbox → resources ingestion (#12)

> Phase: Deploy | Started: 2026-10-10 | Status: Draft
> Requirements: [`define/index.md`](define/index.md) · Verification: [`verification.md`](verification.md)

## Version / target

- **Version:** `v0.4.0`. This is a SemVer minor bump over `v0.3.0` under ADR-0004. It adds a new framework feature: the ingester, its task targets, Node tooling, a CI workflow, conventions and two ADRs. Nothing in the existing surface breaks. `release.yml` is unchanged, and so is the bare-runner `task install && task doctor:ci` path.
- **Schema axis:** unchanged. `control/estate.example.yaml` gains one example job (`inbox-ingest`). That job uses only existing fields, including the existing optional `note`. `version:` stays at `1`, so no `control/UPGRADE-<N>.md` is needed. An existing `estate.local.yaml` stays valid as it is. The doctor agrees: on the fresh-clone smoke test it reported `[ok] estate.local.yaml version (1) matches current framework version` and `[ok] framework still at version 1 — no UPGRADE docs required yet`.
- **Target:** `main` on `github.com/dkoenawan/mycelia`, through [PR #20](https://github.com/dkoenawan/mycelia/pull/20). The PR is to be **squash-merged** at Close, not in Deploy.
- **Tag:** after the merge, this session's orchestrator pushes `v0.4.0` on the squash-merge commit, at the operator's request. Pushing the tag runs `.github/workflows/release.yml`, which validates the tag and then runs `task install && task doctor:ci` on a bare checkout. Neither the tag nor the release has been pushed yet.

## What changed

- **Capture selection and holds** (REQ-001–007): capture items only, oldest first, at most 10 per run. Held items wait for their ask, and unsupported types get one ask each.
- **URL retrieval** (REQ-008–010): thin items are fetched with credential-free read-only GETs.
- **Agent sandbox** (REQ-011): a tool-using Claude Code agent behind a read/write policy, limited to the allowed write set (ADR-0007).
- **Resource notes and back-links** (REQ-012–020, REQ-022): one resource per item with frontmatter, summary, takeaways, source and related sections. Back-links are appended to existing area/project notes only. Name collisions get a suffix.
- **Archive, check, rollback and ledger** (REQ-021, REQ-023–028): byte-for-byte archive to `40-archive/capture/`, a per-item check, journal rollback, a 3-strike ask, crash recovery and the ledger under `.state/ingest-inbox/`.
- **Run reporting and exit codes** (REQ-029–033): a daily-note block, an exit 0 no-op when there is nothing to do, non-zero exits for check failures, can't-start cases and concurrent runs, and preflight.
- **Never commits** (REQ-034), the **capture folder and README conventions** (REQ-035, REQ-036, REQ-042), the **task entrypoints** `ingest-inbox` / `ingest-inbox:preflight` (REQ-037), the **`inbox-ingest` example job** (REQ-038), the **unchanged release smoke test** (REQ-039), **public-repo hygiene** (REQ-040) and **throughput** (REQ-041).
- **Tooling:** `package.json`/lockfile (pinned), `.nvmrc`, `tsconfig.json`, `eslint.config.js`, `task deps:node` / `task check:node`, `.github/workflows/ci.yml`, and `doctor.sh` node checks (skipped under `--ci`).
- **T16 (D15):** commit `aa1a34e` `docs(adr): accept ADR-0006 and ADR-0007 — #12` sets both ADRs to `status: accepted` and `date: 2026-10-10`. It also expands ADR-0007's Residual bullet to cover the missing login hint, the writes made before the stop, and rate limits, as accepted at the Test gate. T16 was already done before Deploy started and is recorded here because `tasks.md` is frozen.
- **Test result carried into this release:** 44 VER rows, with 43 pass and 1 fail (VER-033). By requirement, 41 of 42 REQs pass and REQ-032 is partial. The operator accepted the REQ-032 gap at the Test gate as a known residual, and ADR-0007 records it: an expired subscription login gets past preflight, then the run exits 4 without a login hint.
- **Known issues shipped:** a rate-limit stop isn't noted in the daily note. `task ingest-inbox` reports go-task's exit 201 instead of the ingester's code. Resource names often get a `-2` suffix.
- **Follow-ups, not in this release:** #13–#19 (plus #10 from the previous release).

## Completeness

There is no package manifest for the mycelia framework, so the release manifest is the committed framework tree on the branch. `package.json` is `private: true` and isn't published. It was checked against `git diff --name-status origin/main...HEAD` (74 files) and inspected **as it ships**, in a fresh `git clone` of the pushed branch HEAD (`53b5863`) in the session scratchpad, not in the working checkout.

| Component | Check | Result |
|---|---|---|
| `src/ingest/**` (22 files, including `agent/` and `system-prompt.txt`) and `src/lib/**` (5 files) | 3,186 lines in total, none empty. `tsc -p tsconfig.json` (strict) and `eslint .` are clean in the clone | complete |
| `test/**` (18 files) | `node --test`: 97/97 pass in the clone. `test/live/claude-code.live.ts` is the opt-in `npm run test:live` (4/4 at Test) | complete |
| `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.json`, `eslint.config.js` | `task deps:node` (`npm ci`) installed 196 packages cleanly from the lockfile. `engines.node >=22.18.0` matches the Taskfile precondition | complete |
| `Taskfile.yml` | `task --list` shows `ingest-inbox`, `ingest-inbox:preflight`, `deps:node` and `check:node`. `task ingest-inbox:preflight` on the bare clone stops with the intended "no area or project notes … run `task bootstrap-areas`" message (exit 2, reported by go-task as 201, which is a known issue) and changes nothing | complete |
| `.github/workflows/ci.yml` | Runs `task check:node` on push and PR with `node-version-file: .nvmrc`. `release.yml` is not touched | complete |
| `scripts/doctor.sh` | `bash -n` is clean. The node and node-deps checks are present and skipped under `--ci` (seen in the smoke test) | complete |
| `control/estate.example.yaml` | `inbox-ingest` entry present with `commits: false` and an explanatory `note`. The doctor's "no job has commits:false without an explanatory note" check passes | complete |
| `.gitignore` | `git check-ignore` matches `.state/ingest-inbox/ledger.jsonl`, `00-inbox/capture/x.md`, `node_modules/x`, `30-resources/x.md` and `40-archive/capture/x.md`. `00-inbox/capture/README.md` stays tracked | complete |
| `00-inbox/capture/README.md` | The only tracked file in the capture folder (REQ-035) | complete |
| `00-inbox/README.md`, `30-resources/README.md` | Document the capture folder and ingester-made resources (REQ-036, REQ-042) | complete |
| `.obsidian/app.json` | New-file folder is `00-inbox/capture`, and `node_modules/` is in the ignore filters | complete |
| `README.md`, `CLAUDE.md` | Project anchor, the TypeScript-runner rule (ADR-0007) and the batch exception (ADR-0006) | complete |
| ADR-0006, ADR-0007 | `status: accepted` and `date: 2026-10-10`. ADR-0007 has the expanded Residual bullet | complete |

- **No stubs:** grepping every framework file on the branch diff (all of them except the session folder and `package-lock.json`) for `TODO|FIXME|TBD|XXX` found no matches. No file is empty or `.gitkeep`-only. The only one-line file is `.nvmrc` (`24`), which is correct.
- **Nothing left out:** every framework file added or changed on the branch appears in the table above. The rest of the diff is this session folder (define/, design, tasks, verification, log), which is complete. No built component is missing from the diff: `git status --porcelain` in the clone was empty after install, `npm ci` and the full gate.
- **Public-repo hygiene (REQ-040):** I scanned the added lines of the branch diff (excluding `package-lock.json`, which I grepped separately for `/home/` and `/Users/`: 0 matches) for absolute home paths, the username, the operator's name and email, and other email addresses. I found no matches. The only hit was VER-041's evidence text describing that same scan. Framework files have no `he|his|him`. In the session folder, the only matches are REQ-040's own text and the grep command that quotes it.

## Deploy steps run

1. T16 had already been done in `aa1a34e` (see What changed). It wasn't redone.
2. Release smoke test on a fresh clone of the pushed branch HEAD (`53b5863`, level with `origin/feature/issue-12-inbox-resource-ingestion`) in the session scratchpad: `task install && task doctor:ci` exited 0.
3. In the same clone: `task deps:node && task check:node` exited 0.
4. Ran the completeness and hygiene checks above against the clone.
5. Opened [PR #20](https://github.com/dkoenawan/mycelia/pull/20) to `main`. It has a summary, the Test result, the known issues and follow-ups #13–#19, says `Closes #12`, and states that it must be squash-merged. **Not merged.**

Still to do, outside Deploy:

6. Close: squash-merge PR #20.
7. The orchestrator, at the operator's request, runs `git tag v0.4.0 <squash-commit> && git push origin v0.4.0`, then confirms that `release.yml` goes green and that `ci.yml` is green on `main`.

## How it was confirmed working

- **Fresh-clone smoke test** (the same path `release.yml` runs), at `53b5863`: `task install` created `roots`, `estate` and `areas` `.local.yaml`, and `task doctor:ci` reported "8/8 checks passed. Install looks healthy." Exit 0 (REQ-039). The node checks were skipped under `--ci` as designed.
- **TypeScript gate in the same clone** (the same path `ci.yml` runs): `npm ci` installed cleanly. tsc and eslint were clean, and `node:test` gave 97 tests, 97 pass, 0 fail.
- **Feature behaviour** was verified at Test with real CLI runs and `npm run test:live` (see `verification.md`). This release introduces no code changes since then; the only later commits are T16, which touches ADRs only, and session docs.
- **After the merge and tag:** the `release.yml` run on the `v0.4.0` tag is the confirmation of record. It hasn't run yet, because the tag hasn't been pushed. PR #20's `ci.yml` run is the pre-merge check of the Node gate on GitHub's runner.

## Rollback

- **Code:** `git revert <squash-commit>` on `main`. The squash-merge makes the whole change a single commit.
- **Release:** if `v0.4.0` has been pushed, delete the GitHub release and the tag (`gh release delete v0.4.0`, `git push --delete origin v0.4.0`, `git tag -d v0.4.0`).
- **Local state:** ingester output is gitignored operator content or local state, and a revert doesn't touch it. That covers resources in `30-resources/`, archived captures in `40-archive/capture/`, asks in `00-inbox/`, daily-note blocks, `.state/ingest-inbox/` and `node_modules/`. The operator can keep these or delete them by hand. Back-link lines appended to `20-areas/` / `10-projects/` notes are also local vault content and stay where they are. A scheduled `inbox-ingest` job in `estate.local.yaml` and the crontab must be removed by the operator, because the runner it calls won't exist after a revert.
- **Before the merge:** close PR #20 without merging. `main` is unaffected.

# Release: README Install section around the task commands (#10)

> Phase: Deploy | Started: 2026-10-24 | Status: Draft
> Requirements: [`define/index.md`](define/index.md) · Verification: [`verification.md`](verification.md)

## Version / target

- **Version: `v0.4.2`, decided by the operator at the Deploy gate.** This is a SemVer PATCH bump over `v0.4.1` under ADR-0004. The change rewrites the README Install section and changes the next-steps text that `scripts/install.sh` prints. It fixes documentation that no longer matched the install path. No behaviour, task target, `control/*.example.yaml` shape or public contract changes: `install.sh` still seeds the same three `seed_local` targets, and only its `log` lines differ (VER-010). A MINOR bump would overstate it, because nothing is added to the framework surface.
- **Tagged, not left for the next release.** Under ADR-0004 a release exists only when the operator pushes a `v*` tag, and a docs-only change could have merged without one. The operator chose to tag `v0.4.2`: `install.sh` output is part of what a fresh clone sees, and a tag makes the corrected install path citable.
- **Schema axis: unchanged.** `control/estate.example.yaml` isn't touched by this branch, so ADR-0002's `version:` stays at `1` and no `control/UPGRADE-<N>.md` is needed. The doctor agrees: on the fresh-clone smoke test it reported `[ok] framework still at version 1 — no UPGRADE docs required yet`.
- **Target:** `main` on the framework repo, through the session PR from `docs/issue-10-readme-install` (head `f15eea6`, pushed, level with its remote). The orchestrator opens the PR after Deploy returns. It is to be **squash-merged at Close**, not in Deploy.
- **Tag:** the operator pushes `v0.4.2` on the squash-merge commit after the merge. The tag push runs `.github/workflows/release.yml`, which validates the tag's shape and then runs `task install && task doctor:ci` on a bare checkout. No tag has been pushed yet.

## What changed

- **DES-002 (`628b85a`)**, `feat(install): print task deps:node as a next step before task doctor`: `scripts/install.sh`'s printed next steps gain step 3, `task deps:node` (or `npm ci`, Node.js 22.18 or later), before `task doctor`. The later steps are renumbered 4–7 (REQ-007, REQ-011).
- **DES-001 (`f9b6c8b`)**, `docs(readme): rewrite Install section around task install, deps:node, doctor and bootstrap-areas`: the README Install section now has a prerequisites paragraph (REQ-002). It seeds with `task install` instead of a hand `cp` (REQ-001) and states that `task install` is safe to re-run (REQ-008). It then has the installer edit roots and estate (REQ-003), run `task deps:node` (REQ-004) and `task doctor` with a "healthy" definition (REQ-005), and then edit areas or keep the defaults and run `task bootstrap-areas` (REQ-006). The steps are in the same order as `install.sh` (REQ-007), and the section closes with the Obsidian/plain-files paragraph (REQ-009). The full documented path works end to end on a fresh clone (REQ-010).
- **Test result carried into this release:** VER-001 to VER-011 all pass, so REQ-001 to REQ-011 are 11 of 11 covered and passing (see `verification.md`).
- **Known issues shipped:** none.

## Completeness

The mycelia framework has no package manifest, so the release manifest is the committed framework tree on the branch. I checked it against `git diff --name-status origin/main...HEAD` (11 entries) and inspected it **as it ships**, in a fresh `git clone` of the pushed branch HEAD (`f15eea6`) in the session scratchpad, not in the working checkout.

| Component | Check | Result |
|---|---|---|
| `README.md` (M) | In the clone, the Install section names only `task install`, `task deps:node`, `task doctor` and `task bootstrap-areas`, and each one is a key in `Taskfile.yml` (lines 15, 25, 72, 20). The go-task link `https://taskfile.dev/installation/` is present. No `TODO`/`FIXME`/`TBD`/`XXX` | complete |
| `scripts/install.sh` (M) | `bash -n` is clean. In the clone, `task install` exited 0, created `control/{roots,estate,areas}.local.yaml` and printed next steps 1–7 with `task deps:node` (3) before `task doctor` (4). A re-run also exited 0. No stub markers | complete |
| Session folder (A, 9 files: `define/{framing,index,problem,requirements}.md`, `design/index.md`, `implement/{as-built,tasks}.md`, `verification.md`, `log.md`) | All non-empty, and no `TODO`/`FIXME`/`TBD`/`XXX` markers. These are session records, not shipped framework components | complete |

- **No stubs:** none of the 11 changed files is empty, and neither framework file contains a stub marker.
- **Nothing left out:** DES-001 and DES-002 are the only framework components this session built, and both are in the diff (`README.md`, `scripts/install.sh`). No other component changed: `Taskfile.yml`, `control/*.example.yaml`, `scripts/doctor.sh` and `release.yml` are untouched. In the clone, `git status --porcelain` was empty after `task install` (the seeded `.local.yaml` files are gitignored as designed), so nothing was built outside the commit.
- **Public-repo hygiene:** I scanned the branch diff's added lines for absolute home-directory paths (Linux and macOS), the local username, the operator's name and email, and email addresses. The only hits are two lines in `design/index.md` that cite a sibling plugin issue as `<owner>/compass-labs#51`. That is the public GitHub owner handle, which archived session releases already use in PR links, not a personal identifier beyond that. I found no `he|his|him` in the added lines of `README.md` or `scripts/install.sh`.

The release manifest lists only complete components and leaves none out.

## Deploy steps run

1. Confirmed the branch is pushed: local `HEAD` and `origin/docs/issue-10-readme-install` are both `f15eea6`.
2. Fresh clone of the pushed branch into the session scratchpad (above). `bash -n scripts/install.sh` was clean.
3. Ran the release smoke test in the clone, on the same path `release.yml` runs: `task install` exited 0 and `task doctor:ci` exited 0 with "8/8 checks passed. Install looks healthy."
4. Ran the completeness and hygiene checks above against the clone.

Still to do, outside Deploy:

5. The orchestrator opens the session PR to `main`, says `Closes #10` and that it must be squash-merged, and includes the Test result.
6. Close: squash-merge the session PR.
7. The operator pushes `v0.4.2` on the squash-merge commit (`git tag v0.4.2 <squash-commit> && git push origin v0.4.2`) and confirm that `release.yml` goes green.

## How it was confirmed working

- **Fresh-clone smoke test** at `f15eea6`: `task install && task doctor:ci` exited 0, and the doctor reported 8/8 checks passed. The node-dependency check was skipped under `--ci` as designed. The printed next steps match REQ-007/REQ-011's order.
- **Documented install end to end** was verified at Test (VER-011, on a fresh clone at `6aa76a9`). The Install section's commands were run in order: `task doctor` gave 14/14 checks passed, and `task bootstrap-areas` created 7 area notes. The only later commits are session docs (`6aa76a9..f15eea6` touches only the session folder), so that result still holds for this HEAD.
- **After the merge and tag:** the `release.yml` run on `v0.4.2` is the confirmation of record. It hasn't run yet.

## Rollback

- **Code:** `git revert <squash-commit>` on `main`. The squash-merge makes the whole change a single commit, and reverting it restores the previous README Install section and `install.sh` next-steps text.
- **Release:** if `v0.4.2` has been pushed, delete the GitHub release (if one was created) and the tag (`gh release delete v0.4.2`, `git push --delete origin v0.4.2`, `git tag -d v0.4.2`).
- **Local state:** none. The change creates no new local files. `task install` seeds the same `control/*.local.yaml` files it did before, and it never overwrites them.
- **Before the merge:** close the session PR without merging. `main` is unaffected.

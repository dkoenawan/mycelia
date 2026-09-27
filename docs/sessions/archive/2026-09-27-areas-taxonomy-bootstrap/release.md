# Release: Default areas taxonomy + bootstrap (#9)

> Phase: Deploy | Started: 2026-09-27 | Status: Draft
> Requirements: [`requirements.md`](requirements.md) · Verification: [`verification.md`](verification.md)

## Version / target

- **Version:** `v0.3.0`. This is a SemVer minor bump over `v0.2.0` under ADR-0004: a new, additive framework feature (a manifest, a script, a task target and README conventions) with no breaking change to the existing surface.
- **Schema axis:** unchanged. `control/estate.example.yaml` is not touched by this branch, so the schema `version:` stays at 1 and no `control/UPGRADE-<N>.md` is needed. The areas manifest is unversioned by design (ADR-0005). The doctor agrees: on the fresh-clone smoke test it reported `[ok] framework still at version 1 — no UPGRADE docs required yet`.
- **Target:** `main` on `github.com/dkoenawan/mycelia`, through [PR #11](https://github.com/dkoenawan/mycelia/pull/11). The PR must be **squash-merged** (logged operator decision: earlier branch commits contain since-redacted text). The merge happens at Close, not in Deploy.
- **Tag:** the operator pushes `v0.3.0` on the squash-merge commit after the merge (ADR-0004: a manual tag trigger). The tag push runs `.github/workflows/release.yml`, which validates the tag and then runs `task install && task doctor:ci` on a bare checkout. Neither the tag nor the release has been pushed yet.

## What changed

- Default areas manifest `control/areas.example.yaml` (REQ-001–003). Its local copy is gitignored (REQ-004).
- `install.sh` seeds `control/areas.local.yaml` through `seed_local()`, which now lives in `scripts/lib/common.sh`. Install also prints next steps for areas (REQ-005–007).
- `scripts/bootstrap-areas.sh` plus the `task bootstrap-areas` target (REQ-008–019, REQ-026), including the stale-defaults guard (REQ-027, DES-014, D14).
- `20-areas/README.md` and `10-projects/README.md` gain the list of default slugs and the linking convention (REQ-020, REQ-021).
- ADR-0005 and the areas research note, cleaned for the public repo (REQ-022, REQ-023).
- **T8 (DES-011, D12, D14):** commit `c94bdcb` `docs(adr): accept ADR-0005 — #9` sets ADR-0005 to `status: accepted` and `date: 2026-09-27`, and adds a Decision Outcome bullet for the stale-defaults guard. T8 is recorded here because `tasks.md` is frozen.
- Follow-up, not in this release: #10 (root README Install section).

### VER-025 (REQ-024): evidence

`verification.md` is frozen, so the result is recorded here. After the push, `git log -- docs/adr/0005-default-areas-taxonomy-and-bootstrap.md` on the branch shows exactly two commits touching the ADR:

| Commit | `status:` |
|---|---|
| `cbf4399` docs(adr): add ADR-0005 (proposed) … | `proposed` |
| `c94bdcb` docs(adr): accept ADR-0005 — #9 (HEAD) | `accepted` |

The accepting commit is the last commit on the branch that touches the ADR, and every earlier commit shows `proposed`. **VER-025: pass.** It stays true as long as no later commit touches the ADR before the squash-merge. The squash also collapses the history on `main` into one commit, and that commit carries `accepted`.

## Completeness

The release manifest for mycelia is the committed framework tree on the branch (there is no package manifest). It was checked against `git diff --name-status main...HEAD` and inspected **as it ships**, in a fresh `git clone` of the pushed branch HEAD (`c94bdcb`) rather than in the working checkout.

| Component | Check | Result |
|---|---|---|
| `control/areas.example.yaml` | Parsed with PyYAML: 7 active slugs (`health`, `finances`, `career`, `relationships`, `personal-growth`, `home-environment`, `recreation`), Community commented out | complete |
| `scripts/bootstrap-areas.sh` | 307 lines, git mode `100755`, `bash -n` clean. Ran `task bootstrap-areas` in the clone: 7 created, then a re-run gave 0 created and 7 skipped, and `git status --porcelain` stayed empty | complete |
| `scripts/lib/common.sh` `seed_local()` | Defined at line 58. Called by `install.sh` (roots, estate, areas) and by `bootstrap-areas.sh` | complete |
| `scripts/install.sh` | Seeds `areas.local.yaml` and prints areas next steps 4–5 (seen in the smoke-test output) | complete |
| `Taskfile.yml` | `task --list` shows `bootstrap-areas` | complete |
| `20-areas/README.md` | The listed slugs match the example manifest's 7 active slugs exactly | complete |
| `10-projects/README.md` | The linking-convention paragraph is present (REQ-021, VER passed in Test) | complete |
| ADR-0005 | `status: accepted`, `date: 2026-09-27`, stale-defaults bullet present | complete |
| `docs/research/areas-of-life-taxonomy.md` | 107 lines. The "Tracked in" line links issue #9 | complete |
| `.gitignore` | `git check-ignore control/areas.local.yaml` matches | complete |

- **No stubs:** grepping every shipped file above for `TODO|FIXME|TBD|placeholder|XXX` found no matches. No file is empty or `.gitkeep`-only.
- **Nothing left out:** every framework file changed or added on the branch appears in the table. The branch also carries `.claude/rules/compass-sessions.md` and this session folder, which are complete. No built component is missing from the diff.
- **Public-repo hygiene (REQ-022):** the branch diff was scanned for absolute home paths, the username and the email, and the framework files for `he|his|him`. There were no matches.

## Deploy steps run

1. T8: edited ADR-0005 and committed only that file (`c94bdcb`).
2. Checked VER-025 against the branch history (see above).
3. Release smoke test on a fresh clone of the branch HEAD in the session scratchpad: `task install && task doctor:ci` exited 0.
4. `git push`: `b4c964e..c94bdcb` on `feature/issue-9-areas-bootstrap`.
5. Opened [PR #11](https://github.com/dkoenawan/mycelia/pull/11) to `main`. It links the REQs and this session folder, notes #10, says `Closes #9`, and states that it must be squash-merged. **Not merged.**

Still to do, outside Deploy:

6. Close: squash-merge PR #11.
7. The operator runs `git tag v0.3.0 <squash-commit> && git push origin v0.3.0`, confirms `release.yml` goes green, and writes the release notes by hand (ADR-0004).

## How it was confirmed working

- **Fresh-clone smoke test** (the same path `release.yml` runs), at `c94bdcb`: `task install` created `roots`, `estate` and `areas` `.local.yaml`, and `task doctor:ci` reported "8/8 checks passed. Install looks healthy." Exit 0 (REQ-025).
- **Feature check in the same clone:** `task bootstrap-areas` created the 7 default notes and a re-run was a no-op. The tracked tree stayed clean.
- **After the merge and tag:** the `release.yml` run on the `v0.3.0` tag is the confirmation of record. It hasn't run yet, because the tag hasn't been pushed.

## Rollback

- **Code:** `git revert <squash-commit>` on `main`. The squash-merge makes the whole change a single commit.
- **Release:** if `v0.3.0` has been pushed, delete the GitHub release and the tag (`gh release delete v0.3.0`, `git push --delete origin v0.3.0`, `git tag -d v0.3.0`).
- **Local state:** `control/areas.local.yaml` and any generated `20-areas/*.md` notes are gitignored operator content. A revert doesn't touch them. The operator can keep them or delete them by hand.
- **Before the merge:** close PR #11 without merging. `main` is unaffected.

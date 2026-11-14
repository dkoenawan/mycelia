<!-- The release record, written by the Deploy agent from the Deploy standard (skills/deploy/SKILL.md). The Deploy tier line sets which sections are required (the standard's tier table); the Deploy gate's check-release.sh refuses a record missing one. Delete a section only if the confirmed tier doesn't require it. A record with no Deploy tier line is a past record and gets no check. -->
# Release: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Phase: Deploy | Started: 2026-11-14 | Status: Draft
> Deploy tier: skip: nothing to deploy, per the declaration (`deployment: none`), and no step ran
> Requirements: [`define/index.md`](define/index.md) · Verification: [`verification.md`](verification.md) · Declaration: `.claude/deploy.json`

## Lifecycles run and why

- **Declaration check:** `check-declaration.sh <repo> --plan` exited 3 with "none: nothing to deploy, per the declaration", "plan: no step runs" and "plan: tier: skip: nothing to deploy, per the declaration". The declaration is `{"deployment": "none"}`. Its note says the framework is installed locally: it's released by merging to `main` and pulling in each checkout, and nothing is published or deployed.
- **L1:** not needed, because the declaration has no deployable parts (`deployment: none`). Delta rows read from [`design/index.md`](design/index.md) (Delta list):
  - New: `src/mycelia.ts`, `src/goals/{domain,application,adapters}/`, `src/goals/cli.ts`, `src/goals/session-prompt.txt`, `01-vision/README.md`, `docs/reference/year-goals/`, `test/goals/`, `test/mycelia.test.ts`.
  - Changed: `package.json` (`bin.mycelia`, `scripts.mycelia`), `eslint.config.js`, `.gitignore`, `README.md`, `CLAUDE.md`.
  - None of these rows is a C4 container, a service or a deployed resource. The `mycelia` command runs locally from a checkout (`npx mycelia`, or `mycelia` after `npm link`). `package.json` is `private` and has no version and no publish target.
- **Added to the declaration at this Deploy (REQ-027):** none.
- **L1 setup run:** none.
- **L2:** nothing to deploy, per the declaration. No step ran.

## Completeness

Nothing ships, per the declaration (`deployment: none`). There's no release manifest to check, and Deploy ran no completeness gate.

For the record, Deploy also read the branch as a merge would deliver it. The check was read-only: Deploy ran nothing from the repo.

- Every `new` or `changed` delta row matches a tracked, changed file on the branch. The only file changed outside the delta is `package-lock.json`, which mirrors the `bin` entry. Nothing is untracked under `src/`, `test/`, `docs/` or `01-vision/`.
- `package.json` `bin.mycelia` points to `src/mycelia.ts`, which is tracked and has a shebang. All `src/goals/` files and the three `docs/reference/year-goals/` files are tracked and non-empty. No `TODO`, `FIXME` or stub markers turned up.
- `01-vision/` ships README-only, as REQ-016 requires. `01-vision/*` is gitignored, and `!01-vision/README.md` keeps the README tracked.
- The Test phase's fresh-clone run gave 291 pass, 0 fail (VER-019).

**Outstanding manual checks (not a completeness gap):** two checks in [`verification.md`](verification.md) are still `pending`. They need the operator, and this release doesn't close them:

- **VER-011** (REQ-009, REQ-011): run `npx mycelia goals session 2027` interactively in a real terminal, without `-p`. Check the question order and end early with both `/exit` and Ctrl+C. Confirm that interactive mode denies the same commands as the `-p` runs. So far only `-p` mode, with the same flags, has been verified (VER-008).
- **VER-018** (REQ-017): open `docs/reference/year-goals/example-2027-goals.md` in Obsidian with no community plugins. Only the GitHub half has been checked (VER-017).

## Change record

- **What changed:** a `mycelia` command (`package.json` `bin`, `src/mycelia.ts`) with a `goals` group (`src/goals/`). It validates, runs an interactive session, saves drafts and signs off year-goals notes (REQ-001 to REQ-021, see [`define/requirements.md`](define/requirements.md)). The change also adds a gitignored `01-vision/` vault folder that ships README-only (REQ-016), plus the year-goals format reference, template and example (REQ-001, REQ-017). README and CLAUDE.md now name both.
- **Version:** none. The declaration is `none` with no versioning rule, and `package.json` has no `version`, so there's no bump.
- **Change type:** standard. Nothing is deployed, and the merge doesn't count towards risk.
- **Change authority:** the operator at the Deploy gate. The operator's steps after that are outside Deploy and not declared: merge the PR for #36, pull `main` in the second-brain checkout, optionally run `npm link`, then run VER-011 and VER-018.

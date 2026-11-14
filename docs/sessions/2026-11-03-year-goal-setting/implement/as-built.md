<!-- The as-built record in the implement/ folder (skills/implement/SKILL.md). Four sections, tables only: never a checklist line here, so nothing in this file can be read as a task. Frozen define/ and design/ are never edited; a difference from the design is recorded as a variation below and decided at the Implement gate. -->
# As built: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Phase: Implement | Started: 2026-11-14 | Status: in progress
> Design: [`design/index.md`](../design/index.md) · Plan: [`tasks.md`](tasks.md) · Session history: [`log.md`](../log.md)

## As-built

| DES | Status | Reason | Unit tests | Component tests |
|---|---|---|---|---|
| DES-001 | built with variation | V1. No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89); built to the repo's conventions (ADR-0007, the Notion connector's layering). | `test/goals/domain.test.ts`: one named test per acceptance case of REQ-002 to REQ-007 and REQ-019 to REQ-021, plus the REQ-018 full 8 x 8 chart, partly filled chart and unrecognised-content cases | none: the domain is pure, so unit tests cover it |
| DES-008 | built as designed | No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89); built to the repo's README and `.gitignore` conventions. | none: a README and ignore rules have no unit | `test/goals/vision-folder.test.ts`: the REQ-016 check-ignore, tracked-files and README tests |
| DES-009 | built as designed | No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89). `format.md` also documents the exit codes and the structured-draft JSON that DES-005 and DES-006 build; the `save-draft` argument form is V2 (DES-006). | `test/goals/docs.test.ts`: the REQ-001 example (0 errors, 0 warnings against `control/areas.example.yaml`, the 2/8/3/8/2/1 shape, default slugs only), the REQ-006 parse of the example, the template (0 errors), and the format.md coverage of every REQ-002, REQ-004, REQ-007 and REQ-020 element, each command, its exit codes and the file locations | none: documents |
| DES-002 | built as designed | No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89). `applySignOff(text, date, changes)` composes the two edits for DES-003. Edits keep the note's line endings (LF or CRLF). | `test/goals/render-edit.test.ts`: the DES-002 round trip on the example, the breakdown kept byte for byte through a sign-off edit, REQ-010 and REQ-011 drafts, one-line texts, in-place and appended frontmatter keys, CRLF, change merge order and dedupe, an empty and a trailing `## Changes` | none: pure functions |
| DES-003 | built with variation | V1, V2. No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89). `currentGoals` returns `{none: false, goals}` or `{none: true, reason}`; it also returns none for a `01-vision/` note that isn't signed off, has errors, or is for another year. A refused use case returns `kind: refused` (the note or input) or `cant-start` (an output path isn't gitignored), so the CLI can map exit codes. | `test/goals/application.test.ts`: REQ-010, REQ-011, REQ-012 (two cases), REQ-013 (sign-off and refusal on errors), REQ-014, the DES-003 write order (re-sign-off and first sign-off), REQ-015 probe-before-write, the save refusals, `validateNote`, and the ESLint layer rule for `application/` and `domain/` | the same file: each use case runs through its public function on in-memory ports (`test/goals/fakes.ts`) |
| DES-004 | built with variation | V3. No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89). The draft is written atomically through `00-inbox/<year>-goals.md.tmp`, which is in `writePaths` and probed. `FsAreaIndex` leaves out `20-areas/README.md`. | none: each adapter is exercised through its public interface instead | `test/goals/adapters.test.ts`: the DES-004 check (a save and two sign-offs on a temp git vault with the framework `.gitignore`: `20-areas/` checksum unchanged, only `01-vision/2027-goals.md` and the archive copy written, all reported ignored, nothing in `git status`), the byte-for-byte archive copy with reuse and suffix, the vault's paths, `FsAreaIndex`, and `GitIgnoreProbe` inside and outside a work tree |

## Variations

| ID | DES | Designed | Built | Why |
|---|---|---|---|---|
| V1 | DES-001, DES-003 | `eslint.config.js` gets the layer rule for `src/goals/{domain,application}/` as part of DES-003. | The `src/goals/domain/` half of the rule landed with DES-001 (task 1); the `application/` half lands with DES-003. The domain rule also forbids imports from outside `src/goals/`, as the connector's rule does for the repo's `src/`. | DES-001's Check is "ESLint's domain rule passes", which needs the rule to exist when DES-001 is built. Nothing else changes. |
| V2 | DES-003 | Four ports: `VisionVault`, `AreaIndex`, `IgnoreProbe` and `Clock`. | A fifth port, `NoteReader`, which `validateNote(path)` uses to read the note it's given. `IgnoreProbe` is `unignored(paths)`, and `VisionVault.writePaths(year, date)` lists the paths the use case probes before writing. | `validate <path>` takes any path, but `VisionVault` is confined by design to the draft, the current note and the archive (REQ-015), so it can't serve an arbitrary read. The probe runs in the use case, before any write, so its order is tested with in-memory ports. |
| V3 | DES-004 | `FsVisionVault` creates the archive file `40-archive/vision/<year>-goals-replaced-<date>.md` exclusively (D6). | It still creates the file exclusively. When the name is taken by an identical copy it reuses it; when it's taken by different content it uses the next free `-2`, `-3` … suffix. | The design leaves the collision open. Its Risks say re-running sign-off after a crash is safe, which needs the identical-copy case to succeed, and a second re-sign-off on the same day would otherwise fail with nothing archived. Nothing is overwritten either way. |

## Layer artifacts

No layer artifact: the design names no layer with Implement guidance (plugin/tooling has none yet, dkoenawan/compass-labs#89).

## Handed to Test

| DES | Check |
|---|---|
| DES-008 | REQ-016 in a fresh clone (integration): `git ls-files 01-vision/` lists only the README, and `01-vision/2027-goals.md` and a draft in `00-inbox/` don't show in `git status --porcelain`. Implement ran it in the working checkout. |
| DES-009 | REQ-017 (inspection): the example shows both centre goals, all 11 pillars, every action, every area link and both secondary goals as text in GitHub's Markdown preview and in Obsidian with no community plugins, and its frontmatter has `name`, `description`, `type`, `created` and `updated`. |


<!-- The as-built record in the implement/ folder (skills/implement/SKILL.md). Four sections, tables only: never a checklist line here, so nothing in this file can be read as a task. Frozen define/ and design/ are never edited; a difference from the design is recorded as a variation below and decided at the Implement gate. -->
# As built: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Phase: Implement | Started: 2026-11-14 | Status: in progress
> Design: [`design/index.md`](../design/index.md) · Plan: [`tasks.md`](tasks.md) · Session history: [`log.md`](../log.md)

## As-built

| DES | Status | Reason | Unit tests | Component tests |
|---|---|---|---|---|
| DES-001 | built with variation | V1. No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89); built to the repo's conventions (ADR-0007, the Notion connector's layering). | `test/goals/domain.test.ts`: one named test per acceptance case of REQ-002 to REQ-007 and REQ-019 to REQ-021, plus the REQ-018 full 8 x 8 chart, partly filled chart and unrecognised-content cases | none: the domain is pure, so unit tests cover it |
| DES-008 | built as designed | No Implement guidance for plugin/tooling (dkoenawan/compass-labs#89); built to the repo's README and `.gitignore` conventions. | none: a README and ignore rules have no unit | `test/goals/vision-folder.test.ts`: the REQ-016 check-ignore, tracked-files and README tests |

## Variations

| ID | DES | Designed | Built | Why |
|---|---|---|---|---|
| V1 | DES-001, DES-003 | `eslint.config.js` gets the layer rule for `src/goals/{domain,application}/` as part of DES-003. | The `src/goals/domain/` half of the rule landed with DES-001 (task 1); the `application/` half lands with DES-003. The domain rule also forbids imports from outside `src/goals/`, as the connector's rule does for the repo's `src/`. | DES-001's Check is "ESLint's domain rule passes", which needs the rule to exist when DES-001 is built. Nothing else changes. |

## Layer artifacts

No layer artifact: the design names no layer with Implement guidance (plugin/tooling has none yet, dkoenawan/compass-labs#89).

## Handed to Test

| DES | Check |
|---|---|
| DES-008 | REQ-016 in a fresh clone (integration): `git ls-files 01-vision/` lists only the README, and `01-vision/2027-goals.md` and a draft in `00-inbox/` don't show in `git status --porcelain`. Implement ran it in the working checkout. |


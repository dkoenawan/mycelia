# As built: Root README Install section: use task install / task bootstrap-areas

> Phase: Implement | Started: 2026-10-24 | Status: ready for the Implement gate
> Design: [`design/index.md`](../design/index.md) · Plan: [`tasks.md`](tasks.md) · Session history: [`log.md`](../log.md)

## As-built

| DES | Status | Reason | Unit tests | Component tests |
|---|---|---|---|---|
| DES-001 | built as designed | Note, not a variation: the README numbers clone + `task install` as step 1, so its steps 2 to 7 carry `install.sh`'s printed steps 1 to 6 and `install.sh`'s step 7 (Obsidian) is the README's closing paragraph, as DES-001 (b) and (c) lay out. The relative order is identical (REQ-007). Self-checked: all four `task` names (`install`, `deps:node`, `doctor`, `bootstrap-areas`) are in `Taskfile.yml`; no `cp control/`, `$EDITOR`, `./scripts/`, absolute path or real URL in the section. | none: documentation only, no unit to test | none: documentation only; the read-through and fresh-clone checks are handed to Test |
| DES-002 | built as designed | | none: a text-only change to printed `log` lines; `bash -n scripts/install.sh` passes | none: the printed output on a fresh clone is an integration check, handed to Test |

## Variations

None.

## Layer artifacts

No layer with Implement guidance is touched: both items are documentation and printed tooling text, and the design names no layer (`design/index.md`, Contents).

## Handed to Test

| DES | Check |
|---|---|
| DES-002 | On a fresh clone, `task install` prints `task deps:node` as a step before the step that runs `task doctor`, and seeds the same three files as before (REQ-011). |
| DES-001 | Inspection: each of REQ-001 to REQ-009's acceptance criteria holds when the Install section is read; every `task <name>` in it is in `Taskfile.yml`; its step order matches DES-002's printed order (REQ-007). |
| DES-001 | Integration: REQ-010, on a fresh clone in a scratch directory with the prerequisites installed, running the section's commands in order (roots set to existing directories) ends with `task doctor` exiting 0 and 7 notes in `20-areas/` besides `README.md`. |

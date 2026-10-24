# As built: Root README Install section: use task install / task bootstrap-areas

> Phase: Implement | Started: 2026-10-24 | Status: in progress
> Design: [`design/index.md`](../design/index.md) · Plan: [`tasks.md`](tasks.md) · Session history: [`log.md`](../log.md)

## As-built

| DES | Status | Reason | Unit tests | Component tests |
|---|---|---|---|---|
| DES-002 | built as designed | | none: a text-only change to printed `log` lines; `bash -n scripts/install.sh` passes | none: the printed output on a fresh clone is an integration check, handed to Test |

## Variations

None.

## Layer artifacts

No layer with Implement guidance is touched: both items are documentation and printed tooling text, and the design names no layer (`design/index.md`, Contents).

## Handed to Test

| DES | Check |
|---|---|
| DES-002 | On a fresh clone, `task install` prints `task deps:node` as a step before the step that runs `task doctor`, and seeds the same three files as before (REQ-011). |

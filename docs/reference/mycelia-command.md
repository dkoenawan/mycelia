# Reference: the `mycelia` command

`mycelia` is the one entry point for mycelia's runtime commands. Each runtime feature is a
subcommand group of it. Taskfile is for installation only (install, dependencies, area
bootstrap, doctor and the `check:node` gate), so runtime commands aren't Taskfile targets.
See [ADR-0010](../adr/0010-taskfile-install-only-and-the-mycelia-command.md).

## Running it

From the repository root, after `task deps:node`:

| Form | Notes |
|---|---|
| `npx mycelia <group> <command> [args]` | Resolves the repository's own `bin`. No setup |
| `npm run mycelia -- <group> <command> [args]` | The `mycelia` script in `package.json` |
| `mycelia <group> <command> [args]` | After `npm link`, which puts `mycelia` on PATH |
| `node src/mycelia.ts <group> <command> [args]` | The same entry point through Node. Used where an exact command is needed, such as the goal-setting session's permission rule |

## Groups

| Group | Commands | Reference |
|---|---|---|
| `goals` | `validate <path>`, `session <year> [--continue]`, `save-draft <year> [<json>]`, `sign-off <year>` | [Year-goals note format](year-goals/format.md#commands) |

`mycelia`, `mycelia help`, `mycelia --help` or `mycelia -h` prints the groups.
`mycelia <group>` with no command prints that group's commands.

The older runtime targets `task ingest-inbox`, `task ingest-inbox:preflight`,
`task notion:setup`, `task notion:pull` and `task notion:pull:preflight` aren't `mycelia`
groups yet. Moving them is #47.

## Exit codes

| Code | Meaning |
|---|---|
| The group's own | A group's exit code is passed through unchanged. For `goals`: 0 success, 1 refused, 2 usage error or can't start |
| 2 | Usage error from the dispatcher: no group, `help`, or an unknown group |
| 3 | An unexpected failure in a group (an uncaught error). The stack is printed to stderr |

## How groups are wired

- **Code.** `src/mycelia.ts` holds `GROUPS`, a map from group name to `{ summary, load }`.
  `load` imports the group's module lazily, so only the named group is loaded. The module
  exports `run(args: string[]): Promise<number>` and returns its exit code rather than
  calling `process.exit`.
- **Tests.** `dispatch(argv, groups?, err?)` is exported, so a group's routing and exit
  codes are tested under `task check:node` without starting a process.
  `test/mycelia.test.ts` covers the dispatcher.

Origin: #36

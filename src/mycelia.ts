#!/usr/bin/env node
// The `mycelia` command (DES-007, D7): one runtime entry point with subcommand
// groups. Taskfile is for installation only; runtime features add a group here.
//
//   npx mycelia <group> <command> [args]      (in the repository)
//   npm run mycelia -- <group> <command> [args]
//   mycelia <group> <command> [args]          (after `npm link`)
//
// Each group's module exports run(args): Promise<number>, imported only when
// that group runs. Exit codes are the group's; 2 for a usage error here, 3 for
// an unexpected failure.
import { realpathSync } from "node:fs";

export interface Group {
  run(args: string[]): Promise<number>;
}

export interface GroupEntry {
  summary: string;
  load: () => Promise<Group>;
}

export const GROUPS: Readonly<Record<string, GroupEntry>> = {
  goals: { summary: "year goals: validate, session, save-draft, sign-off", load: () => import("./goals/cli.ts") },
};

export const EXIT_USAGE = 2;
export const EXIT_UNEXPECTED = 3;

export function usage(groups: Readonly<Record<string, GroupEntry>>): string {
  const names = Object.keys(groups);
  const width = Math.max(...names.map((n) => n.length));
  return ["usage: mycelia <group> <command> [args]", "", "groups:", ...names.map((n) => `  ${n.padEnd(width)}  ${groups[n]?.summary ?? ""}`), "", "Run `mycelia <group>` for its commands."].join("\n");
}

/** Run `mycelia <group> …`. Returns the exit code. */
export async function dispatch(argv: string[], groups: Readonly<Record<string, GroupEntry>> = GROUPS, err: (line: string) => void = (l) => process.stderr.write(`${l}\n`)): Promise<number> {
  const [name, ...rest] = argv;
  const entry = name !== undefined && Object.hasOwn(groups, name) ? groups[name] : undefined;
  if (entry === undefined) {
    if (name !== undefined && !["help", "--help", "-h"].includes(name)) err(`mycelia: unknown group "${name}"`);
    err(usage(groups));
    return EXIT_USAGE;
  }
  try {
    const group = await entry.load();
    return await group.run(rest);
  } catch (e) {
    err(`mycelia: unexpected failure: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return EXIT_UNEXPECTED;
  }
}

function invokedDirectly(): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return realpathSync(script) === import.meta.filename;
  } catch {
    return false;
  }
}

if (invokedDirectly()) process.exitCode = await dispatch(process.argv.slice(2));

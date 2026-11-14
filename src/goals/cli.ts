// The `goals` command group (DES-005, D5): the composition root, and the only
// place that builds adapters. Called by the `mycelia` dispatcher (DES-007):
//
//   mycelia goals validate <path>
//   mycelia goals session <year> [--continue]
//   mycelia goals save-draft <year> [<json>]     (the draft JSON, or on stdin)
//   mycelia goals sign-off <year>
//
// Exit codes: 0 done; 1 refused (errors, or nothing to do), nothing changed;
// 2 usage error, unreadable file, or can't start. Never runs git add or commit.
import path from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "../lib/paths.ts";
import { FsAreaIndex } from "./adapters/areas.ts";
import { SystemClock } from "./adapters/clock.ts";
import { GitIgnoreProbe } from "./adapters/ignore.ts";
import { FsNoteReader } from "./adapters/reader.ts";
import { defaultSessionDeps, runSession, type SessionDeps } from "./adapters/session.ts";
import { FsVisionVault } from "./adapters/vault.ts";
import type { Clock } from "./application/ports.ts";
import { saveDraft, signOff, validateNote, type DraftBody, type Refusal } from "./application/use-cases.ts";
import type { Diagnostic, YearGoals } from "./domain/model.ts";

export const EXIT = { ok: 0, refused: 1, usage: 2 } as const;

export const USAGE = [
  "usage: mycelia goals <command>",
  "  validate <path>                check a year-goals note",
  "  session <year> [--continue]    draft the year's goals with the agent",
  "  save-draft <year> [<json>]     write the year's inbox draft from JSON (argument or stdin)",
  "  sign-off <year>                make the year's inbox draft its current goals",
].join("\n");

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  readStdin: () => Promise<string>;
}

export interface CliDeps {
  /** The vault (the repository root). */
  root: string;
  /** Where relative `validate` paths resolve from. */
  cwd: string;
  clock: Clock;
  io: Io;
  /** Overrides for the session launcher's outside world (tests). */
  session?: Partial<Pick<SessionDeps, "env" | "resolveClaude" | "preflight" | "spawn" | "template">>;
}

async function readProcessStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function defaultDeps(): CliDeps {
  return {
    root: REPO_ROOT,
    cwd: process.cwd(),
    clock: new SystemClock(),
    io: {
      out: (l) => process.stdout.write(`${l}\n`),
      err: (l) => process.stderr.write(`${l}\n`),
      readStdin: readProcessStdin,
    },
  };
}

// --- shared output -------------------------------------------------------

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export function summary(g: YearGoals): string {
  const pillars = g.mainGoals.map((m) => m.pillars.length);
  const main = `${plural(g.mainGoals.length, "main goal")}${pillars.length > 0 ? ` (pillars: ${pillars.join(", ")})` : ""}`;
  return `${main}, ${plural(g.secondaryGoals.length, "secondary goal")}, ${plural(g.changes.length, "change")}`;
}

function printDiagnostics(io: Io, label: string, diagnostics: readonly Diagnostic[]): void {
  for (const d of diagnostics) io.out(`${label}: ${d.severity}: ${d.where}: ${d.message}`);
}

function printRefusal(io: Io, label: string, r: Refusal): number {
  printDiagnostics(io, label, r.diagnostics);
  io.err(`${label}: ${r.message}`);
  return r.kind === "cant-start" ? EXIT.usage : EXIT.refused;
}

function parseYear(s: string | undefined): number | null {
  return s !== undefined && /^\d{4}$/.test(s) ? Number(s) : null;
}

const counts = (d: readonly Diagnostic[]): string => {
  const e = d.filter((x) => x.severity === "error").length;
  return `${plural(e, "error")}, ${plural(d.length - e, "warning")}`;
};

// --- the draft JSON (D2) --------------------------------------------------

const line = z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(1, "must not be empty"));
const area = z.string().transform((s) => s.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").trim()).pipe(z.string().min(1, "must not be empty"));
export const DraftSchema = z.object({
  mainGoals: z.array(z.object({
    centre: line,
    pillars: z.array(z.object({ name: line, areas: z.array(area).default([]), actions: z.array(line).default([]) })).default([]),
  })).default([]),
  secondaryGoals: z.array(z.object({ text: line, areas: z.array(area).default([]) })).default([]),
});

export function parseDraftJson(text: string): { ok: true; body: DraftBody } | { ok: false; message: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, message: `the draft isn't valid JSON (${e instanceof Error ? e.message : String(e)})` };
  }
  const r = DraftSchema.safeParse(raw);
  if (!r.success) return { ok: false, message: `the draft doesn't have the expected shape:\n${z.prettifyError(r.error)}` };
  return { ok: true, body: r.data };
}

// --- subcommands ----------------------------------------------------------

async function cmdValidate(args: string[], deps: CliDeps): Promise<number> {
  const [file, ...rest] = args;
  if (file === undefined || rest.length > 0) {
    deps.io.err("usage: mycelia goals validate <path>");
    return EXIT.usage;
  }
  const r = await validateNote(path.resolve(deps.cwd, file), { reader: new FsNoteReader(), areas: new FsAreaIndex(deps.root) });
  if (!r.ok) {
    deps.io.err(`${file}: ${r.message}`);
    return EXIT.usage;
  }
  printDiagnostics(deps.io, file, r.diagnostics);
  deps.io.out(`${file}: found ${summary(r.goals)}; ${counts(r.diagnostics)}`);
  return r.diagnostics.some((d) => d.severity === "error") ? EXIT.refused : EXIT.ok;
}

async function cmdSaveDraft(args: string[], deps: CliDeps): Promise<number> {
  const year = parseYear(args[0]);
  if (year === null || args.length > 2) {
    deps.io.err("usage: mycelia goals save-draft <year> [<json>]   (a four-digit year; the draft JSON as the argument or on stdin)");
    return EXIT.usage;
  }
  const label = `save-draft ${year}`;
  const json = args[1] ?? (await deps.io.readStdin());
  const parsed = parseDraftJson(json);
  if (!parsed.ok) {
    deps.io.err(`${label}: ${parsed.message}\nNothing was changed.`);
    return EXIT.refused;
  }
  const r = await saveDraft(year, parsed.body, { vault: new FsVisionVault(deps.root), probe: new GitIgnoreProbe(deps.root), clock: deps.clock, areas: new FsAreaIndex(deps.root) });
  if (!r.ok) return printRefusal(deps.io, label, r);
  printDiagnostics(deps.io, r.path, r.diagnostics);
  deps.io.out(`saved ${r.path}: ${summary({ year, status: "draft", signedOff: null, ...parsed.body, changes: [] })}`);
  return EXIT.ok;
}

async function cmdSignOff(args: string[], deps: CliDeps): Promise<number> {
  const year = parseYear(args[0]);
  if (year === null || args.length > 1) {
    deps.io.err("usage: mycelia goals sign-off <year>   (a four-digit year)");
    return EXIT.usage;
  }
  const label = `00-inbox/${year}-goals.md`;
  const r = await signOff(year, { vault: new FsVisionVault(deps.root), probe: new GitIgnoreProbe(deps.root), clock: deps.clock, areas: new FsAreaIndex(deps.root) });
  if (!r.ok) return printRefusal(deps.io, label, r);
  printDiagnostics(deps.io, label, r.diagnostics);
  if (r.archived !== null) deps.io.out(`archived the earlier note, unchanged: ${r.archived}`);
  deps.io.out(`signed off: ${r.path} is now the current goals for ${year}`);
  return EXIT.ok;
}

function cmdSession(args: string[], deps: CliDeps): Promise<number> {
  const base = defaultSessionDeps(deps.root, {
    areas: new FsAreaIndex(deps.root),
    vault: new FsVisionVault(deps.root),
    probe: new GitIgnoreProbe(deps.root),
    today: () => deps.clock.today(),
    out: deps.io.out,
    err: deps.io.err,
  });
  return runSession(args, { ...base, ...deps.session });
}

/** Run one `goals` subcommand. Returns the exit code. */
export async function run(args: string[], deps: CliDeps = defaultDeps()): Promise<number> {
  const [cmd, ...rest] = args;
  switch (cmd) {
    case "validate":
      return cmdValidate(rest, deps);
    case "save-draft":
      return cmdSaveDraft(rest, deps);
    case "sign-off":
      return cmdSignOff(rest, deps);
    case "session":
      return cmdSession(rest, deps);
    default:
      deps.io.err(USAGE);
      return EXIT.usage;
  }
}

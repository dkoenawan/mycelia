// The goals use cases (DES-003): validateNote, currentGoals, saveDraft and
// signOff. They see only the domain and the ports.
import { applySignOff } from "../domain/edit.ts";
import { isIsoDate, type Change, type Diagnostic, type MainGoal, type SecondaryGoal, type YearGoals } from "../domain/model.ts";
import { parse, parseDetailed } from "../domain/parse.ts";
import { renderDraft } from "../domain/render.ts";
import { hasErrors, validate } from "../domain/validate.ts";
import type { AreaIndex, Clock, IgnoreProbe, NoteReader, VisionVault } from "./ports.ts";

/** A use case that changed nothing. `cant-start` is an environment fault; `refused` is about the note or the input. */
export interface Refusal {
  ok: false;
  kind: "refused" | "cant-start";
  message: string;
  diagnostics: Diagnostic[];
}

const refuse = (message: string, diagnostics: Diagnostic[] = []): Refusal => ({ ok: false, kind: "refused", message, diagnostics });

async function knownAreas(areas: AreaIndex | undefined): Promise<ReadonlySet<string> | null> {
  return areas ? new Set(await areas.list()) : null;
}

async function ensureIgnored(probe: IgnoreProbe, paths: readonly string[]): Promise<Refusal | null> {
  const open = await probe.unignored(paths);
  if (open.length === 0) return null;
  return {
    ok: false,
    kind: "cant-start",
    message: `these paths aren't gitignored, so a goals note could be committed: ${open.join(", ")}. Restore the framework's .gitignore. Nothing was changed.`,
    diagnostics: [],
  };
}

// --- validateNote ---------------------------------------------------------

export type ValidateResult =
  | { ok: true; diagnostics: Diagnostic[]; goals: YearGoals }
  | { ok: false; kind: "unreadable"; message: string };

export async function validateNote(path: string, deps: { reader: NoteReader; areas?: AreaIndex }): Promise<ValidateResult> {
  let text: string;
  try {
    text = await deps.reader.read(path);
  } catch (e) {
    return { ok: false, kind: "unreadable", message: `can't read ${path}: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, diagnostics: validate(text, await knownAreas(deps.areas)), goals: parse(text) };
}

// --- currentGoals (REQ-012) -------------------------------------------------

export type CurrentGoals = { none: false; goals: YearGoals } | { none: true; reason: string };

/** The year's current goals: its signed-off note in 01-vision/, and nothing else. */
export async function currentGoals(year: number, deps: { vault: VisionVault }): Promise<CurrentGoals> {
  const text = await deps.vault.readCurrent(year);
  if (text === null) return { none: true, reason: `no signed-off year-goals note exists for ${year} in 01-vision/` };
  if (hasErrors(validate(text, null))) return { none: true, reason: `01-vision/${year}-goals.md has errors; run \`npx mycelia goals validate 01-vision/${year}-goals.md\`` };
  const goals = parse(text);
  if (goals.status !== "signed-off") return { none: true, reason: `01-vision/${year}-goals.md isn't signed off (status: ${goals.status ?? "missing"})` };
  if (goals.year !== year) return { none: true, reason: `01-vision/${year}-goals.md is for year ${goals.year ?? "missing"}, not ${year}` };
  return { none: false, goals };
}

// --- saveDraft (REQ-010, REQ-011) -------------------------------------------

/** What the session agent passes to the save step (D2). */
export interface DraftBody {
  mainGoals: MainGoal[];
  secondaryGoals: SecondaryGoal[];
}

export type SaveResult = { ok: true; path: string; diagnostics: Diagnostic[] } | Refusal;

export async function saveDraft(
  year: number,
  body: DraftBody,
  deps: { vault: VisionVault; probe: IgnoreProbe; clock: Clock; areas?: AreaIndex },
): Promise<SaveResult> {
  if (body.mainGoals.length === 0 && body.secondaryGoals.length === 0) {
    return refuse("the draft has no goal at all: agree at least one centre goal or secondary goal before saving. Nothing was changed.");
  }
  const today = deps.clock.today();
  const existing = await deps.vault.readDraft(year);
  let created = today;
  if (existing !== null) {
    const fm = parseDetailed(existing).frontmatter.data;
    if (fm?.["status"] !== "draft") {
      return refuse(`00-inbox/${year}-goals.md exists and isn't a draft (status: ${typeof fm?.["status"] === "string" ? fm["status"] : "missing"}). Move or rename it first. Nothing was changed.`);
    }
    const c = fm["created"];
    if (typeof c === "string" && isIsoDate(c)) created = c;
  }
  const text = renderDraft({ year, status: "draft", signedOff: null, mainGoals: body.mainGoals, secondaryGoals: body.secondaryGoals, changes: [] }, { created, updated: today });
  const diagnostics = validate(text, await knownAreas(deps.areas));
  if (hasErrors(diagnostics)) return refuse("the draft isn't a valid year-goals note. Nothing was changed.", diagnostics);
  const fault = await ensureIgnored(deps.probe, deps.vault.writePaths(year, today));
  if (fault) return fault;
  const path = await deps.vault.writeDraft(year, text);
  return { ok: true, path, diagnostics };
}

// --- signOff (REQ-013, REQ-014) ---------------------------------------------

export type SignOffResult = { ok: true; path: string; archived: string | null; diagnostics: Diagnostic[] } | Refusal;

/** The changes entry a re-sign-off adds (REQ-014). */
export function updateEntry(date: string, earlierSignedOff: string | null): Change {
  return {
    date,
    text: `re-signed off: these goals replace the ones signed off on ${earlierSignedOff ?? "an earlier date"}, now in 40-archive/vision/`,
  };
}

/**
 * Make the year's inbox draft its current goals. Writes, in order: the new
 * note to a temporary file in 01-vision/, a copy of the earlier note to the
 * archive, the rename into place, then removal of the inbox draft.
 */
export async function signOff(
  year: number,
  deps: { vault: VisionVault; probe: IgnoreProbe; clock: Clock; areas?: AreaIndex },
): Promise<SignOffResult> {
  const draft = await deps.vault.readDraft(year);
  if (draft === null) return refuse(`no draft for ${year} in 00-inbox/ (expected 00-inbox/${year}-goals.md). Run \`npx mycelia goals session ${year}\` first. Nothing was changed.`);
  const diagnostics = validate(draft, await knownAreas(deps.areas));
  if (hasErrors(diagnostics)) return refuse(`00-inbox/${year}-goals.md has errors, so it can't be signed off. Nothing was changed.`, diagnostics);
  const model = parse(draft);
  if (model.status !== "draft") return refuse(`00-inbox/${year}-goals.md isn't a draft (status: ${model.status ?? "missing"}). Nothing was changed.`, diagnostics);
  if (model.year !== year) return refuse(`00-inbox/${year}-goals.md is for year ${model.year ?? "missing"}, not ${year}. Nothing was changed.`, diagnostics);

  const today = deps.clock.today();
  const current = await deps.vault.readCurrent(year);
  const fault = await ensureIgnored(deps.probe, deps.vault.writePaths(year, today));
  if (fault) return fault;

  const carried = current === null ? [] : [...parse(current).changes, updateEntry(today, parse(current).signedOff)];
  const text = applySignOff(draft, today, carried);

  await deps.vault.writeCurrentTemp(year, text);
  const archived = current === null ? null : await deps.vault.archiveCurrent(year, today);
  const path = await deps.vault.commitCurrent(year);
  await deps.vault.removeDraft(year);
  return { ok: true, path, archived, diagnostics };
}

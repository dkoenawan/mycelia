// Ports for the goals use cases (DES-003, D5). The adapters in ../adapters/
// implement them; the tests use in-memory fakes.

/**
 * The year-goals files: the inbox draft, the current note and the archive,
 * and nothing else (REQ-015). Paths are repo-relative, with forward slashes.
 */
export interface VisionVault {
  /** Every path a save or sign-off for `year` on `date` may write, for the ignore probe. */
  writePaths(year: number, date: string): string[];
  readDraft(year: number): Promise<string | null>;
  /** Write `00-inbox/<year>-goals.md` (atomically). Returns its path. */
  writeDraft(year: number, text: string): Promise<string>;
  removeDraft(year: number): Promise<void>;
  readCurrent(year: number): Promise<string | null>;
  /** Write the new current note to its temporary file in `01-vision/`. */
  writeCurrentTemp(year: number, text: string): Promise<void>;
  /** Copy the current note, byte for byte, into `40-archive/vision/`. Returns the archive path. */
  archiveCurrent(year: number, date: string): Promise<string>;
  /** Rename the temporary file over `01-vision/<year>-goals.md`. Returns its path. */
  commitCurrent(year: number): Promise<string>;
}

/** The `20-areas/` note stems. Read only. */
export interface AreaIndex {
  list(): Promise<string[]>;
}

/** Which of `paths` git would not ignore (empty when all are ignored). */
export interface IgnoreProbe {
  unignored(paths: readonly string[]): Promise<string[]>;
}

export interface Clock {
  /** Today's date, YYYY-MM-DD, local time. */
  today(): string;
}

/** Reads one note given by the operator, for `validate <path>`. */
export interface NoteReader {
  read(path: string): Promise<string>;
}

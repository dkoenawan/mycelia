// Reads the one note `validate <path>` is given (DES-005).
import { readFile } from "node:fs/promises";
import type { NoteReader } from "../application/ports.ts";

export class FsNoteReader implements NoteReader {
  read(path: string): Promise<string> {
    return readFile(path, "utf8");
  }
}

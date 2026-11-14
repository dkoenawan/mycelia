// Filesystem adapters for the goals vault (DES-004). FsVisionVault writes only
// the year's inbox draft, its 01-vision/ note (and that note's temporary file),
// and its archive copy (D6). Nothing here touches 20-areas/ (REQ-015).
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VisionVault } from "../application/ports.ts";

export const INBOX_DIR = "00-inbox";
export const VISION_DIR = "01-vision";
export const ARCHIVE_DIR = "40-archive/vision";

const MAX_ARCHIVE_SUFFIX = 99;

function code(e: unknown): string | undefined {
  return (e as { code?: string } | null)?.code;
}

async function readOrNull(p: string): Promise<string | null> {
  try {
    return await readFile(p, "utf8");
  } catch (e) {
    if (code(e) === "ENOENT") return null;
    throw e;
  }
}

export class FsVisionVault implements VisionVault {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  draftRel = (year: number): string => `${INBOX_DIR}/${year}-goals.md`;
  currentRel = (year: number): string => `${VISION_DIR}/${year}-goals.md`;
  tempRel = (year: number): string => `${VISION_DIR}/${year}-goals.md.tmp`;
  archiveRel = (year: number, date: string, n = 1): string => `${ARCHIVE_DIR}/${year}-goals-replaced-${date}${n > 1 ? `-${n}` : ""}.md`;

  private abs(rel: string): string {
    return path.join(this.root, ...rel.split("/"));
  }

  writePaths(year: number, date: string): string[] {
    return [this.draftRel(year), `${this.draftRel(year)}.tmp`, this.currentRel(year), this.tempRel(year), this.archiveRel(year, date)];
  }

  readDraft(year: number): Promise<string | null> {
    return readOrNull(this.abs(this.draftRel(year)));
  }

  async writeDraft(year: number, text: string): Promise<string> {
    const rel = this.draftRel(year);
    await mkdir(this.abs(INBOX_DIR), { recursive: true });
    const tmp = `${this.abs(rel)}.tmp`;
    await writeFile(tmp, text, "utf8");
    await rename(tmp, this.abs(rel));
    return rel;
  }

  async removeDraft(year: number): Promise<void> {
    try {
      await unlink(this.abs(this.draftRel(year)));
    } catch (e) {
      if (code(e) !== "ENOENT") throw e;
    }
  }

  readCurrent(year: number): Promise<string | null> {
    return readOrNull(this.abs(this.currentRel(year)));
  }

  async writeCurrentTemp(year: number, text: string): Promise<void> {
    await mkdir(this.abs(VISION_DIR), { recursive: true });
    await writeFile(this.abs(this.tempRel(year)), text, "utf8");
  }

  /**
   * Copy the current note to the archive, creating the file exclusively. If
   * that name is taken by an identical copy (a re-run after a crash), it's
   * reused. If it's taken by different content (a second re-sign-off on the
   * same day), the next free `-2`, `-3` … name is used.
   */
  async archiveCurrent(year: number, date: string): Promise<string> {
    await mkdir(this.abs(ARCHIVE_DIR), { recursive: true });
    const src = this.abs(this.currentRel(year));
    const bytes = await readFile(src);
    for (let n = 1; n <= MAX_ARCHIVE_SUFFIX; n++) {
      const rel = this.archiveRel(year, date, n);
      try {
        await copyFile(src, this.abs(rel), constants.COPYFILE_EXCL);
        return rel;
      } catch (e) {
        if (code(e) !== "EEXIST") throw e;
        if ((await readFile(this.abs(rel))).equals(bytes)) return rel;
      }
    }
    throw new Error(`too many archive copies of ${this.currentRel(year)} for ${date} in ${ARCHIVE_DIR}/`);
  }

  async commitCurrent(year: number): Promise<string> {
    const rel = this.currentRel(year);
    await rename(this.abs(this.tempRel(year)), this.abs(rel));
    return rel;
  }
}

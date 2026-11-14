// The area index (DES-004): the stems of the notes directly in 20-areas/.
// Read only (REQ-015).
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { AreaIndex } from "../application/ports.ts";

export class FsAreaIndex implements AreaIndex {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async list(): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(path.join(this.root, "20-areas"), { withFileTypes: true });
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return [];
      throw e;
    }
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md")
      .map((e) => e.name.slice(0, -".md".length))
      .sort();
  }
}

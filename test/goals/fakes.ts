// In-memory ports for the goals use-case tests (DES-003).
import type { AreaIndex, Clock, IgnoreProbe, NoteReader, VisionVault } from "../../src/goals/application/ports.ts";

/** A VisionVault over a Map of repo-relative path to text, recording each write in order. */
export class MemoryVault implements VisionVault {
  readonly files = new Map<string, string>();
  readonly ops: string[] = [];

  constructor(files: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(files)) this.files.set(k, v);
  }

  draftPath = (y: number): string => `00-inbox/${y}-goals.md`;
  currentPath = (y: number): string => `01-vision/${y}-goals.md`;
  tempPath = (y: number): string => `01-vision/${y}-goals.md.tmp`;
  archivePath = (y: number, d: string): string => `40-archive/vision/${y}-goals-replaced-${d}.md`;

  writePaths(year: number, date: string): string[] {
    return [this.draftPath(year), `${this.draftPath(year)}.tmp`, this.currentPath(year), this.tempPath(year), this.archivePath(year, date)];
  }
  readDraft(year: number): Promise<string | null> {
    return Promise.resolve(this.files.get(this.draftPath(year)) ?? null);
  }
  writeDraft(year: number, text: string): Promise<string> {
    this.ops.push(`writeDraft ${this.draftPath(year)}`);
    this.files.set(this.draftPath(year), text);
    return Promise.resolve(this.draftPath(year));
  }
  removeDraft(year: number): Promise<void> {
    this.ops.push(`removeDraft ${this.draftPath(year)}`);
    this.files.delete(this.draftPath(year));
    return Promise.resolve();
  }
  readCurrent(year: number): Promise<string | null> {
    return Promise.resolve(this.files.get(this.currentPath(year)) ?? null);
  }
  writeCurrentTemp(year: number, text: string): Promise<void> {
    this.ops.push(`writeCurrentTemp ${this.tempPath(year)}`);
    this.files.set(this.tempPath(year), text);
    return Promise.resolve();
  }
  archiveCurrent(year: number, date: string): Promise<string> {
    const p = this.archivePath(year, date);
    this.ops.push(`archiveCurrent ${p}`);
    const cur = this.files.get(this.currentPath(year));
    if (cur === undefined) return Promise.reject(new Error("no current note"));
    this.files.set(p, cur);
    return Promise.resolve(p);
  }
  commitCurrent(year: number): Promise<string> {
    this.ops.push(`commitCurrent ${this.currentPath(year)}`);
    const t = this.files.get(this.tempPath(year));
    if (t === undefined) return Promise.reject(new Error("no temp file"));
    this.files.set(this.currentPath(year), t);
    this.files.delete(this.tempPath(year));
    return Promise.resolve(this.currentPath(year));
  }
}

export class FixedClock implements Clock {
  date: string;
  constructor(date: string) {
    this.date = date;
  }
  today(): string {
    return this.date;
  }
}

export class StaticAreas implements AreaIndex {
  private readonly slugs: string[];
  constructor(slugs: string[]) {
    this.slugs = slugs;
  }
  list(): Promise<string[]> {
    return Promise.resolve([...this.slugs]);
  }
}

/** Reports `open` paths as not ignored, and records every probe. */
export class FakeProbe implements IgnoreProbe {
  readonly probed: string[][] = [];
  private readonly open: string[];
  constructor(open: string[] = []) {
    this.open = open;
  }
  unignored(paths: readonly string[]): Promise<string[]> {
    this.probed.push([...paths]);
    return Promise.resolve(paths.filter((p) => this.open.includes(p)));
  }
}

export class MapReader implements NoteReader {
  private readonly files: Record<string, string>;
  constructor(files: Record<string, string>) {
    this.files = files;
  }
  read(path: string): Promise<string> {
    const t = this.files[path];
    return t === undefined ? Promise.reject(new Error("ENOENT: no such file")) : Promise.resolve(t);
  }
}

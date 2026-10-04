// Builds throwaway fixture vaults in a temp directory (D4: no committed .md fixtures).
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface TempVault {
  root: string;
  write(rel: string, body: string | Buffer): string;
  done(): void;
}

export function tempVault(files: Record<string, string> = {}, opts: { skeleton?: boolean } = {}): TempVault {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "mycelia-vault-")));
  const write = (rel: string, body: string | Buffer): string => {
    const p = path.join(root, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
    return p;
  };
  if (opts.skeleton !== false) {
    for (const d of ["00-inbox/capture", "10-projects", "20-areas", "30-resources", "40-archive", "daily", "control"]) {
      mkdirSync(path.join(root, d), { recursive: true });
    }
    write("00-inbox/capture/README.md", "---\nname: capture-readme\ndescription: x\ntype: reference\n---\n");
  }
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  return { root, write, done: () => { rmSync(root, { recursive: true, force: true }); } };
}

export function note(name: string, description: string, body = ""): string {
  return `---\nname: ${name}\ndescription: ${description}\ntype: area\ncreated: 2026-09-01\nupdated: 2026-09-01\n---\n\n${body}`;
}

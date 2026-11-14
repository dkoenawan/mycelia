// The ignore probe (DES-004): `git check-ignore` for each path before any write,
// as the ingester does, so a goals note can't become a tracked file.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IgnoreProbe } from "../application/ports.ts";

const execFileP = promisify(execFile);

export class GitIgnoreProbe implements IgnoreProbe {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private async insideWorkTree(): Promise<boolean> {
    try {
      const { stdout } = await execFileP("git", ["rev-parse", "--is-inside-work-tree"], { cwd: this.root });
      return stdout.trim() === "true";
    } catch {
      return false; // not a work tree (or no git): nothing can be tracked
    }
  }

  async unignored(paths: readonly string[]): Promise<string[]> {
    if (!(await this.insideWorkTree())) return [];
    const open: string[] = [];
    for (const p of paths) {
      try {
        await execFileP("git", ["check-ignore", "-q", "--no-index", p], { cwd: this.root });
      } catch {
        open.push(p);
      }
    }
    return open;
  }
}

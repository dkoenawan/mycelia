// Target index (DES-007): the seam for #13. It's the agent's starting hint, the
// validator's allow-list and the source of the tool policy's read scope.
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import type { ReadScope } from "./agent/provider.ts";
import { oneLine, readFrontmatter } from "./frontmatter.ts";
import type { VaultIndex } from "./vault.ts";

export interface Target {
  slug: string;
  kind: "area" | "project";
  relPath: string;
  description: string;
}

export interface TargetIndex {
  targets(): Target[];
  readScope(): ReadScope;
}

export const TARGET_DIRS: readonly [string, Target["kind"]][] = [["20-areas", "area"], ["10-projects", "project"]];
export const READ_EXCLUDED = ["control", ".state", "node_modules"];

/** MVP implementation: notes directly inside 20-areas/ and 10-projects/, frontmatter only. */
export class FlatTargetIndex implements TargetIndex {
  private list: Target[] = [];
  private readonly root: string;
  /** Targets left out because their stem is ambiguous vault-wide (counted in run-end). */
  excluded = 0;
  readonly warnings: string[] = [];

  private constructor(root: string) {
    this.root = root;
  }

  static async load(root: string, vault: VaultIndex): Promise<FlatTargetIndex> {
    const idx = new FlatTargetIndex(root);
    for (const [dir, kind] of TARGET_DIRS) {
      const names = readdirSync(path.join(root, dir), { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md") && e.name.toLowerCase() !== "readme.md")
        .map((e) => e.name)
        .sort();
      for (const name of names) {
        const relPath = `${dir}/${name}`;
        const slug = name.slice(0, -3);
        if (lstatSync(path.join(root, relPath)).isSymbolicLink()) continue;
        if (vault.stemPaths(slug).length !== 1) {
          idx.excluded++;
          idx.warnings.push(`target ${relPath} left out: its name is shared by another note, so [[${slug}]] is ambiguous`);
          continue;
        }
        const fm = await readFrontmatter(path.join(root, relPath));
        if (fm.error) idx.warnings.push(`target ${relPath}: frontmatter doesn't parse (${fm.error}); using an empty description`);
        idx.list.push({ slug, kind, relPath, description: oneLine(fm.data?.["description"]) });
      }
    }
    return idx;
  }

  targets(): Target[] {
    return [...this.list];
  }

  bySlug(slug: string): Target | undefined {
    const s = slug.toLowerCase();
    return this.list.find((t) => t.slug.toLowerCase() === s);
  }

  readScope(): ReadScope {
    const root = realpathSync(this.root);
    return { root, excluded: READ_EXCLUDED.map((d) => path.join(root, d)) };
  }
}

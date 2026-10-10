// Repository paths. The root is two levels above src/lib/, the same rule as
// common.sh's MYCELIA_ROOT (DES-001).
import path from "node:path";

export const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..");

export function rel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join("/");
}

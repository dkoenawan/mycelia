// Vault writer (DES-010, D8): the connector's own vault writes, and nothing
// else: capture items (exclusive create), its asks, and its daily block.
// Everything the ingester writes goes through the ingester's write set.
import { createHash } from "node:crypto";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { INBOX_DIR } from "../../../../../src/ingest/asks.ts";
import { CAPTURE_DIR } from "../../../../../src/ingest/capture.ts";
import { VaultIndex } from "../../../../../src/ingest/vault.ts";
import { appendDaily } from "../../../../../src/lib/daily.ts";
import type { VaultWriter } from "../../application/ports.ts";
import { isIgnored } from "../config/yaml-config.ts";
import { PULL_LEDGER_REL } from "../ledger/jsonl-ledger.ts";

/** Paths the pull run writes that must be gitignored before it starts (DES-009). */
export const PULL_IGNORE_PROBES = [`${CAPTURE_DIR}/probe.md`, `${INBOX_DIR}/probe.md`, "daily/probe.md", PULL_LEDGER_REL];

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function createExclusive(abs: string, content: string): Promise<void> {
  const fh = await open(abs, "wx");
  try {
    await fh.writeFile(content);
    await fh.sync();
  } finally {
    await fh.close();
  }
}

export class FsVaultWriter implements VaultWriter {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async unignoredPaths(): Promise<string[]> {
    const out: string[] = [];
    for (const p of PULL_IGNORE_PROBES) if (!(await isIgnored(this.root, p))) out.push(p);
    return out;
  }

  captureExists(name: string): Promise<boolean> {
    return exists(path.join(this.root, CAPTURE_DIR, name));
  }

  async writeCapture(name: string, content: string): Promise<string> {
    if (name.includes("/") || name.startsWith(".")) throw new Error(`refusing an unsafe capture name: ${name}`);
    await createExclusive(path.join(this.root, CAPTURE_DIR, name), content);
    return createHash("sha256").update(content).digest("hex");
  }

  async hintTargetExists(slug: string): Promise<boolean> {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return false;
    return (await exists(path.join(this.root, "20-areas", `${slug}.md`))) || exists(path.join(this.root, "10-projects", `${slug}.md`));
  }

  uniqueAskStem(base: string): Promise<string> {
    return Promise.resolve(VaultIndex.build(this.root).uniqueStem(base));
  }

  async writeAsk(stem: string, content: string): Promise<string> {
    const rel = `${INBOX_DIR}/${stem}.md`;
    await createExclusive(path.join(this.root, rel), content);
    return rel;
  }

  async appendDaily(date: string, block: string): Promise<void> {
    await appendDaily(this.root, date, block, { block: true });
  }
}

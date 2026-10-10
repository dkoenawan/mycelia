// Per-item transaction journal (DES-015, D7): plan every change in memory,
// journal it with pre-images, apply, then commit (ledger first) or roll back.
// Rollback is hash-guarded and idempotent, and refuses to touch anything if a
// file matches neither its before nor its after state (the operator edited it).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { link, mkdir, open, readFile, rename, rm, unlink } from "node:fs/promises";
import path from "node:path";

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function sha256File(p: string): Promise<string | null> {
  try {
    return sha256(await readFile(p));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function fsyncDir(dir: string): Promise<void> {
  const fh = await open(dir, "r");
  try {
    await fh.sync();
  } catch {
    // some filesystems don't support directory fsync
  } finally {
    await fh.close();
  }
}

/** Write via a hidden temp file in the same directory, sync, rename, sync the directory. */
export async function atomicWrite(p: string, data: string | Buffer): Promise<void> {
  const dir = path.dirname(p);
  const tmp = path.join(dir, `.${path.basename(p)}.${String(process.pid)}.tmp`);
  const fh = await open(tmp, "w");
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, p);
  await fsyncDir(dir);
}

async function createExclusive(p: string, data: string | Buffer): Promise<void> {
  await mkdir(path.dirname(p), { recursive: true });
  const fh = await open(p, "wx");
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fsyncDir(path.dirname(p));
}

/** Byte-for-byte move that can never replace an existing file (DES-013). */
export async function moveNoClobber(src: string, dst: string): Promise<void> {
  await mkdir(path.dirname(dst), { recursive: true });
  await link(src, dst);
  await unlink(src);
  await fsyncDir(path.dirname(dst));
  await fsyncDir(path.dirname(src));
}

export type PlanOp =
  | { op: "create"; path: string; content: string | Buffer }
  | { op: "modify"; path: string; content: string | Buffer }
  | { op: "move"; src: string; dst: string };

export type JournalOp =
  | { op: "create"; path: string; sha: string }
  | { op: "modify"; path: string; preSha: string; postSha: string }
  | { op: "move"; src: string; dst: string; sha: string };

export interface JournalMeta {
  run: string;
  item: string;
  itemSha: string;
}

export interface JournalFile extends JournalMeta {
  ops: JournalOp[];
}

export interface Txn {
  journal: JournalFile;
  plan: PlanOp[];
  /** Pre-image of every modified file, by repo-relative path. */
  pre: Map<string, Buffer>;
}

export class RollbackConflict extends Error {
  override name = "RollbackConflict";
  readonly files: string[];
  constructor(files: string[]) {
    super(`files changed since the interrupted run, left in place: ${files.join(", ")}`);
    this.files = files;
  }
}

/** Every repo-relative path a transaction writes (DES-016 rule 6). */
export function writtenPaths(ops: readonly JournalOp[]): string[] {
  return ops.flatMap((o) => (o.op === "move" ? [o.src, o.dst] : [o.path]));
}

type Step = { kind: "skip" } | { kind: "undo"; run: () => Promise<void> } | { kind: "conflict"; file: string };

export class Journal {
  readonly root: string;
  readonly stateDir: string;

  constructor(root: string, stateDir: string) {
    this.root = root;
    this.stateDir = stateDir;
  }

  get journalPath(): string {
    return path.join(this.stateDir, "journal.json");
  }

  get txnDir(): string {
    return path.join(this.stateDir, "txn");
  }

  private abs(rel: string): string {
    return path.join(this.root, rel);
  }

  read(): JournalFile | null {
    if (!existsSync(this.journalPath)) return null;
    return JSON.parse(readFileSync(this.journalPath, "utf8")) as JournalFile;
  }

  /** Hash everything, back up pre-images, and write the journal atomically. Applies nothing. */
  async begin(meta: JournalMeta, plan: PlanOp[]): Promise<Txn> {
    if (this.read()) throw new Error("a journal already exists; recover before starting a new item");
    await rm(this.txnDir, { recursive: true, force: true });
    await mkdir(this.txnDir, { recursive: true });
    const ops: JournalOp[] = [];
    const pre = new Map<string, Buffer>();
    for (const p of plan) {
      if (p.op === "create") ops.push({ op: "create", path: p.path, sha: sha256(p.content) });
      else if (p.op === "modify") {
        const before = await readFile(this.abs(p.path));
        const preSha = sha256(before);
        pre.set(p.path, before);
        await createExclusive(path.join(this.txnDir, `${preSha}.bak`), before).catch((e: unknown) => {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        });
        ops.push({ op: "modify", path: p.path, preSha, postSha: sha256(p.content) });
      } else {
        ops.push({ op: "move", src: p.src, dst: p.dst, sha: sha256(await readFile(this.abs(p.src))) });
      }
    }
    const journal: JournalFile = { ...meta, ops };
    await atomicWrite(this.journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    return { journal, plan, pre };
  }

  /** Apply in plan order. `onStep(i)` runs after each operation (a test seam for crashes). */
  async apply(txn: Txn, onStep: (i: number) => Promise<void> | void = () => undefined): Promise<void> {
    for (const [i, p] of txn.plan.entries()) {
      if (p.op === "create") await createExclusive(this.abs(p.path), p.content);
      else if (p.op === "modify") await atomicWrite(this.abs(p.path), p.content);
      else await moveNoClobber(this.abs(p.src), this.abs(p.dst));
      await onStep(i);
    }
  }

  /** Commit: append the ledger record first, then drop the journal (DES-015). */
  async commit(appendLedger: () => Promise<void>): Promise<void> {
    await appendLedger();
    await this.discard();
  }

  async discard(): Promise<void> {
    await rm(this.journalPath, { force: true });
    await rm(this.txnDir, { recursive: true, force: true });
    await fsyncDir(this.stateDir);
  }

  private async classify(o: JournalOp): Promise<Step> {
    if (o.op === "create") {
      const cur = await sha256File(this.abs(o.path));
      if (cur === null) return { kind: "skip" };
      if (cur !== o.sha) return { kind: "conflict", file: o.path };
      return { kind: "undo", run: async () => { await unlink(this.abs(o.path)); } };
    }
    if (o.op === "modify") {
      const cur = await sha256File(this.abs(o.path));
      if (cur === o.preSha) return { kind: "skip" };
      if (cur !== o.postSha) return { kind: "conflict", file: o.path };
      const bak = path.join(this.txnDir, `${o.preSha}.bak`);
      if ((await sha256File(bak)) !== o.preSha) return { kind: "conflict", file: o.path };
      return { kind: "undo", run: async () => { await atomicWrite(this.abs(o.path), await readFile(bak)); } };
    }
    const src = await sha256File(this.abs(o.src));
    const dst = await sha256File(this.abs(o.dst));
    if (dst === null && src === o.sha) return { kind: "skip" };
    if (dst === o.sha && src === null) {
      return { kind: "undo", run: () => moveNoClobber(this.abs(o.dst), this.abs(o.src)) };
    }
    if (dst === o.sha && src === o.sha) {
      // Crashed between link and unlink: the source is still in place.
      return { kind: "undo", run: async () => { await unlink(this.abs(o.dst)); } };
    }
    return { kind: "conflict", file: dst !== null && dst !== o.sha ? o.dst : o.src };
  }

  /**
   * Undo every operation in reverse order. Checks every file first: on any
   * conflict nothing is touched, the journal is kept, and RollbackConflict is thrown.
   */
  async rollback(journal: JournalFile): Promise<void> {
    const steps: Step[] = [];
    for (const o of [...journal.ops].reverse()) steps.push(await this.classify(o));
    const conflicts = steps.flatMap((s) => (s.kind === "conflict" ? [s.file] : []));
    if (conflicts.length > 0) throw new RollbackConflict(conflicts);
    for (const s of steps) if (s.kind === "undo") await s.run();
    await this.discard();
  }

  /**
   * Recovery at run start (REQ-027). Returns the interrupted item when it was
   * rolled back, null when there was nothing to do or the item had committed.
   * Throws RollbackConflict when a file was edited after the crash.
   */
  async recover(committed: (j: JournalFile) => boolean): Promise<JournalFile | null> {
    const j = this.read();
    if (!j) {
      await rm(this.txnDir, { recursive: true, force: true });
      return null;
    }
    if (committed(j)) {
      await this.discard();
      return null;
    }
    await this.rollback(j);
    return j;
  }
}

// Run lock (DES-003, REQ-033): exclusive create, with a liveness check so a
// crashed run's lock doesn't block forever.
import { readFileSync, unlinkSync } from "node:fs";
import { mkdir, open, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { atomicWrite } from "./journal.ts";

export const LOCK_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export class LockHeld extends Error {
  override name = "LockHeld";
}

interface LockBody {
  pid: number;
  hostname: string;
  started: string;
}

export interface Lock {
  path: string;
  /** Synchronous so it can run from signal handlers. Removes the lock only if it's still ours. */
  release(): void;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function isLive(body: unknown, now: Date): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<LockBody>;
  if (typeof b.pid !== "number" || typeof b.hostname !== "string" || typeof b.started !== "string") return false;
  const age = now.getTime() - Date.parse(b.started);
  return b.hostname === os.hostname() && isAlive(b.pid) && Number.isFinite(age) && age < LOCK_MAX_AGE_MS;
}

/** Take the lock under stateDir, creating the directory (the run's first write). */
export async function acquireLock(stateDir: string, now: Date, log: (m: string) => void = () => undefined): Promise<Lock> {
  await mkdir(stateDir, { recursive: true });
  const lockPath = path.join(stateDir, "lock");
  const body: LockBody = { pid: process.pid, hostname: os.hostname(), started: now.toISOString() };
  const text = `${JSON.stringify(body)}\n`;
  try {
    const fh = await open(lockPath, "wx");
    try {
      await fh.writeFile(text);
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    let existing: unknown;
    try {
      existing = JSON.parse(await readFile(lockPath, "utf8"));
    } catch {
      existing = null;
    }
    if (isLive(existing, now)) throw new LockHeld("a run is already in progress");
    await atomicWrite(lockPath, text);
    log(`took over a stale lock (${JSON.stringify(existing)})`);
  }
  return {
    path: lockPath,
    release(): void {
      try {
        const cur: unknown = JSON.parse(readFileSync(lockPath, "utf8"));
        if (cur && typeof cur === "object" && (cur as LockBody).pid === body.pid && (cur as LockBody).started === body.started) unlinkSync(lockPath);
      } catch {
        // already gone
      }
    },
  };
}

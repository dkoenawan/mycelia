// DES-004: the filesystem adapters against a temp vault that's a git work tree
// with the framework's .gitignore.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { FsAreaIndex } from "../../src/goals/adapters/areas.ts";
import { GitIgnoreProbe } from "../../src/goals/adapters/ignore.ts";
import { FsVisionVault } from "../../src/goals/adapters/vault.ts";
import { saveDraft, signOff, type DraftBody } from "../../src/goals/application/use-cases.ts";
import { REPO_ROOT } from "../../src/lib/paths.ts";
import { note, tempVault, type TempVault } from "../helpers/vault.ts";
import { FixedClock } from "./fakes.ts";

function gitVault(): TempVault {
  const v = tempVault({ "20-areas/health.md": note("health", "Health"), "20-areas/career.md": note("career", "Career"), "20-areas/README.md": "---\nname: areas-readme\n---\n" });
  copyFileSync(path.join(REPO_ROOT, ".gitignore"), path.join(v.root, ".gitignore"));
  execFileSync("git", ["init", "-q"], { cwd: v.root });
  return v;
}

function files(root: string, dir = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (rel === ".git") continue;
    if (e.isDirectory()) out.push(...files(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

function checksum(root: string, dir: string): string {
  const h = createHash("sha256");
  for (const f of files(root).filter((x) => x.startsWith(`${dir}/`))) {
    h.update(f).update("\0").update(readFileSync(path.join(root, f))).update(String(statSync(path.join(root, f)).mtimeMs));
  }
  return h.digest("hex");
}

const body = (centre: string): DraftBody => ({
  mainGoals: [{ centre, pillars: [{ name: "Recovery", areas: ["health", "career"], actions: ["Sleep eight hours"] }] }],
  secondaryGoals: [{ text: "Read 24 books", areas: ["career"] }],
});

test("DES-004 / REQ-015: after a save and two sign-offs, 20-areas/ is unchanged and every written path is ignored", async () => {
  const v = gitVault();
  try {
    const root = v.root;
    const before = files(root);
    const areasSum = checksum(root, "20-areas");
    const vault = new FsVisionVault(root);
    const probe = new GitIgnoreProbe(root);
    const areas = new FsAreaIndex(root);
    const at = (d: string) => ({ vault, probe, areas, clock: new FixedClock(d) });

    assert.equal((await saveDraft(2027, body("Run a marathon under 3:30"), at("2026-12-14"))).ok, true);
    assert.equal((await signOff(2027, at("2026-12-20"))).ok, true);
    assert.equal((await saveDraft(2027, body("Run a marathon under 3:15"), at("2027-04-01"))).ok, true);
    const second = await signOff(2027, at("2027-04-02"));
    assert.equal(second.ok, true);

    assert.equal(checksum(root, "20-areas"), areasSum);
    const written = files(root).filter((f) => !before.includes(f));
    assert.deepEqual(written, ["01-vision/2027-goals.md", "40-archive/vision/2027-goals-replaced-2027-04-02.md"]);
    assert.deepEqual(await probe.unignored(written), []);
    assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", ...written, "00-inbox/2027-goals.md"], { cwd: root, encoding: "utf8" }), "");
    assert.match(readFileSync(path.join(root, "40-archive/vision/2027-goals-replaced-2027-04-02.md"), "utf8"), /3:30/);
    assert.match(readFileSync(path.join(root, "01-vision/2027-goals.md"), "utf8"), /3:15/);
  } finally {
    v.done();
  }
});

test("DES-004: the archive copy is byte for byte, created exclusively, and reused or suffixed on a second same-day copy", async () => {
  const v = gitVault();
  try {
    const vault = new FsVisionVault(v.root);
    const first = "---\r\nyear: 2027\r\n---\r\nweird bytes é\r\n";
    v.write("01-vision/2027-goals.md", first);
    assert.equal(await vault.archiveCurrent(2027, "2027-04-02"), "40-archive/vision/2027-goals-replaced-2027-04-02.md");
    assert.equal(await vault.archiveCurrent(2027, "2027-04-02"), "40-archive/vision/2027-goals-replaced-2027-04-02.md");
    assert.ok(readFileSync(path.join(v.root, "40-archive/vision/2027-goals-replaced-2027-04-02.md")).equals(Buffer.from(first)));
    v.write("01-vision/2027-goals.md", "different");
    assert.equal(await vault.archiveCurrent(2027, "2027-04-02"), "40-archive/vision/2027-goals-replaced-2027-04-02-2.md");
    assert.equal(readFileSync(path.join(v.root, "40-archive/vision/2027-goals-replaced-2027-04-02.md"), "utf8"), first);
  } finally {
    v.done();
  }
});

test("DES-004: the vault reads and writes only the year's draft, current note and archive", async () => {
  const v = gitVault();
  try {
    const vault = new FsVisionVault(v.root);
    assert.equal(await vault.readDraft(2027), null);
    assert.equal(await vault.readCurrent(2027), null);
    assert.equal(await vault.writeDraft(2027, "x"), "00-inbox/2027-goals.md");
    assert.equal(await vault.readDraft(2027), "x");
    await vault.removeDraft(2027);
    await vault.removeDraft(2027); // already gone: no error
    assert.deepEqual(vault.writePaths(2027, "2027-04-02"), [
      "00-inbox/2027-goals.md", "00-inbox/2027-goals.md.tmp", "01-vision/2027-goals.md", "01-vision/2027-goals.md.tmp",
      "40-archive/vision/2027-goals-replaced-2027-04-02.md",
    ]);
  } finally {
    v.done();
  }
});

test("DES-004: FsAreaIndex lists the 20-areas/ note stems, without the README", async () => {
  const v = gitVault();
  try {
    assert.deepEqual(await new FsAreaIndex(v.root).list(), ["career", "health"]);
    assert.deepEqual(await new FsAreaIndex(path.join(v.root, "nowhere")).list(), []);
  } finally {
    v.done();
  }
});

test("DES-004: GitIgnoreProbe reports a path the .gitignore doesn't cover, and passes outside a work tree", async () => {
  const v = gitVault();
  const plain = tempVault();
  try {
    assert.deepEqual(await new GitIgnoreProbe(v.root).unignored(["01-vision/2027-goals.md", "01-vision/README.md", "notes.md"]), ["01-vision/README.md", "notes.md"]);
    assert.deepEqual(await new GitIgnoreProbe(plain.root).unignored(["notes.md"]), []);
  } finally {
    v.done();
    plain.done();
  }
});

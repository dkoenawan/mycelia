// DES-005: the `goals` command group, run on a temp vault.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EXIT, run, type CliDeps } from "../../src/goals/cli.ts";
import { parse } from "../../src/goals/domain/parse.ts";
import { REPO_ROOT } from "../../src/lib/paths.ts";
import { note, tempVault, type TempVault } from "../helpers/vault.ts";
import { FixedClock } from "./fakes.ts";
import { EXAMPLE, noteText } from "./fixtures.ts";

interface Captured extends CliDeps {
  stdout: string[];
  stderr: string[];
}

function cli(root: string, opts: { date?: string; stdin?: string } = {}): Captured {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    root, cwd: root, clock: new FixedClock(opts.date ?? "2026-12-20"), stdout, stderr,
    io: { out: (l) => stdout.push(l), err: (l) => stderr.push(l), readStdin: () => Promise.resolve(opts.stdin ?? "") },
  };
}

function vault(): TempVault {
  const v = tempVault({ "20-areas/health.md": note("health", "Health"), "20-areas/career.md": note("career", "Career") });
  copyFileSync(path.join(REPO_ROOT, ".gitignore"), path.join(v.root, ".gitignore"));
  execFileSync("git", ["init", "-q"], { cwd: v.root });
  return v;
}

const DRAFT_JSON = JSON.stringify({
  mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", areas: ["[[health]]"], actions: ["Run four times a week"] }, { name: "Strength" }, { name: "Recovery", areas: ["health"] }] }],
  secondaryGoals: [{ text: "Read 24 books" }],
});

test("validate: exit 0 on a valid note (warnings allowed), with each diagnostic and a summary", async () => {
  const v = vault();
  try {
    v.write("n.md", noteText({ secondary: ["Sail Areas: [[sailing]]"] }));
    const c = cli(v.root);
    assert.equal(await run(["validate", "n.md"], c), EXIT.ok);
    assert.match(c.stdout[0] ?? "", /^n\.md: warning: line \d+ \(secondary goal "Sail"\): .*"sailing"/);
    assert.match(c.stdout.at(-1) ?? "", /found 0 main goals, 1 secondary goal, 0 changes; 0 errors, 1 warning/);
  } finally {
    v.done();
  }
});

test("REQ-003: validate exits 1 with each error and its location", async () => {
  const v = vault();
  try {
    v.write("bad.md", noteText({ year: "27", main: [{ centre: "Get strong", pillars: [{ name: "Strength", actions: ["Squat", ""] }] }] }));
    const c = cli(v.root);
    assert.equal(await run(["validate", "bad.md"], c), EXIT.refused);
    const errs = c.stdout.filter((l) => l.includes(": error: "));
    assert.equal(errs.length, 2);
    assert.match(errs[0] ?? "", /frontmatter: year: invalid year "27"/);
    assert.match(errs[1] ?? "", /pillar "Strength"\): action 2 under pillar "Strength" has empty text/);
  } finally {
    v.done();
  }
});

test("validate exits 2 on a usage error or an unreadable file", async () => {
  const v = vault();
  try {
    assert.equal(await run(["validate"], cli(v.root)), EXIT.usage);
    assert.equal(await run(["validate", "a.md", "b.md"], cli(v.root)), EXIT.usage);
    const c = cli(v.root);
    assert.equal(await run(["validate", "missing.md"], c), EXIT.usage);
    assert.match(c.stderr[0] ?? "", /can't read/);
  } finally {
    v.done();
  }
});

test("validate passes the committed example against a vault with its areas", async () => {
  const v = vault();
  try {
    for (const a of ["finances", "relationships", "personal-growth", "home-environment", "recreation"]) v.write(`20-areas/${a}.md`, note(a, a));
    const c = cli(v.root);
    assert.equal(await run(["validate", path.join(REPO_ROOT, "docs/reference/year-goals/example-2027-goals.md")], c), EXIT.ok);
    assert.match(c.stdout.at(-1) ?? "", /found 2 main goals \(pillars: 8, 3\), 2 secondary goals, 1 change; 0 errors, 0 warnings/);
  } finally {
    v.done();
  }
});

test("REQ-010: save-draft from the argument or stdin writes 00-inbox/<year>-goals.md, exit 0", async () => {
  const v = vault();
  try {
    const c = cli(v.root);
    assert.equal(await run(["save-draft", "2027", DRAFT_JSON], c), EXIT.ok);
    const text = readFileSync(path.join(v.root, "00-inbox/2027-goals.md"), "utf8");
    const m = parse(text);
    assert.equal(m.status, "draft");
    assert.deepEqual(m.mainGoals[0]?.pillars.map((p) => [p.name, p.areas]), [["Endurance", ["health"]], ["Strength", []], ["Recovery", ["health"]]]);
    assert.match(c.stdout.at(-1) ?? "", /^saved 00-inbox\/2027-goals\.md: 1 main goal \(pillars: 3\), 1 secondary goal/);
    assert.equal(existsSync(path.join(v.root, "00-inbox/capture/2027-goals.md")), false);
    assert.equal(await run(["save-draft", "2027"], cli(v.root, { stdin: DRAFT_JSON })), EXIT.ok);
  } finally {
    v.done();
  }
});

test("save-draft exits 1 on bad JSON, a bad shape or an empty draft, and 2 on a bad year, changing nothing", async () => {
  const v = vault();
  try {
    const c = cli(v.root);
    assert.equal(await run(["save-draft", "2027", "{not json"], c), EXIT.refused);
    assert.match(c.stderr[0] ?? "", /isn't valid JSON/);
    const shape = cli(v.root);
    assert.equal(await run(["save-draft", "2027", JSON.stringify({ mainGoals: [{ centre: "  " }] })], shape), EXIT.refused);
    assert.match(shape.stderr[0] ?? "", /expected shape[\s\S]*centre/);
    assert.equal(await run(["save-draft", "2027", "{}"], cli(v.root)), EXIT.refused);
    assert.equal(await run(["save-draft", "27", DRAFT_JSON], cli(v.root)), EXIT.usage);
    assert.equal(await run(["save-draft"], cli(v.root)), EXIT.usage);
    assert.equal(existsSync(path.join(v.root, "00-inbox/2027-goals.md")), false);
  } finally {
    v.done();
  }
});

test("REQ-013: sign-off moves the draft to 01-vision/, exit 0; REQ-014: a second sign-off archives the first", async () => {
  const v = vault();
  try {
    assert.equal(await run(["save-draft", "2027", DRAFT_JSON], cli(v.root, { date: "2026-12-14" })), EXIT.ok);
    const first = cli(v.root, { date: "2026-12-20" });
    assert.equal(await run(["sign-off", "2027"], first), EXIT.ok);
    assert.match(first.stdout.at(-1) ?? "", /signed off: 01-vision\/2027-goals\.md/);
    assert.equal(existsSync(path.join(v.root, "00-inbox/2027-goals.md")), false);
    const signed = readFileSync(path.join(v.root, "01-vision/2027-goals.md"), "utf8");
    assert.equal(parse(signed).signedOff, "2026-12-20");

    v.write("00-inbox/2027-goals.md", EXAMPLE.replace("status: signed-off", "status: draft").replace("signed_off: 2026-12-20\n", ""));
    const second = cli(v.root, { date: "2027-04-02" });
    assert.equal(await run(["sign-off", "2027"], second), EXIT.ok);
    assert.match(second.stdout.join("\n"), /archived the earlier note, unchanged: 40-archive\/vision\/2027-goals-replaced-2027-04-02\.md/);
    assert.equal(readFileSync(path.join(v.root, "40-archive/vision/2027-goals-replaced-2027-04-02.md"), "utf8"), signed);
    const now = parse(readFileSync(path.join(v.root, "01-vision/2027-goals.md"), "utf8"));
    assert.equal(now.mainGoals.length, 2);
    assert.equal(now.changes.at(-1)?.date, "2027-04-02");
  } finally {
    v.done();
  }
});

test("sign-off prints warnings, refuses on errors (exit 1) changing nothing, and exits 2 on a bad year", async () => {
  const v = vault();
  try {
    const none = cli(v.root);
    assert.equal(await run(["sign-off", "2027"], none), EXIT.refused);
    assert.match(none.stderr[0] ?? "", /no draft for 2027/);
    const bad = noteText({ main: [{ centre: "Get strong", pillars: [{ name: "Strength", actions: [""] }] }] });
    v.write("00-inbox/2027-goals.md", bad);
    const c = cli(v.root);
    assert.equal(await run(["sign-off", "2027"], c), EXIT.refused);
    assert.ok(c.stdout.some((l) => l.includes(": error: ")));
    assert.equal(readFileSync(path.join(v.root, "00-inbox/2027-goals.md"), "utf8"), bad);
    assert.equal(existsSync(path.join(v.root, "01-vision")), false);
    v.write("00-inbox/2027-goals.md", noteText({ secondary: ["Sail Areas: [[sailing]]"] }));
    const w = cli(v.root);
    assert.equal(await run(["sign-off", "2027"], w), EXIT.ok);
    assert.ok(w.stdout.some((l) => l.includes(": warning: ") && l.includes("sailing")));
    assert.equal(await run(["sign-off", "next"], cli(v.root)), EXIT.usage);
  } finally {
    v.done();
  }
});

test("an unknown or missing subcommand prints the usage and exits 2", async () => {
  const c = cli(REPO_ROOT);
  assert.equal(await run(["frobnicate"], c), EXIT.usage);
  assert.match(c.stderr[0] ?? "", /usage: mycelia goals <command>/);
  assert.equal(await run([], cli(REPO_ROOT)), EXIT.usage);
});

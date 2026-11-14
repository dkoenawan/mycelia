// DES-006: the session launcher with a fake spawner and a fake preflight.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { claudeArgs, EXIT_SESSION, loadPromptTemplate, runSession, saveCommand, type SessionDeps, type Spawner } from "../../src/goals/adapters/session.ts";
import { saveDraft } from "../../src/goals/application/use-cases.ts";
import { run, type CliDeps } from "../../src/goals/cli.ts";
import { parse } from "../../src/goals/domain/parse.ts";
import { validate } from "../../src/goals/domain/validate.ts";
import { ProviderNotReady } from "../../src/ingest/agent/provider.ts";
import { REPO_ROOT } from "../../src/lib/paths.ts";
import { note, tempVault } from "../helpers/vault.ts";
import { FakeProbe, FixedClock, MemoryVault, StaticAreas } from "./fakes.ts";
import { noteText } from "./fixtures.ts";

interface Call { bin: string; args: string[]; cwd: string }

function setup(opts: { vault?: MemoryVault; preflight?: () => Promise<void>; bin?: string | null; onSpawn?: (c: Call) => Promise<void> | void; exitCode?: number; open?: string[] } = {}) {
  const vault = opts.vault ?? new MemoryVault();
  const calls: Call[] = [];
  const out: string[] = [];
  const err: string[] = [];
  let preflights = 0;
  const spawn: Spawner = async (bin, args, o) => {
    const c = { bin, args, cwd: o.cwd };
    calls.push(c);
    await opts.onSpawn?.(c);
    return opts.exitCode ?? 0;
  };
  const deps: SessionDeps = {
    root: "/vault", env: {},
    resolveClaude: () => (opts.bin === undefined ? "/bin/claude" : opts.bin),
    preflight: () => { preflights++; return opts.preflight ? opts.preflight() : Promise.resolve(); },
    areas: new StaticAreas(["career", "health"]),
    vault, probe: new FakeProbe(opts.open ?? []), today: () => "2026-12-14",
    spawn, template: loadPromptTemplate(),
    out: (l) => out.push(l), err: (l) => err.push(l),
  };
  return { deps, vault, calls, out, err, preflights: () => preflights };
}

const save = (vault: MemoryVault, body: Parameters<typeof saveDraft>[1]) => saveDraft(2027, body, { vault, probe: new FakeProbe(), clock: new FixedClock("2026-12-14") });

test("DES-006: spawns Claude Code with only the save step allowed, the prompt and a first message, in the vault root", async () => {
  const s = setup({ onSpawn: async () => { await save(s.vault, { mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [] }], secondaryGoals: [] }); } });
  assert.equal(await runSession(["2027"], s.deps), EXIT_SESSION.ok);
  assert.equal(s.calls.length, 1);
  const c = s.calls[0];
  assert.equal(c?.bin, "/bin/claude");
  assert.equal(c?.cwd, "/vault");
  const args = c?.args ?? [];
  const after = (flag: string): string | undefined => args[args.indexOf(flag) + 1];
  assert.equal(after("--tools"), "Bash");
  assert.equal(after("--allowedTools"), "Bash(node src/mycelia.ts goals save-draft 2027:*)");
  assert.equal(after("--permission-mode"), "dontAsk");
  assert.equal(after("--setting-sources"), "");
  assert.ok(args.includes("--strict-mcp-config"));
  assert.equal(args.filter((a) => a === "--allowedTools").length, 1);
  const prompt = after("--system-prompt") ?? "";
  assert.match(prompt, /goals for 2027/);
  assert.match(prompt, /Offer the existing areas by name: career, health\./);
  assert.ok(prompt.includes(`${saveCommand(2027)} '<draft JSON>'`));
  assert.match(prompt, /There's no draft yet/);
  assert.doesNotMatch(prompt, /\{\{\w+\}\}/);
  assert.equal(args.at(-1), "Let's set my goals for 2027.");
  assert.equal(args.at(-2), prompt, "the first message follows a single-valued flag");
});

test("REQ-009: the prompt sets the order: centre goal, pillars, each pillar's actions and areas, then secondary goals", () => {
  const t = loadPromptTemplate();
  const at = (s: string): number => { const i = t.indexOf(s); assert.ok(i >= 0, s); return i; };
  const order = [at("1. Ask for the centre goal."), at("2. Ask for its pillars"), at("3. For each pillar in turn, ask for its actions"), at("4. For each pillar, ask which areas it touches"), at("ask for secondary goals")];
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(t, /stop a pillar at fewer than 8/);
});

test("REQ-011: the prompt has the agent save after every agreed step", () => {
  assert.match(loadPromptTemplate(), /Save the whole draft so far after every agreed step/);
});

test("DES-006: the launcher's header records the spike findings", () => {
  const src = readFileSync(path.join(REPO_ROOT, "src", "goals", "adapters", "session.ts"), "utf8");
  assert.match(src, /Spike findings, verified on \d{4}-\d{2}-\d{2} against Claude Code CLI/);
  for (const flag of ["--tools Bash", "--allowedTools", "--permission-mode dontAsk", "--setting-sources", "--strict-mcp-config", "--system-prompt"]) assert.ok(src.includes(flag), flag);
});

test("claudeArgs puts the first message last", () => {
  assert.equal(claudeArgs(2027, "P", "hello").at(-1), "hello");
});

test("DES-006: a bad year is a usage error, before the preflight or any spawn", async () => {
  for (const args of [["27"], [], ["2027", "2028"], ["2027", "--force"]]) {
    const s = setup();
    assert.equal(await runSession(args, s.deps), EXIT_SESSION.cantStart);
    assert.equal(s.preflights(), 0);
    assert.equal(s.calls.length, 0);
  }
});

test("DES-006: a missing or logged-out Claude Code fails before anything is written or spawned", async () => {
  const missing = setup({ bin: null });
  assert.equal(await runSession(["2027"], missing.deps), EXIT_SESSION.cantStart);
  assert.match(missing.err[0] ?? "", /CLI not found/);
  assert.equal(missing.calls.length, 0);
  const out = setup({ preflight: () => Promise.reject(new ProviderNotReady("Claude Code is installed but not logged in.")) });
  assert.equal(await runSession(["2027"], out.deps), EXIT_SESSION.cantStart);
  assert.match(out.err[0] ?? "", /not logged in/);
  assert.equal(out.calls.length, 0);
  assert.deepEqual(out.vault.ops, []);
});

test("DES-006: an output path that isn't gitignored stops the launch", async () => {
  const s = setup({ open: ["00-inbox/2027-goals.md"] });
  assert.equal(await runSession(["2027"], s.deps), EXIT_SESSION.cantStart);
  assert.match(s.err[0] ?? "", /aren't gitignored/);
  assert.equal(s.calls.length, 0);
});

test("DES-006: an existing draft is refused without --continue, and is the starting point with it", async () => {
  const draft = noteText({ main: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance" }] }] });
  const refused = setup({ vault: new MemoryVault({ "00-inbox/2027-goals.md": draft }) });
  assert.equal(await runSession(["2027"], refused.deps), EXIT_SESSION.cantStart);
  assert.match(refused.err[0] ?? "", /already exists.*--continue/);
  assert.equal(refused.calls.length, 0);

  const cont = setup({ vault: new MemoryVault({ "00-inbox/2027-goals.md": draft }) });
  assert.equal(await runSession(["2027", "--continue"], cont.deps), EXIT_SESSION.ok);
  assert.match(cont.out[0] ?? "", /rewrites it/);
  const args = cont.calls[0]?.args ?? [];
  const prompt = args[args.indexOf("--system-prompt") + 1] ?? "";
  assert.ok(prompt.includes("## Main goal: Run a marathon under 3:30"));
  assert.match(prompt, /Continue from this existing draft/);
  assert.equal(args.at(-1), "Let's continue my draft goals for 2027.");
});

test("DES-006: after the session, no draft is reported with exit 1", async () => {
  const s = setup({ exitCode: 130 });
  assert.equal(await runSession(["2027"], s.deps), EXIT_SESSION.noDraft);
  assert.match(s.out.at(-1) ?? "", /No draft was written for 2027/);
  assert.match(s.err.join("\n"), /exited with code 130/);
});

test("DES-006: after the session, a valid draft is reported with the sign-off command", async () => {
  const s = setup({ onSpawn: async () => { await save(s.vault, { mainGoals: [], secondaryGoals: [{ text: "Sail", areas: ["sailing"] }] }); } });
  assert.equal(await runSession(["2027"], s.deps), EXIT_SESSION.ok);
  assert.match(s.out.join("\n"), /warning: .*"sailing"/);
  assert.match(s.out.at(-1) ?? "", /npx mycelia goals sign-off 2027/);
});

test("DES-006: after the session, a draft the operator broke by hand is reported with exit 1", async () => {
  const s = setup({ onSpawn: () => { s.vault.files.set("00-inbox/2027-goals.md", noteText({ year: "27", secondary: ["Read"] })); } });
  assert.equal(await runSession(["2027"], s.deps), EXIT_SESSION.noDraft);
  assert.match(s.out.join("\n"), /error: frontmatter: year/);
});

test("REQ-010 / REQ-011: through `goals session`, an agent that saves one centre goal and 2 pillars, then stops, leaves a valid draft", async () => {
  const v = tempVault({ "20-areas/health.md": note("health", "Health") });
  try {
    copyFileSync(path.join(REPO_ROOT, ".gitignore"), path.join(v.root, ".gitignore"));
    execFileSync("git", ["init", "-q"], { cwd: v.root });
    const out: string[] = [];
    const deps: CliDeps = {
      root: v.root, cwd: v.root, clock: new FixedClock("2026-12-14"),
      io: { out: (l) => out.push(l), err: (l) => out.push(l), readStdin: () => Promise.resolve("") },
      session: {
        resolveClaude: () => "/bin/claude",
        preflight: () => Promise.resolve(),
        // The "agent": runs the allowed save command once, as Claude Code would, then the operator ends early.
        spawn: async (_bin, args) => {
          const rule = args[args.indexOf("--allowedTools") + 1] ?? "";
          assert.equal(rule, `Bash(${saveCommand(2027)}:*)`);
          const json = JSON.stringify({ mainGoals: [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance" }, { name: "Strength" }] }] });
          assert.equal(await run(["save-draft", "2027", json], deps), 0);
          return 0;
        },
      },
    };
    assert.equal(await run(["session", "2027"], deps), 0);
    const text = readFileSync(path.join(v.root, "00-inbox", "2027-goals.md"), "utf8");
    assert.equal(parse(text).status, "draft");
    assert.deepEqual(parse(text).mainGoals, [{ centre: "Run a marathon under 3:30", pillars: [{ name: "Endurance", areas: [], actions: [] }, { name: "Strength", areas: [], actions: [] }] }]);
    assert.deepEqual(validate(text, null).filter((d) => d.severity === "error"), []);
    assert.match(out.at(-1) ?? "", /sign-off 2027/);
  } finally {
    v.done();
  }
});

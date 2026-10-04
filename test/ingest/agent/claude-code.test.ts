import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ClaudeCodeProvider, MSG_NOT_FOUND, MSG_NOT_LOGGED_IN, classifyFault } from "../../../src/ingest/agent/claude-code.ts";
import { ProviderNotReady } from "../../../src/ingest/agent/provider.ts";
import { FakeProvider, structured } from "../../../src/ingest/agent/fake.ts";

function fakeClaude(authJson: string, authExit: number): { dir: string; bin: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mycelia-fakeclaude-"));
  const bin = path.join(dir, "claude");
  writeFileSync(
    bin,
    `#!/bin/sh
case "$1" in
  --version) echo "9.9.9 (Claude Code)"; exit 0 ;;
  auth) printf '%s\\n' '${authJson}'; exit ${authExit} ;;
  *) echo "unexpected model call" >&2; exit 99 ;;
esac
`,
  );
  chmodSync(bin, 0o755);
  return { dir, bin };
}

test("preflight: CLI not found names every place checked", { skip: existsSync("/usr/local/bin/claude") }, async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "mycelia-home-"));
  try {
    const p = new ClaudeCodeProvider({ env: { PATH: "", HOME: home, CLAUDE_BIN: path.join(home, "nope") } });
    await assert.rejects(p.preflight(), (e: unknown) => e instanceof ProviderNotReady && e.message === MSG_NOT_FOUND);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("preflight: logged out gives the login message, with no model call", async () => {
  const { dir, bin } = fakeClaude('{"loggedIn": false, "authMethod": "none"}', 1);
  try {
    const p = new ClaudeCodeProvider({ env: { CLAUDE_BIN: bin, PATH: "/usr/bin:/bin", HOME: dir } });
    await assert.rejects(p.preflight(), (e: unknown) => e instanceof ProviderNotReady && e.message === MSG_NOT_LOGGED_IN);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("preflight: a subscription login passes on the non-billable status check alone", async () => {
  const { dir, bin } = fakeClaude('{"loggedIn": true, "authMethod": "claude.ai"}', 0);
  try {
    const p = new ClaudeCodeProvider({ env: { CLAUDE_BIN: bin, PATH: "/usr/bin:/bin", HOME: dir } });
    await p.preflight();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("classifyFault separates infrastructure faults from item errors", () => {
  assert.equal(classifyFault("authentication_failed", "")?.kind, "auth");
  assert.equal(classifyFault("rate_limit", "")?.kind, "limit");
  assert.equal(classifyFault("overloaded", "")?.kind, "infra");
  assert.equal(classifyFault(undefined, "Not logged in · Please run /login")?.kind, "auth");
  assert.equal(classifyFault(undefined, "You've hit your usage limit")?.kind, "limit");
  assert.equal(classifyFault("max_output_tokens", "too long"), null);
  assert.equal(classifyFault(undefined, "some tool failed"), null);
});

test("FakeProvider returns canned results and records requests", async () => {
  const fake = new FakeProvider((_req, n) => structured({ n }));
  const req = { systemPrompt: "s", userPrompt: "u", outputSchema: {}, readScope: { root: "/", excluded: [] }, maxTurns: 1, timeoutMs: 1 };
  assert.deepEqual((await fake.run(req)).output, { n: 1 });
  assert.deepEqual((await fake.run(req)).output, { n: 2 });
  assert.equal(fake.requests.length, 2);
  fake.preflightError = new ProviderNotReady("x");
  await assert.rejects(fake.preflight(), ProviderNotReady);
});

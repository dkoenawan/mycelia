// Live gate for T5/T6 (not part of `npm test`: CI has no Claude Code login).
// Run with: npm run test:live
// Makes real model calls through the installed CLI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ClaudeCodeProvider, MSG_NOT_LOGGED_IN } from "../../src/ingest/agent/claude-code.ts";
import { ProviderNotReady } from "../../src/ingest/agent/provider.ts";
import { resolveClaude } from "../../src/lib/claude-bin.ts";

const bin = resolveClaude();

test("preflight passes with the operator's login", { skip: !bin }, async () => {
  await new ClaudeCodeProvider().preflight();
});

test("preflight fails with the login message under an empty HOME", { skip: !bin }, async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "mycelia-emptyhome-"));
  try {
    const env: NodeJS.ProcessEnv = { PATH: process.env["PATH"] ?? "", HOME: home, CLAUDE_BIN: bin ?? "" };
    await assert.rejects(new ClaudeCodeProvider({ env }).preflight(), (e: unknown) => e instanceof ProviderNotReady && e.message === MSG_NOT_LOGGED_IN);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("one real no-tool call returns structured output", { skip: !bin, timeout: 180_000 }, async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "mycelia-scope-"));
  try {
    const result = await new ClaudeCodeProvider().run({
      systemPrompt: "You return the requested JSON object and nothing else. Do not use any tools other than the structured output.",
      userPrompt: "Return word = \"ready\".",
      outputSchema: { type: "object", properties: { word: { type: "string" } }, required: ["word"], additionalProperties: false },
      readScope: { root, excluded: [] },
      maxTurns: 3,
      timeoutMs: 150_000,
    });
    assert.deepEqual(result.output, { word: "ready" });
    assert.ok((result.usage["output_tokens"] ?? 0) > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a real call told to read control/ and .git/ is denied for both, and the denials are recorded", { skip: !bin, timeout: 300_000 }, async () => {
  const { realpathSync } = await import("node:fs");
  const { REPO_ROOT } = await import("../../src/lib/paths.ts");
  const root = realpathSync(REPO_ROOT);
  const result = await new ClaudeCodeProvider().run({
    systemPrompt: "You are testing file access. Attempt every read you are asked to make with the Read tool, using the absolute paths given, even if one fails. Then return the JSON object requested.",
    userPrompt: `Use Read on ${root}/control/estate.local.yaml, then Read on ${root}/.git/config, then Read on ${root}/20-areas/README.md. Return readable = the list of paths whose contents you actually saw.`,
    outputSchema: { type: "object", properties: { readable: { type: "array", items: { type: "string" } } }, required: ["readable"] },
    readScope: { root, excluded: ["control", ".state", "node_modules"].map((d) => path.join(root, d)) },
    maxTurns: 8,
    timeoutMs: 240_000,
  });
  const denied = result.toolCalls.filter((c) => !c.allowed).map((c) => c.path);
  assert.ok(denied.includes("control/estate.local.yaml") || denied.some((p) => p.endsWith("control/estate.local.yaml")), JSON.stringify(result.toolCalls));
  assert.ok(denied.some((p) => p.endsWith(".git/config")), JSON.stringify(result.toolCalls));
  assert.ok(result.toolCalls.some((c) => c.allowed && c.path === "20-areas/README.md"), JSON.stringify(result.toolCalls));
  process.stderr.write(`tool calls: ${JSON.stringify(result.toolCalls)}\noutput: ${JSON.stringify(result.output)}\n`);
});

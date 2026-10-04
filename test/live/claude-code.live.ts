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

// Key prompt adapter (REQ-008): one line of stdin when it isn't a TTY.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { StdinKeyPrompt } from "../../src/adapters/cli/key-prompt.ts";

test("reads one trimmed line from a non-TTY stdin", async () => {
  const input = new PassThrough() as unknown as NodeJS.ReadStream;
  const p = new StdinKeyPrompt(input, process.stderr).read();
  (input as unknown as PassThrough).end("secret_TESTKEY0000  \nignored\n");
  assert.equal(await p, "secret_TESTKEY0000");
});

test("empty stdin gives an empty key", async () => {
  const input = new PassThrough() as unknown as NodeJS.ReadStream;
  const p = new StdinKeyPrompt(input, process.stderr).read();
  (input as unknown as PassThrough).end();
  assert.equal(await p, "");
});

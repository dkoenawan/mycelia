// Key prompt (DES-005, REQ-008): the API key comes from a hidden TTY prompt,
// or one line of stdin when stdin isn't a TTY. Never from argv or the
// environment, so it never shows in a process listing or shell history.
import { createInterface } from "node:readline";
import type { KeyPrompt } from "../../application/ports.ts";

const PROMPT = "Notion integration secret (input hidden): ";

function readHidden(input: NodeJS.ReadStream, output: NodeJS.WriteStream): Promise<string> {
  return new Promise((resolve, reject) => {
    output.write(PROMPT);
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const done = (err: Error | null): void => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      output.write("\n");
      if (err) reject(err);
      else resolve(value.trim());
    };
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          done(null);
          return;
        }
        if (ch === "\u0003") {
          done(new Error("cancelled"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    input.on("data", onData);
  });
}

function readLine(input: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input, terminal: false });
    let got = false;
    rl.once("line", (line) => {
      got = true;
      rl.close();
      resolve(line.trim());
    });
    rl.once("close", () => { if (!got) resolve(""); });
  });
}

export class StdinKeyPrompt implements KeyPrompt {
  private readonly input: NodeJS.ReadStream;
  private readonly output: NodeJS.WriteStream;

  constructor(input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stderr) {
    this.input = input;
    this.output = output;
  }

  read(): Promise<string> {
    return this.input.isTTY ? readHidden(this.input, this.output) : readLine(this.input);
  }
}

// Test double for AgentProvider (DES-009): returns canned results, including
// hostile ones, and records every request it was given.
import type { AgentProvider, AgentRequest, AgentResult } from "./provider.ts";

export type FakeResponder = (req: AgentRequest, call: number) => AgentResult | Promise<AgentResult>;

export class FakeProvider implements AgentProvider {
  readonly name = "fake";
  readonly requests: AgentRequest[] = [];
  preflightError: Error | null = null;
  private readonly responder: FakeResponder;

  constructor(responder: FakeResponder) {
    this.responder = responder;
  }

  preflight(): Promise<void> {
    return this.preflightError ? Promise.reject(this.preflightError) : Promise.resolve();
  }

  async run(req: AgentRequest): Promise<AgentResult> {
    this.requests.push(req);
    return this.responder(req, this.requests.length);
  }
}

/** A result carrying `output` as structured output and its JSON as raw text. */
export function structured(output: unknown, extra: Partial<AgentResult> = {}): AgentResult {
  return { output, rawText: JSON.stringify(output), toolCalls: [], usage: {}, ...extra };
}

// Agent-provider seam (DES-009, ADR-0007). The ingester's one model-driven step
// goes through this interface; #19 adds providers and configuration behind it.

export type JsonSchema = Record<string, unknown>;

/** What the agent may read. Absolute, realpath'd paths (DES-007). */
export interface ReadScope {
  root: string;
  excluded: string[];
}

export interface AgentRequest {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: JsonSchema;
  readScope: ReadScope;
  maxTurns: number;
  timeoutMs: number;
}

export interface ToolCall {
  tool: string;
  path: string;
  allowed: boolean;
}

export interface AgentResult {
  /** Structured output when the provider returned one, else null (DES-012 parses rawText). */
  output: unknown;
  rawText: string;
  toolCalls: ToolCall[];
  usage: Record<string, number>;
}

export interface AgentProvider {
  readonly name: string;
  /** No vault writes. Throws ProviderNotReady with a message saying how to fix it. */
  preflight(): Promise<void>;
  run(req: AgentRequest): Promise<AgentResult>;
}

/** Preflight failed: exit 2, nothing changed (REQ-032). */
export class ProviderNotReady extends Error {
  override name = "ProviderNotReady";
}

/** Mid-run infrastructure fault (CLI crash, auth lost, rate or usage limit): exit 4, no strike (D12). */
export class ProviderUnavailable extends Error {
  override name = "ProviderUnavailable";
}

/** This item failed (timeout, turn cap, no result): strike counted (DES-016). */
export class AgentItemError extends Error {
  override name = "AgentItemError";
}

/** Tool-policy decision for one call (DES-010). `path` is what the log and ledger show. */
export interface ToolDecision {
  allowed: boolean;
  path: string;
  reason: string;
}

export type ToolDecider = (tool: string, input: unknown, scope: ReadScope) => ToolDecision;

// Claude Code provider: the agent step through the Claude Agent SDK for
// TypeScript, which drives the installed Claude Code CLI and so reuses the
// operator's login or ANTHROPIC_API_KEY (DES-009, DES-010, ADR-0007).
//
// T5 spike findings, verified on 2026-10-04 against @anthropic-ai/claude-agent-sdk
// 0.3.289 (pinned) and Claude Code CLI 2.1.289 (native binary) on Linux x64:
//
// - pathToClaudeCodeExecutable: works with the installed native binary. No
//   fallback to the SDK's bundled CLI was needed. The SDK's own platform
//   packages still install (optional dependencies) and stay unused.
// - tools: ["Read", "Glob", "Grep"] restricts the built-in set; the init message
//   lists exactly Glob, Grep, Read plus StructuredOutput. Agent, Skill, Bash and
//   the rest aren't offered, even though the CLI still discovers skills, agents
//   and built-in plugins. disallowedTools is passed as a second layer, and run()
//   aborts if the init message ever lists a tool or MCP server outside the set.
// - outputFormat { type: "json_schema" } works. The CLI implements it as a
//   StructuredOutput tool call, which costs one turn and passes through the
//   PreToolUse hook like any tool. The provider lets that one tool through
//   without consulting the read policy, and doesn't count it as a read. The
//   parsed object arrives as result.structured_output; result.result carries
//   the same JSON as text.
// - hooks.PreToolUse fires for every tool call, before permission checks. A
//   { permissionDecision: "deny" } output blocks the call; the model sees an
//   error tool result and the denial is listed in result.permission_denials.
// - canUseTool is only consulted when the CLI would otherwise prompt. Read,
//   Glob and Grep inside cwd or additionalDirectories don't prompt in
//   permissionMode "default", so for in-scope calls the hook is the only check
//   that runs; canUseTool backs it for anything that would prompt.
// - settingSources: [] loads no user, project or local settings (no CLAUDE.md,
//   hooks or permission rules). mcpServers: {} with strictMcpConfig: true gives
//   an empty MCP list.
// - persistSession: false writes no transcript under ~/.claude/projects/.
// - permissionMode "default", maxTurns, abortController and a string
//   systemPrompt all behave as documented.
// - Authentication check without a model call: `claude auth status --json`
//   reports { loggedIn, authMethod, ... } (exit 1 when logged out). For a
//   claude.ai subscription login that is the whole check. It reports any
//   ANTHROPIC_API_KEY as logged in without validating it, so for API-key and
//   third-party auth the preflight falls back to a minimal no-tool query.
//   Query control API accountInfo() needs a running session, so it isn't used.
// - Failure shapes: logged out, query() yields a result with subtype "success",
//   is_error true and text "Not logged in · Please run /login", then the
//   iterator throws "Claude Code returned an error result". An invalid API key
//   yields system api_retry messages with error "authentication_failed" (HTTP
//   401), retried up to 10 times; the provider aborts on the first one rather
//   than waiting out the retries. Subscription limits arrive as
//   rate_limit_event messages with rate_limit_info.status "rejected".
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, HookCallback, Options, SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveClaude } from "../../lib/claude-bin.ts";
import {
  AgentItemError,
  ProviderNotReady,
  ProviderUnavailable,
  type AgentProvider,
  type AgentRequest,
  type AgentResult,
  type ReadScope,
  type ToolCall,
  type ToolDecider,
} from "./provider.ts";

const execFileP = promisify(execFile);

export const READ_TOOLS = ["Read", "Glob", "Grep"] as const;
const STRUCTURED_OUTPUT_TOOL = "StructuredOutput";
const DISALLOWED_TOOLS = [
  "Bash", "BashOutput", "KillShell", "Monitor", "Write", "Edit", "MultiEdit", "NotebookEdit",
  "WebFetch", "WebSearch", "Task", "Agent", "TodoWrite", "Skill", "SlashCommand",
  "AskUserQuestion", "ExitPlanMode", "EnterPlanMode",
];

export const MSG_NOT_FOUND =
  "Claude Code CLI not found (checked $CLAUDE_BIN, PATH, ~/.local/bin, /usr/local/bin). " +
  "Install Claude Code, then run `task ingest-inbox:preflight`. Nothing was changed.";
export const MSG_NOT_LOGGED_IN =
  "Claude Code is installed but not logged in. Run `claude` and use /login to sign in with a " +
  "Claude subscription, or set ANTHROPIC_API_KEY. Then run `task ingest-inbox:preflight`. Nothing was changed.";
export const MSG_LIMITED =
  "Claude Code is logged in but has hit a rate or usage limit. Wait for it to reset, then run " +
  "`task ingest-inbox:preflight`. Nothing was changed.";

const VERSION_TIMEOUT_MS = 10_000;
const AUTH_TIMEOUT_MS = 60_000;

const AUTH_ERRORS = new Set([
  "authentication_failed", "oauth_org_not_allowed", "account_on_hold", "verification_required", "cloud_credential_error",
]);
const LIMIT_ERRORS = new Set(["rate_limit", "billing_error"]);
const INFRA_ERRORS = new Set(["overloaded", "server_error", "model_not_found"]);

type Fault = { kind: "auth" | "limit" | "infra"; detail: string };

/** Classify a provider error code or text. Null when it's attributable to the item. */
export function classifyFault(code: string | undefined, text: string): Fault | null {
  if (code && AUTH_ERRORS.has(code)) return { kind: "auth", detail: code };
  if (code && LIMIT_ERRORS.has(code)) return { kind: "limit", detail: code };
  if (code && INFRA_ERRORS.has(code)) return { kind: "infra", detail: code };
  if (/not logged in|\/login|invalid api key|authentication|unauthori[sz]ed|oauth token/i.test(text)) {
    return { kind: "auth", detail: text };
  }
  if (/usage limit|rate limit|limit reached|quota|credit balance/i.test(text)) return { kind: "limit", detail: text };
  return null;
}

/** Default decider until the read policy is wired in: deny every tool. Fail closed. */
export const denyAll: ToolDecider = (_tool, input) => ({ allowed: false, path: describePath(input), reason: "no policy" });

function describePath(input: unknown): string {
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    for (const k of ["file_path", "path", "pattern"]) {
      const v = o[k];
      if (typeof v === "string") return v;
    }
  }
  return "";
}

interface ExecOptions {
  bin: string;
  systemPrompt: string;
  prompt: string;
  tools: string[];
  scope: ReadScope | null;
  outputSchema: Record<string, unknown> | null;
  maxTurns: number;
  timeoutMs: number;
}

export interface ClaudeCodeProviderOptions {
  decider?: ToolDecider;
  env?: NodeJS.ProcessEnv;
  onToolCall?: (call: ToolCall) => void;
}

export class ClaudeCodeProvider implements AgentProvider {
  readonly name = "claude-code";
  private readonly decider: ToolDecider;
  private readonly env: NodeJS.ProcessEnv;
  private readonly onToolCall: (call: ToolCall) => void;

  constructor(opts: ClaudeCodeProviderOptions = {}) {
    this.decider = opts.decider ?? denyAll;
    this.env = opts.env ?? process.env;
    this.onToolCall = opts.onToolCall ?? (() => undefined);
  }

  private resolveBin(): string {
    const bin = resolveClaude(this.env);
    if (!bin) throw new ProviderNotReady(MSG_NOT_FOUND);
    return bin;
  }

  async preflight(): Promise<void> {
    const bin = this.resolveBin();
    try {
      await execFileP(bin, ["--version"], { timeout: VERSION_TIMEOUT_MS, env: this.env });
    } catch {
      throw new ProviderNotReady(MSG_NOT_FOUND);
    }
    const status = await this.authStatus(bin);
    if (status?.loggedIn === false) throw new ProviderNotReady(MSG_NOT_LOGGED_IN);
    if (status?.loggedIn === true && status.authMethod === "claude.ai") return; // non-billable check suffices
    // API key, third-party auth, or no readable status: a minimal no-tool query.
    try {
      await this.execute({
        bin, systemPrompt: "Reply with exactly one word.", prompt: "Reply with the word: ready",
        tools: [], scope: null, outputSchema: null, maxTurns: 1, timeoutMs: AUTH_TIMEOUT_MS,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof ProviderUnavailable && msg.startsWith("auth:")) throw new ProviderNotReady(MSG_NOT_LOGGED_IN);
      if (err instanceof ProviderUnavailable && msg.startsWith("limit:")) throw new ProviderNotReady(MSG_LIMITED);
      throw new ProviderNotReady(`Claude Code authentication check failed (${msg}). Run \`task ingest-inbox:preflight\` for details. Nothing was changed.`);
    }
  }

  private async authStatus(bin: string): Promise<{ loggedIn?: boolean; authMethod?: string } | null> {
    let stdout: string;
    try {
      ({ stdout } = await execFileP(bin, ["auth", "status", "--json"], { timeout: AUTH_TIMEOUT_MS, env: this.env }));
    } catch (err) {
      // Exit 1 when logged out, with the JSON still on stdout.
      const out = (err as { stdout?: unknown }).stdout;
      if (typeof out !== "string") return null;
      stdout = out;
    }
    try {
      const parsed: unknown = JSON.parse(stdout);
      if (parsed && typeof parsed === "object") {
        const o = parsed as Record<string, unknown>;
        return {
          ...(typeof o["loggedIn"] === "boolean" ? { loggedIn: o["loggedIn"] } : {}),
          ...(typeof o["authMethod"] === "string" ? { authMethod: o["authMethod"] } : {}),
        };
      }
    } catch {
      // fall through
    }
    return null;
  }

  async run(req: AgentRequest): Promise<AgentResult> {
    const bin = resolveClaude(this.env);
    if (!bin) throw new ProviderUnavailable(MSG_NOT_FOUND);
    return this.execute({
      bin, systemPrompt: req.systemPrompt, prompt: req.userPrompt, tools: [...READ_TOOLS], scope: req.readScope,
      outputSchema: req.outputSchema, maxTurns: req.maxTurns, timeoutMs: req.timeoutMs,
    });
  }

  private async execute(o: ExecOptions): Promise<AgentResult> {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "mycelia-agent-"));
    const abort = new AbortController();
    // Mutable run state, written from callbacks and the message loop.
    const st: { timedOut: boolean; fault: Fault | null; result: SDKResultMessage | null; assistantError: string | undefined; thrown: unknown } =
      { timedOut: false, fault: null, result: null, assistantError: undefined, thrown: null };
    const timer = setTimeout(() => {
      st.timedOut = true;
      abort.abort();
    }, o.timeoutMs);
    const toolCalls: ToolCall[] = [];
    const allowedTools = new Set<string>([...o.tools, ...(o.outputSchema ? [STRUCTURED_OUTPUT_TOOL] : [])]);

    const decide = (tool: string, input: unknown): { allowed: boolean; path: string; reason: string } => {
      if (tool === STRUCTURED_OUTPUT_TOOL && o.outputSchema) return { allowed: true, path: "", reason: "output" };
      if (!o.scope || !o.tools.includes(tool)) return { allowed: false, path: describePath(input), reason: "tool not offered" };
      return this.decider(tool, input, o.scope);
    };

    const preToolUse: HookCallback = (input) => {
      if (input.hook_event_name !== "PreToolUse") return Promise.resolve({});
      const d = decide(input.tool_name, input.tool_input);
      if (input.tool_name !== STRUCTURED_OUTPUT_TOOL) {
        const call = { tool: input.tool_name, path: d.path, allowed: d.allowed };
        toolCalls.push(call);
        this.onToolCall(call);
      }
      if (d.allowed) return Promise.resolve({});
      return Promise.resolve({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `denied by the ingester's read policy: ${d.reason}` },
      });
    };
    const canUseTool: CanUseTool = (tool, input) => {
      const d = decide(tool, input);
      return Promise.resolve(d.allowed ? { behavior: "allow", updatedInput: input } : { behavior: "deny", message: `denied: ${d.reason}` });
    };

    const options: Options = {
      pathToClaudeCodeExecutable: o.bin,
      cwd,
      ...(o.scope ? { additionalDirectories: [o.scope.root] } : {}),
      tools: o.tools,
      disallowedTools: DISALLOWED_TOOLS,
      settingSources: [],
      mcpServers: {},
      strictMcpConfig: true,
      permissionMode: "default",
      maxTurns: o.maxTurns,
      abortController: abort,
      persistSession: false,
      systemPrompt: o.systemPrompt,
      hooks: { PreToolUse: [{ hooks: [preToolUse] }] },
      canUseTool,
      env: this.env,
      ...(o.outputSchema ? { outputFormat: { type: "json_schema", schema: o.outputSchema } } : {}),
    };

    const trip = (f: Fault): void => {
      st.fault ??= f;
      abort.abort();
    };
    try {
      for await (const m of query({ prompt: o.prompt, options }) as AsyncIterable<SDKMessage>) {
        if (m.type === "system" && m.subtype === "init") {
          const extra = m.tools.filter((t) => !allowedTools.has(t));
          if (extra.length > 0 || m.mcp_servers.length > 0) {
            trip({ kind: "infra", detail: `unexpected tools or MCP servers offered to the agent: ${[...extra, ...m.mcp_servers.map((s) => s.name)].join(", ")}` });
          }
        } else if (m.type === "system" && m.subtype === "api_retry") {
          const f = classifyFault(m.error, "");
          if (f && f.kind !== "infra") trip(f);
        } else if (m.type === "rate_limit_event") {
          if (m.rate_limit_info.status === "rejected") trip({ kind: "limit", detail: `rate limit (${m.rate_limit_info.rateLimitType ?? "unknown"})` });
        } else if (m.type === "assistant") {
          if (m.error) st.assistantError = m.error;
        } else if (m.type === "result") {
          st.result = m;
        }
      }
    } catch (err) {
      st.thrown = err;
    } finally {
      clearTimeout(timer);
      await rm(cwd, { recursive: true, force: true });
    }

    if (st.fault) throw new ProviderUnavailable(`${st.fault.kind}: ${st.fault.detail}`);
    if (st.timedOut) throw new AgentItemError(`agent timed out after ${Math.round(o.timeoutMs / 1000)} s`);
    const r = st.result;
    if (!r) {
      const msg = st.thrown instanceof Error ? st.thrown.message : "no result";
      const f = classifyFault(st.assistantError, msg);
      if (f) throw new ProviderUnavailable(`${f.kind}: ${f.detail}`);
      throw new ProviderUnavailable(`Claude Code process failed: ${msg}`);
    }
    const usage: Record<string, number> = { turns: r.num_turns, durationMs: r.duration_ms, costUsd: r.total_cost_usd };
    for (const [k, v] of Object.entries(r.usage)) if (typeof v === "number") usage[k] = v;

    if (r.subtype === "success" && !r.is_error) {
      return { output: r.structured_output ?? null, rawText: r.result, toolCalls, usage };
    }
    const text = r.subtype === "success" ? r.result : r.errors.join("; ");
    const f = classifyFault(st.assistantError, text);
    if (f) throw new ProviderUnavailable(`${f.kind}: ${f.detail}`);
    switch (r.subtype) {
      case "error_max_turns":
        throw new AgentItemError(`agent reached the ${o.maxTurns}-turn cap`);
      case "error_max_structured_output_retries":
        throw new AgentItemError("agent produced no valid structured output");
      default:
        throw new AgentItemError(`agent error (${r.subtype}): ${text || "no detail"}`);
    }
  }
}

// Prompt construction (DES-011): the system prompt is the only instruction
// source; the user prompt carries data only, with untrusted material in
// nonce-delimited blocks. A separate per-call canary goes in the system prompt
// only, so a planted answer echoed from the material fails validation.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Target } from "./targets.ts";

const TEMPLATE = readFileSync(path.join(import.meta.dirname, "system-prompt.txt"), "utf8");

export function nonce(): string {
  return randomBytes(8).toString("hex");
}

/** Replace "<<<" so content can't close a block early or fake one. */
export function defang(text: string): string {
  return text.replace(/<<</g, "‹‹‹");
}

function attrValue(s: string): string {
  return defang(s).replace(/["\r\n]/g, "'");
}

export function wrapUntrusted(blockNonce: string, source: string, name: string, text: string): string {
  return [
    `<<<UNTRUSTED-${blockNonce} source="${attrValue(source)}" name="${attrValue(name)}">>>`,
    defang(text),
    `<<<END-UNTRUSTED-${blockNonce}>>>`,
  ].join("\n");
}

export interface PromptInput {
  vaultRoot: string;
  targets: readonly Target[];
  fixedTargets: readonly string[];
  itemName: string;
  itemText: string;
  sources: readonly { url: string; text: string }[];
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  canary: string;
  blockNonce: string;
}

export function buildPrompt(input: PromptInput, nonces: { canary: string; blockNonce: string } = { canary: nonce(), blockNonce: nonce() }): BuiltPrompt {
  const { canary, blockNonce } = nonces;
  const systemPrompt = TEMPLATE.replaceAll("{{CANARY}}", canary).replaceAll("{{BLOCK_NONCE}}", blockNonce);
  const lines: string[] = [
    `Vault root: ${input.vaultRoot}`,
    "",
    "Areas and projects (slug — kind — description — path):",
    ...input.targets.map((t) => `- ${defang(`${t.slug} — ${t.kind} — ${t.description || "(no description)"} — ${t.relPath}`)}`),
    "",
  ];
  if (input.fixedTargets.length > 0) {
    lines.push(`Fixed targets: the capture links these, so use exactly these as "targets" and decide "place": ${input.fixedTargets.join(", ")}`, "");
  }
  lines.push(`The captured item is ${JSON.stringify(input.itemName)}.`, "");
  lines.push(wrapUntrusted(blockNonce, "capture", input.itemName, input.itemText));
  for (const s of input.sources) lines.push("", wrapUntrusted(blockNonce, "url", s.url, s.text));
  return { systemPrompt, userPrompt: `${lines.join("\n")}\n`, canary, blockNonce };
}

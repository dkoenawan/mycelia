// Builds an ItemContext over a temp vault with a FakeProvider.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { FakeProvider, structured, type FakeResponder } from "../../src/ingest/agent/fake.ts";
import type { AgentRequest } from "../../src/ingest/agent/provider.ts";
import { scanAsks } from "../../src/ingest/asks.ts";
import { Journal } from "../../src/ingest/journal.ts";
import { Ledger } from "../../src/ingest/ledger.ts";
import type { ItemContext } from "../../src/ingest/run.ts";
import { FlatTargetIndex } from "../../src/ingest/targets.ts";
import { VaultIndex } from "../../src/ingest/vault.ts";

export const BOOTSTRAP_AREA = (slug: string, description: string): string => [
  "---", `name: ${slug}`, `description: ${description}`, "type: area", "created: 2026-09-27", "updated: 2026-09-27", "---", "",
  "Projects that serve this area — link each one here as a wikilink, e.g. `[[project-slug]]`,",
  `and link back to this area from the project note with [[${slug}]]:`, "", "-", "",
  "Resources with reusable patterns for this area — link each `30-resources/` note, e.g.",
  "`[[resource-slug]]`:", "", "-", "",
].join("\n");

/** The canary from a request's system prompt. */
export function canaryOf(req: AgentRequest): string {
  return /"canary": exactly the string ([0-9a-f]{16})/.exec(req.systemPrompt)?.[1] ?? "";
}

/** A responder that places under `targets` with a valid answer. */
export function placing(targets: string[], title = "Designing agentic workflows"): FakeResponder {
  return (req) => structured({
    canary: canaryOf(req), decision: "place", title, description: "A guide to designing agent workflows.",
    summary: "It explains how to design agentic workflows step by step.", takeaways: ["Plan each step.", "Gate before landing."], targets,
  });
}

export function noFit(closest: string[] = []): FakeResponder {
  return (req) => structured({ canary: canaryOf(req), decision: "no_fit", title: "Bread", description: "Baking bread.", targets: [], closest });
}

export async function makeContext(root: string, responder: FakeResponder, extra: Partial<ItemContext> = {}): Promise<ItemContext & { fake: FakeProvider; logs: string[] }> {
  const stateDir = path.join(root, ".state/ingest-inbox");
  mkdirSync(stateDir, { recursive: true });
  const vault = VaultIndex.build(root);
  const fake = new FakeProvider(responder);
  const logs: string[] = [];
  return {
    root, run: "2026-10-01T06:00:00Z", runDate: "2026-10-01", vault,
    targets: await FlatTargetIndex.load(root, vault), asks: await scanAsks(root),
    ledger: new Ledger(path.join(stateDir, "ledger.jsonl")), journal: new Journal(root, stateDir),
    provider: fake, env: { MYCELIA_INGEST_ALLOW_PRIVATE: "1" }, log: (m) => { logs.push(m); },
    fake, logs, ...extra,
  };
}

// Child process for the T8 crash gate: runs one item's transaction and kills
// itself with SIGKILL at a chosen point. argv: root stateDir killAt
//   killAt = "begin"  : after the journal is written, before any operation
//   killAt = "0".."2" : after that operation
//   killAt = "ledger" : after the ledger append, before the journal is dropped
import path from "node:path";
import { Journal } from "../../src/ingest/journal.ts";
import { Ledger } from "../../src/ingest/ledger.ts";
import { readFileSync } from "node:fs";

const [root, stateDir, killAt] = process.argv.slice(2) as [string, string, string];
const die = (): never => {
  process.kill(process.pid, "SIGKILL");
  throw new Error("unreachable");
};
const journal = new Journal(root, stateDir);
const ledger = new Ledger(path.join(stateDir, "ledger.jsonl"));
const item = "00-inbox/capture/post.md";
const itemSha = (await import("../../src/ingest/journal.ts")).sha256(readFileSync(path.join(root, item)));
const career = readFileSync(path.join(root, "20-areas/career.md"), "utf8");
const txn = await journal.begin({ run: "2026-10-01T06:00:00Z", item: "post.md", itemSha }, [
  { op: "create", path: "30-resources/post-summary.md", content: "resource\n" },
  { op: "modify", path: "20-areas/career.md", content: `${career}- [[post-summary]]\n` },
  { op: "move", src: item, dst: "40-archive/capture/post.md" },
]);
if (killAt === "begin") die();
await journal.apply(txn, (i) => {
  if (String(i) === killAt) die();
});
await journal.commit(async () => {
  await ledger.append({ event: "item", run: "2026-10-01T06:00:00Z", item: "post.md", sha256: itemSha, outcome: "ingested" });
  if (killAt === "ledger") die();
});

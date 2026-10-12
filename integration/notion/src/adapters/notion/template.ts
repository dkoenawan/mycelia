// Loads the source inbox template (DES-003) for the provisioner (DES-005).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { StatusForm } from "../../application/ports.ts";
import type { Json } from "./http-client.ts";
import type { InboxTemplate } from "./source-inbox.ts";

export const TEMPLATE_FILE = path.resolve(import.meta.dirname, "..", "..", "..", "template", "source-inbox.json");

function obj(v: unknown, what: string): Json {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`source inbox template: ${what} is missing`);
  return v as Json;
}

export function loadTemplate(file: string = TEMPLATE_FILE): InboxTemplate {
  const t = obj(JSON.parse(readFileSync(file, "utf8")), "the template");
  const status = obj(t["status"], "status");
  const forms = obj(status["forms"], "status.forms");
  const instructions = obj(t["instructions"], "instructions");
  const paragraphs = instructions["paragraphs"];
  if (typeof t["title"] !== "string" || typeof instructions["title"] !== "string" || !Array.isArray(paragraphs) || !paragraphs.every((p) => typeof p === "string")) {
    throw new Error("source inbox template: title or instructions malformed");
  }
  const statusForms: Record<StatusForm, Json> = { status: obj(forms["status"], "status.forms.status"), select: obj(forms["select"], "status.forms.select") };
  return { title: t["title"], properties: obj(t["properties"], "properties"), statusForms, instructions: { title: instructions["title"], paragraphs: paragraphs } };
}

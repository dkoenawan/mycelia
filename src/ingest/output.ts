// Output contract (DES-012): the JSON Schema handed to the SDK, and the
// hand-written validator that decides. Any violation fails the item.

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    canary: { type: "string", minLength: 1, maxLength: 64 },
    decision: { type: "string", enum: ["place", "no_fit"] },
    title: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", minLength: 1, maxLength: 200 },
    summary: { type: "string", minLength: 1, maxLength: 3000 },
    takeaways: { type: "array", minItems: 1, maxItems: 7, items: { type: "string", minLength: 1, maxLength: 400 } },
    targets: { type: "array", maxItems: 3, items: { type: "string", minLength: 1, maxLength: 200 } },
    closest: { type: "array", maxItems: 3, items: { type: "string", minLength: 1, maxLength: 200 } },
    no_fit_reason: { type: "string", maxLength: 300 },
    injection_suspected: { type: "boolean" },
  },
  required: ["canary", "decision", "title", "description", "targets"],
} as const;

export interface Output {
  decision: "place" | "no_fit";
  title: string;
  description: string;
  summary: string;
  takeaways: string[];
  /** Canonical slugs (as in the target index). */
  targets: string[];
  closest: string[];
  noFitReason: string;
  injectionSuspected: boolean;
}

export interface ValidationContext {
  canary: string;
  /** Every nonce used in this call; none may appear in a text field. */
  nonces: readonly string[];
  /** Indexed slugs, canonical case. */
  slugs: readonly string[];
  /** REQ-019 fixed targets (canonical slugs), or empty. */
  fixedTargets: readonly string[];
}

export type Validation = { ok: true; output: Output } | { ok: false; problems: string[] };

const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Parse a provider's raw text as JSON, after stripping a Markdown code fence. */
export function parseRawOutput(raw: string): unknown {
  const t = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(t);
  try {
    return JSON.parse(fenced?.[1] ?? t);
  } catch {
    return null;
  }
}

export function validateOutput(x: unknown, ctx: ValidationContext): Validation {
  const problems: string[] = [];
  const bad = (field: string, problem: string): void => {
    problems.push(`${field}: ${problem}`);
  };
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, problems: ["output: not a JSON object"] };
  const o = x as Record<string, unknown>;
  const bySlug = new Map(ctx.slugs.map((s) => [s.toLowerCase(), s]));

  const text = (field: string, min: number, max: number, opts: { required: boolean; singleLine: boolean }): string => {
    const v = o[field];
    if (v === undefined) {
      if (opts.required) bad(field, "required");
      return "";
    }
    if (typeof v !== "string") {
      bad(field, "must be a string");
      return "";
    }
    if (v.length > max) bad(field, `longer than ${String(max)} characters`);
    if (opts.singleLine && /[\r\n]/.test(v.trim())) bad(field, "must be a single line");
    const c = opts.singleLine ? collapse(v) : v.trim();
    if (c.length < min) bad(field, "empty");
    if (ctx.nonces.some((n) => v.includes(n))) bad(field, "contains a nonce");
    return c;
  };
  const list = (field: string, maxItems: number, itemMax: number, opts: { required: boolean }): string[] => {
    const v = o[field];
    if (v === undefined) {
      if (opts.required) bad(field, "required");
      return [];
    }
    if (!Array.isArray(v) || v.some((s) => typeof s !== "string")) {
      bad(field, "must be a list of strings");
      return [];
    }
    const items = v as string[];
    if (items.length > maxItems) bad(field, `more than ${String(maxItems)} items`);
    for (const s of items) {
      if (s.length > itemMax) bad(field, `an item is longer than ${String(itemMax)} characters`);
      if (/[\r\n]/.test(s.trim())) bad(field, "an item must be a single line");
      if (collapse(s).length === 0) bad(field, "an item is empty");
      if (ctx.nonces.some((n) => s.includes(n))) bad(field, "contains a nonce");
    }
    return items.map(collapse);
  };
  const slugList = (field: string, items: string[]): string[] => {
    const out: string[] = [];
    for (const s of items) {
      const canon = bySlug.get(s.toLowerCase());
      if (!canon) bad(field, `${JSON.stringify(s)} is not an indexed area or project`);
      else if (out.includes(canon)) bad(field, `${JSON.stringify(s)} is listed twice`);
      else out.push(canon);
    }
    return out;
  };

  if (o["canary"] !== ctx.canary) bad("canary", "doesn't match this call's canary");
  const decision = o["decision"];
  if (decision !== "place" && decision !== "no_fit") bad("decision", 'must be "place" or "no_fit"');
  const place = decision === "place";
  const title = text("title", 1, 120, { required: true, singleLine: true });
  const description = text("description", 1, 200, { required: true, singleLine: true });
  const summary = text("summary", 1, 3000, { required: place, singleLine: false });
  const takeaways = list("takeaways", 7, 400, { required: place });
  if (place && takeaways.length === 0 && o["takeaways"] !== undefined) bad("takeaways", "at least one is required");
  const rawTargets = list("targets", 3, 200, { required: true });
  const closest = slugList("closest", list("closest", 3, 200, { required: false }));
  const noFitReason = text("no_fit_reason", 0, 300, { required: false, singleLine: false });
  const inj = o["injection_suspected"];
  if (inj !== undefined && typeof inj !== "boolean") bad("injection_suspected", "must be a boolean");

  let targets: string[];
  if (ctx.fixedTargets.length > 0) {
    if (!place) bad("decision", "must be \"place\" when the capture links its own targets");
    targets = [...ctx.fixedTargets];
  } else {
    targets = slugList("targets", rawTargets);
    if (place && rawTargets.length === 0) bad("targets", "at least one is required when placing");
    if (!place && rawTargets.length > 0) bad("targets", "must be empty for no_fit");
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    output: {
      decision: place ? "place" : "no_fit",
      title, description, summary, takeaways, targets, closest, noFitReason,
      injectionSuspected: inj === true,
    },
  };
}

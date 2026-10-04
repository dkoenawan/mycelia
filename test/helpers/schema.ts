// A minimal JSON Schema checker for the subset OUTPUT_SCHEMA uses (type, enum,
// required, properties, items, min/max length and items). Test-only, so the
// schema and the validator can be run over the same fixtures (DES-012).
export function schemaAccepts(schema: unknown, v: unknown): boolean {
  const s = schema as Record<string, unknown>;
  const type = s["type"];
  if (type === "object") {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const o = v as Record<string, unknown>;
    for (const r of (s["required"] as string[] | undefined) ?? []) if (!(r in o)) return false;
    const props = (s["properties"] as Record<string, unknown> | undefined) ?? {};
    return Object.entries(props).every(([k, sub]) => !(k in o) || schemaAccepts(sub, o[k]));
  }
  if (type === "array") {
    if (!Array.isArray(v)) return false;
    if (typeof s["minItems"] === "number" && v.length < s["minItems"]) return false;
    if (typeof s["maxItems"] === "number" && v.length > s["maxItems"]) return false;
    return v.every((x) => schemaAccepts(s["items"], x));
  }
  if (type === "string") {
    if (typeof v !== "string") return false;
    if (typeof s["minLength"] === "number" && v.length < s["minLength"]) return false;
    if (typeof s["maxLength"] === "number" && v.length > s["maxLength"]) return false;
    const en = s["enum"] as unknown[] | undefined;
    return !en || en.includes(v);
  }
  if (type === "boolean") return typeof v === "boolean";
  return false;
}

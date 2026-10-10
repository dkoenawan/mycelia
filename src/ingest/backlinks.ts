// Back-link writer (DES-014, REQ-016, REQ-017): append one "- [[slug]]" list
// item to the end of a target's resources section, or a "## Resources" section
// at the end of the note. Nothing else in the note changes.

const LIST_ITEM = /^\s*[-*+](\s|$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}(\s|$)/;

function isBlank(s: string): boolean {
  return s.trim() === "";
}

function linkRe(slug: string): RegExp {
  const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\[\\[${esc}(\\|[^\\]]*)?\\]\\]`, "i");
}

/** Text of a line after leading whitespace, # marks and one list marker. */
function stripMarkers(line: string): string {
  return line.replace(/^\s*/, "").replace(/^#{1,6}\s*/, "").replace(/^(?:[-*+]|\d+[.)])\s+/, "");
}

export interface BacklinkEdit {
  content: string;
  changed: boolean;
}

export function addBacklink(content: string, slug: string): BacklinkEdit {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (endsWithNewline) lines.pop();
  const item = `- [[${slug}]]`;

  let start = 0;
  if (lines[0] === "---") {
    const close = lines.findIndex((l, i) => i > 0 && (l === "---" || l === "..."));
    if (close > 0) start = close + 1;
  }
  let r = -1;
  let fence: string | null = null;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = FENCE.exec(line);
    if (fence) {
      if (m?.[1]?.[0] === fence[0] && line.trim().length >= fence.length && /^[`~]+$/.test(line.trim())) fence = null;
      continue;
    }
    if (m?.[1]) {
      fence = m[1];
      continue;
    }
    if (/^resources\b/i.test(stripMarkers(line))) {
      r = i;
      break;
    }
  }

  if (r < 0) {
    if (lines.some((l) => linkRe(slug).test(l) && LIST_ITEM.test(l)) && lines.some((l) => /^## Resources$/.test(l))) return { content, changed: false };
    const head = endsWithNewline || content === "" ? content : content + eol;
    return { content: `${head}## Resources${eol}${item}${eol}`, changed: true };
  }

  let p = r;
  if (!HEADING.test(lines[r] ?? "")) {
    while (p + 1 < lines.length && !isBlank(lines[p + 1] ?? "") && !LIST_ITEM.test(lines[p + 1] ?? "")) p++;
  }
  let next = p + 1;
  while (next < lines.length && isBlank(lines[next] ?? "")) next++;
  let insertAt = p + 1;
  let indent = "";
  if (next < lines.length && LIST_ITEM.test(lines[next] ?? "")) {
    indent = /^\s*/.exec(lines[next] ?? "")?.[0] ?? "";
    let last = next;
    for (let k = next + 1; k < lines.length; k++) {
      const l = lines[k] ?? "";
      if (LIST_ITEM.test(l) || (!isBlank(l) && /^\s+\S/.test(l))) {
        last = k;
        continue;
      }
      if (isBlank(l)) {
        let peek = k + 1;
        while (peek < lines.length && isBlank(lines[peek] ?? "")) peek++;
        if (peek < lines.length && LIST_ITEM.test(lines[peek] ?? "")) {
          k = peek - 1;
          continue;
        }
      }
      break;
    }
    if (lines.slice(r, last + 1).some((l) => linkRe(slug).test(l))) return { content, changed: false };
    insertAt = last + 1;
  } else if (lines.slice(r, p + 1).some((l) => linkRe(slug).test(l) && LIST_ITEM.test(l))) {
    return { content, changed: false };
  }
  lines.splice(insertAt, 0, `${indent}${item}`);
  return { content: lines.join(eol) + (endsWithNewline ? eol : ""), changed: true };
}

/**
 * Exact-diff check (DES-016 rule 5): `post` is `pre` with exactly one added
 * "- [[slug]]" line (REQ-016), or with "## Resources" and that line appended
 * at the end (REQ-017). Returns a problem, or null.
 */
export function checkBacklinkDiff(pre: string, post: string, slug: string): string | null {
  const eol = pre.includes("\r\n") ? "\r\n" : "\n";
  const item = new RegExp(`^\\s*- \\[\\[${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]$`);
  const a = pre.split(eol);
  const b = post.split(eol);
  if (b.length === a.length + 1) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (item.test(b[i] ?? "") && a.slice(i).join(eol) === b.slice(i + 1).join(eol)) return null;
  }
  const base = pre === "" || pre.endsWith("\n") ? pre : pre + eol;
  if (post === `${base}## Resources${eol}- [[${slug}]]${eol}`) return null;
  return `back-link diff in the target isn't exactly one added "- [[${slug}]]" line`;
}

// Port of common.sh's append_daily (ADR-0007): creates daily/<date>.md with
// the same frontmatter if it's missing, then appends. A test pins the header
// to common.sh's so the two can't drift until #18 retires the bash side.
import { appendFile, mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";

export function dailyHeader(date: string): string {
  return `---\nname: ${date}\ndescription: Daily log for ${date}\ntype: daily\ncreated: ${date}\nupdated: ${date}\n---\n\n`;
}

/**
 * Append `text` to daily/<date>.md under root, creating the note with frontmatter
 * if absent. With `block`, a blank line separates it from what's already there.
 */
export async function appendDaily(root: string, date: string, text: string, opts: { block?: boolean } = {}): Promise<string> {
  const dir = path.join(root, "daily");
  const note = path.join(dir, `${date}.md`);
  await mkdir(dir, { recursive: true });
  try {
    const fh = await open(note, "wx");
    try {
      await fh.writeFile(dailyHeader(date));
    } finally {
      await fh.close();
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  let out = text.endsWith("\n") ? text : `${text}\n`;
  if (opts.block) {
    const cur = await readFile(note, "utf8");
    if (!cur.endsWith("\n\n")) out = `${cur.endsWith("\n") ? "" : "\n"}\n${out}`;
  }
  await appendFile(note, out);
  return note;
}

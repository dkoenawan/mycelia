import { test } from "node:test";
import assert from "node:assert/strict";
import { archiveBase, renderResource, resourceSlugBase, sanitize, slugify } from "../../src/ingest/render.ts";
import { addBacklink, checkBacklinkDiff } from "../../src/ingest/backlinks.ts";
import { parseFrontmatter, splitFrontmatter } from "../../src/ingest/frontmatter.ts";
import { parseWikilinks } from "../../src/ingest/vault.ts";

// The note shape scripts/bootstrap-areas.sh writes.
const BOOTSTRAP = [
  "---", "name: career", "description: Work and career", "type: area", "created: 2026-09-27", "updated: 2026-09-27", "---", "",
  "Projects that serve this area — link each one here as a wikilink, e.g. `[[project-slug]]`,",
  "and link back to this area from the project note with [[career]]:", "", "-", "",
  "Resources with reusable patterns for this area — link each `30-resources/` note, e.g.",
  "`[[resource-slug]]`:", "", "-", "",
].join("\n");

test("slugs: NFKD, ASCII, kebab, 60-character cut on a boundary, fallbacks", () => {
  assert.equal(slugify("Designing Agentic Workflows!"), "designing-agentic-workflows");
  assert.equal(slugify("Café déjà vu"), "cafe-deja-vu");
  assert.equal(slugify("日本語"), "");
  const long = slugify("word ".repeat(30));
  assert.ok(long.length <= 60 && !long.endsWith("-"));
  assert.equal(long, Array.from({ length: 12 }, () => "word").join("-"));
  assert.equal(resourceSlugBase("日本語", "agentic-post"), "agentic-post");
  assert.equal(resourceSlugBase("!!!", "日本"), "capture");
  assert.equal(archiveBase("a#b[c]"), "a-b-c-");
});

test("sanitiser: no live wikilinks, embeds, HTML, or links to URLs not in the item", () => {
  const allowed = ["https://example.org/a"];
  const s = sanitize([
    "See [[secret-note]] and ![[diagram.png]] and ![img](https://evil.example/p.png).",
    "<img src=x onerror=alert(1)> <https://evil.example/x>",
    "[click](https://evil.example/steal?d=1) [ok](https://example.org/a) https://example.org/a.",
    "Bare https://evil.example/leak, www.evil.example/y and [ref]: https://evil.example/r",
    "zero\u200Bwidth\u202E",
  ].join("\n"), allowed);
  assert.equal(parseWikilinks(s).length, 0);
  assert.equal(s.includes("<"), false);
  assert.ok(s.includes("[ok](https://example.org/a)"));
  assert.ok(s.includes("https://example.org/a."));
  assert.ok(s.includes("click"));
  assert.equal(/\]\(https:\/\/evil/.test(s), false);
  for (const m of s.matchAll(/https?:\/\/evil[^\s`]*/g)) {
    const before = s[(m.index) - 1];
    assert.equal(before, "`", `evil URL not inert: ${m[0]}`);
  }
  assert.equal(s.includes("\u200B"), false);
  assert.equal(sanitize("a\nb   c", [], { singleLine: true }), "a b c");
});

test("resource template (REQ-013/014/015)", () => {
  const out = renderResource({
    slug: "designing-agentic-workflows", date: "2026-10-01", description: "A guide: agents",
    summary: "It explains [[things]].", takeaways: ["Plan each step."], targets: ["career", "side-project"],
    archivedLinkTarget: "agentic-post", urls: ["https://example.org/agentic-workflows"],
  });
  const fm = parseFrontmatter(splitFrontmatter(out).yaml).data ?? {};
  assert.deepEqual(fm, { name: "designing-agentic-workflows", description: "A guide: agents", type: "resource", created: "2026-10-01", updated: "2026-10-01" });
  assert.deepEqual(parseWikilinks(out).map((l) => l.target), ["career", "side-project", "agentic-post"]);
  assert.ok(out.includes("## Summary\n\nIt explains \\[\\[things]].\n\n## Key takeaways\n\n- Plan each step.\n\n## Related\n\n- [[career]]\n- [[side-project]]\n\n## Source\n\n- Original capture: [[agentic-post]]\n- <https://example.org/agentic-workflows>\n"));
  assert.equal(out.includes("\n# "), false, "no H1");
});

test("REQ-016: a bootstrap note gains exactly one line after the placeholder", () => {
  const e = addBacklink(BOOTSTRAP, "designing-agentic-workflows");
  assert.ok(e.changed);
  assert.equal(e.content, BOOTSTRAP.replace("`[[resource-slug]]`:\n\n-\n", "`[[resource-slug]]`:\n\n-\n- [[designing-agentic-workflows]]\n"));
  assert.equal(checkBacklinkDiff(BOOTSTRAP, e.content, "designing-agentic-workflows"), null);
  // Idempotent: already present, nothing written.
  assert.equal(addBacklink(e.content, "designing-agentic-workflows").changed, false);
  // A second resource goes after the first.
  const e2 = addBacklink(e.content, "sourdough-basics");
  assert.ok(e2.content.includes("-\n- [[designing-agentic-workflows]]\n- [[sourdough-basics]]\n"));
});

test("REQ-016: headings, paragraphs without a list, loose lists, CRLF, fences", () => {
  assert.equal(addBacklink("# Area\n\n## Resources\n\n- [[a]]\n  more\n- [[b]]\n\nAfter.\n", "c").content, "# Area\n\n## Resources\n\n- [[a]]\n  more\n- [[b]]\n- [[c]]\n\nAfter.\n");
  assert.equal(addBacklink("Resources I like:\nmore words\n\nOther.\n", "c").content, "Resources I like:\nmore words\n- [[c]]\n\nOther.\n");
  assert.equal(addBacklink("## Resources\n\n- [[a]]\n\n- [[b]]\n\nEnd\n", "c").content, "## Resources\n\n- [[a]]\n\n- [[b]]\n- [[c]]\n\nEnd\n");
  assert.equal(addBacklink("## Resources\r\n\r\n- [[a]]\r\n", "c").content, "## Resources\r\n\r\n- [[a]]\r\n- [[c]]\r\n");
  assert.equal(addBacklink("```\nResources fake\n```\n## Resources\n- x\n", "c").content, "```\nResources fake\n```\n## Resources\n- x\n- [[c]]\n");
  assert.equal(addBacklink("---\ndescription: Resources in frontmatter\n---\nBody\n", "c").content, "---\ndescription: Resources in frontmatter\n---\nBody\n## Resources\n- [[c]]\n");
  assert.equal(addBacklink("- Resources:\n  - [[a]]\n", "c").content, "- Resources:\n  - [[a]]\n  - [[c]]\n");
});

test("REQ-017: no resources section appends one at the end", () => {
  const pre = "---\nname: side-project\n---\n\nNotes without the word.";
  const e = addBacklink(pre, "x");
  assert.equal(e.content, `${pre}\n## Resources\n- [[x]]\n`);
  assert.equal(checkBacklinkDiff(pre, e.content, "x"), null);
  assert.equal(addBacklink("a\n", "x").content, "a\n## Resources\n- [[x]]\n");
});

test("exact-diff check rejects anything else", () => {
  assert.match(checkBacklinkDiff(BOOTSTRAP, BOOTSTRAP.replace("Work and career", "Changed") + "- [[x]]\n", "x") ?? "", /isn't exactly/);
  assert.match(checkBacklinkDiff("a\nb\n", "a\n- [[y]]\nb\n", "x") ?? "", /isn't exactly/);
  assert.equal(checkBacklinkDiff("a\nb\n", "a\n- [[x]]\nb\n", "x"), null);
});

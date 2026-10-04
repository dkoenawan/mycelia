import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { VaultIndex, parseWikilinks, stripCode } from "../../src/ingest/vault.ts";
import { FlatTargetIndex } from "../../src/ingest/targets.ts";
import { parseFrontmatter, readFrontmatter, renderFrontmatter, splitFrontmatter } from "../../src/ingest/frontmatter.ts";
import { note, tempVault } from "../helpers/vault.ts";

test("wikilink parsing: aliases, headings, blocks, embeds; code is skipped", () => {
  const text = [
    "See [[career]] and [[Side Project|the project]] and [[health#Sleep]] and [[x^abc]] and ![[diagram.png]].",
    "Inline `[[not-a-link]]` code.",
    "```",
    "[[in-fence]]",
    "```",
    "~~~~",
    "[[in-tilde-fence]]",
    "~~~~",
    "After [[after-fence]].",
  ].join("\n");
  assert.deepEqual(parseWikilinks(text).map((l) => [l.target, l.embed]), [
    ["career", false], ["Side Project", false], ["health", false], ["x", false], ["diagram.png", true], ["after-fence", false],
  ]);
  assert.equal(stripCode("a `b` c").length, "a `b` c".length);
});

test("vault index: mirrors Obsidian, resolves stems and filenames, skips dot-directories", () => {
  const v = tempVault({
    "20-areas/career.md": note("career", "work"),
    "30-resources/Career.md": "dup in another case",
    "40-archive/capture/post.txt": "text",
    "docs/diagram.png": "png",
    ".obsidian/hidden.md": "x",
    ".git/HEAD": "x",
    "node_modules/pkg/readme.md": "pkg docs",
    "10-projects/node.js.md": "dots in a stem",
  });
  try {
    mkdirSync(path.join(v.root, "elsewhere"));
    symlinkSync(path.join(v.root, "20-areas"), path.join(v.root, "elsewhere", "linked-dir"));
    const idx = VaultIndex.build(v.root);
    assert.deepEqual(idx.matches("career").sort(), ["20-areas/career.md", "30-resources/Career.md"]);
    assert.deepEqual(idx.matches("20-areas/career"), ["20-areas/career.md"]);
    assert.deepEqual(idx.matches("career.md").length, 2);
    assert.deepEqual(idx.matches("post.txt"), ["40-archive/capture/post.txt"]);
    assert.equal(idx.resolves("post"), false);
    assert.deepEqual(idx.matches("diagram.png"), ["docs/diagram.png"]);
    assert.equal(idx.resolves("hidden"), false, "dot-directories aren't indexed");
    assert.equal(idx.resolves("readme"), true, "node_modules stems count as taken");
    assert.deepEqual(idx.matches("node.js"), ["10-projects/node.js.md"]);
    assert.equal(idx.stemPaths("linked-dir").length, 0);
  } finally { v.done(); }
});

test("uniqueStem and uniqueFileName pick the first free name, excluding the item itself", () => {
  const v = tempVault({
    "30-resources/designing-agentic-workflows.md": "x",
    "30-resources/designing-agentic-workflows-2.md": "x",
    "00-inbox/capture/post.md": "x",
    "40-archive/capture/note.txt": "x",
  });
  try {
    const idx = VaultIndex.build(v.root);
    assert.equal(idx.uniqueStem("designing-agentic-workflows"), "designing-agentic-workflows-3");
    assert.equal(idx.uniqueStem("fresh"), "fresh");
    assert.equal(idx.uniqueStem("post"), "post-2");
    assert.equal(idx.uniqueStem("post", ["00-inbox/capture/post.md"]), "post");
    assert.equal(idx.uniqueFileName("note", "txt"), "note-2.txt");
    assert.equal(idx.uniqueFileName("post", "md", ["00-inbox/capture/post.md"]), "post.md");
    idx.add("30-resources/fresh.md");
    assert.equal(idx.uniqueStem("fresh"), "fresh-2");
    idx.remove("30-resources/fresh.md");
    assert.equal(idx.uniqueStem("fresh"), "fresh");
  } finally { v.done(); }
});

test("frontmatter: split, parse errors, 8 KB cap, one-key-at-a-time rendering", async () => {
  assert.deepEqual(splitFrontmatter("---\na: 1\n---\nbody\n"), { yaml: "a: 1\n", body: "body\n" });
  assert.deepEqual(splitFrontmatter("no fm"), { yaml: null, body: "no fm" });
  assert.deepEqual(splitFrontmatter("---\r\na: 1\r\n---\r\nbody"), { yaml: "a: 1\r\n", body: "body" });
  assert.ok(parseFrontmatter("a: [unclosed").error);
  assert.equal(parseFrontmatter("- list").error, "frontmatter is not a mapping");
  const out = renderFrontmatter([["name", "x"], ["description", "Capture a.md needs a home: no area fitted"], ["created", "2026-10-01"]]);
  assert.equal(out, '---\nname: x\ndescription: "Capture a.md needs a home: no area fitted"\ncreated: 2026-10-01\n---\n');
  assert.equal((parseFrontmatter(splitFrontmatter(out).yaml).data ?? {})["description"], "Capture a.md needs a home: no area fitted");
  const v = tempVault({ "big.md": `---\ndescription: x\npad: ${"y".repeat(9000)}\n---\n`, "ok.md": note("ok", "fine") });
  try {
    assert.match((await readFrontmatter(path.join(v.root, "big.md"))).error ?? "", /no closing ---/);
    assert.equal((await readFrontmatter(path.join(v.root, "ok.md"))).data?.["description"], "fine");
  } finally { v.done(); }
});

test("target index: lists area and project notes, keeps unparseable ones, leaves out ambiguous stems", async () => {
  const v = tempVault({
    "20-areas/README.md": "readme",
    "20-areas/career.md": note("career", "Work and   career growth"),
    "20-areas/health.md": "---\ndescription: [broken\n---\n",
    "20-areas/recreation.md": note("recreation", "Hobbies"),
    "30-resources/recreation.md": "same stem elsewhere",
    "10-projects/side-project.md": note("side-project", "A side project"),
    "10-projects/sub/nested.md": note("nested", "not direct"),
  });
  try {
    const idx = await FlatTargetIndex.load(v.root, VaultIndex.build(v.root));
    assert.deepEqual(idx.targets().map((t) => [t.slug, t.kind, t.relPath, t.description]), [
      ["career", "area", "20-areas/career.md", "Work and career growth"],
      ["health", "area", "20-areas/health.md", ""],
      ["side-project", "project", "10-projects/side-project.md", "A side project"],
    ]);
    assert.equal(idx.excluded, 1);
    assert.equal(idx.warnings.length, 2);
    assert.equal(idx.bySlug("CAREER")?.relPath, "20-areas/career.md");
    const scope = idx.readScope();
    assert.equal(scope.root, v.root);
    assert.deepEqual(scope.excluded, ["control", ".state", "node_modules"].map((d) => path.join(v.root, d)));
  } finally { v.done(); }
});

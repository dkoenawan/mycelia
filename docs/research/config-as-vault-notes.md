# Research: config as vault-note frontmatter (the Directus-inspired proposal)

**Status: research, not a decision.** This does not choose an approach — see
`docs/adr/0000-adr-process.md` for how a decision gets recorded once the operator has
reviewed this. Tracked in [issue #1](https://github.com/dkoenawan/mycelia/issues/1).

## The question

Directus (a headless CMS) creates its own config tables inside whatever SQL database you
point it at on install — its config lives *inside* the same storage substrate the app
manages, not in separate files next to it. Mapped onto mycelia: instead of
`control/estate.local.yaml` as a standalone YAML file, could the job registry become a
vault note (e.g. `20-areas/estate.md`) whose YAML frontmatter holds the same fields,
parsed by scripts instead of a plain YAML file — the vault playing the role Postgres/
MySQL plays for Directus?

The risk this raises that plain config files don't have: frontmatter is meant to be
human-readable and human-*editable* directly in Obsidian, unlike Directus's opaque SQL
tables nobody hand-edits in a GUI. A person casually fixing a typo in Obsidian could
corrupt frontmatter a script depends on to parse correctly.

**Headline finding: this risk is not hypothetical.** Obsidian's own lead developer has
confirmed, in-thread, that the Properties UI rewrites frontmatter on every edit — by
design, won't-fix. This is a materially different situation from the other two research
briefs in this series: those compared tools with genuine tradeoffs; this one surfaces a
documented, maintainer-acknowledged behavior that directly defeats the proposal as
originally framed.

## Finding 1 — Obsidian's Properties UI rewrites frontmatter by design, not by bug

Confirmed directly from Obsidian's own forum, with the lead developer (Licat) responding
in-thread: [YAML & Properties & API: processFrontMatter removes/alters string quotes,
comments, types, formatting](https://forum.obsidian.md/t/yaml-properties-api-processfrontmatter-removes-alters-string-quotes-comments-types-formatting/65851).

Obsidian's internal API for writing frontmatter (`processFrontMatter` / `Vault.process`,
used by both the core Properties UI and any plugin that edits frontmatter
programmatically) **does not preserve the existing YAML block** — it re-serializes the
whole thing from its own in-memory model on every write. Documented, reproduced symptoms:

- Comments in the frontmatter block are deleted outright.
- Quote style is normalized (changes which strings get quoted and how).
- Explicit YAML type tags (`!!str`, `!!timestamp`) are stripped.
- Inline (flow-style) arrays get rewritten to block style, or vice versa.
- Timestamps get reformatted to Obsidian's canonical form.
- A second thread ([Make New Properties Feature NOT Re-Format
  Frontmatter](https://forum.obsidian.md/t/make-new-properties-feature-not-re-format-frontmatter/66297))
  shows this isn't limited to the field being edited — inserting a template or touching
  one property can reformat the entire block.

Licat's response in-thread: this is *"an intentional design decision to simplify the
programmatic handling of YAML for ourselves (properties, bases) and for plugins,"* not a
defect, with no plan to change it — characterized as affecting "a very small minority of
people." Official docs ([obsidian.md/help/Editing+and+formatting/Properties](https://obsidian.md/help/Editing+and+formatting/Properties))
describe seven typed property kinds with fixed serialization, consistent with the forum
reports, but don't warn about formatting loss.

**Why this matters for mycelia specifically:** "a person casually fixing a typo in
Obsidian" is not a tail risk to guard against — it is the documented default behavior of
the exact GUI anyone with vault access would use. Any edit to *any* field in a note's
Properties panel is licensed to rewrite fields a script depends on, on the same save. A
plain YAML file opened in a text editor has no equivalent hazard: nothing rewrites
untouched lines just because one line changed.

## Finding 2 — real plugins split into two patterns; the safer one avoids frontmatter as the sole store

- **Obsidian Kanban** ([mgmeyers/obsidian-kanban](https://community.obsidian.md/plugins/kanban)):
  closest real analog to mycelia's exact proposal — *"The board reads and writes your
  notes' frontmatter, and nothing else."* Fully owns frontmatter+body as its state store.
  Accepts the corruption risk as a tradeoff for transparency/portability, mitigated
  structurally by not inviting arbitrary unrelated human fields into the same document.
- **Spaced Repetition plugin** ([data storage docs](https://stephenmwangi.com/obsidian-spaced-repetition/data-storage/)):
  stores scheduling state (`sr-due`, `sr-interval`, `sr-ease`) directly in frontmatter as
  authoritative fields — genuinely load-bearing machine state in ordinary notes, the
  closest thing to mycelia's proposal found in the wild. Notably, finer-grained per-card
  state is encoded in inline HTML comments instead, plausibly because it's even less safe
  to expose to casual editing than frontmatter.
- **Metadata Menu** ([fileClass docs](https://mdelobelle.github.io/metadatamenu/fileclasses/)):
  a note declares `fileClass: music` in frontmatter and the plugin applies an associated
  field schema — closer to "note-type contract" than raw machine config; the closest
  found prior art for a validated note type (see Finding 4).
- **Dataview**: the safer pattern by contrast — treats frontmatter as data to *index and
  query*, not as its own config store. Nothing in its docs frames frontmatter as
  authoritative for the plugin's own operation.
- **Templater**: keeps its own config in the plugin's settings/`data.json` entirely.
  [`SilentVoid13/Templater#1387`](https://github.com/SilentVoid13/Templater/issues/1387)
  shows `tp.frontmatter["key"]` access documented as unreliable — further evidence that
  even plugin authors don't trust round-tripping frontmatter as structured state.

None of the above plugins document graceful degradation on malformed frontmatter — the
silence is informative: the ecosystem hasn't solved "what happens when a human breaks the
machine's part of the frontmatter," it mostly doesn't discuss the failure mode.

## Finding 3 — static site generators keep global config out of content frontmatter, with no counterexample found

Confirmed via [Jekyll's docs](https://jekyllrb.com/docs/configuration/) and
[Hugo's docs](https://gohugo.io/configuration/introduction/): both exclusively read
site-wide config from a dedicated root file (`_config.yml` / `hugo.toml`), never from a
content page's frontmatter, which stays strictly page-scoped. No SSG was found putting
global app config into a content page's frontmatter.

This is the cleanest precedent *against* the proposal: the tools structurally closest to
mycelia's content model (Markdown + frontmatter) treat "config governing the whole
system" and "metadata on one piece of content" as different enough in kind that no
mainstream tool merges them, even after decades of iteration optimizing for developer
convenience.

## Finding 4 — Foam and Dendron: closer cousins, with prior art that doesn't fully transfer

- **Foam**: workspace config lives in `.vscode/foam.json` / `.vscode/settings.json`. No
  confirmed pattern of reading tool config from a note's frontmatter.
- **Dendron** has two mechanisms, and research corrected an initial assumption — its
  "Schemas" are *not* a frontmatter contract:
  - **Schemas** (`{name}.schema.yml`) match notes by hierarchical *name* patterns, mainly
    to auto-apply templates and drive autocomplete. They don't validate frontmatter shape.
    ([wiki.dendron.so — Schemas](https://wiki.dendron.so/notes/c5e5adde-5459-409b-b34d-a0d75cbb1052/))
  - **The Type System** is the actually-relevant prior art: a `type` field in a note's own
    frontmatter meant to guarantee structural properties (required fields, templates,
    rendering) once set. Caveat: found as an RFC/proposal document, not confirmed-shipped
    stable behavior — weaker-confidence, worth re-checking if it becomes decision-relevant.
  - Dendron's own global tool config lives in `dendron.yml`, a dedicated file — Dendron
    doesn't eat its own dog food for its own app config, only for per-note behavioral
    contracts. Reinforces Finding 3's pattern.

## Finding 5 — no established machine-owned vs. human-owned key naming convention exists

Searched specifically for a documented pattern of namespaced/prefixed frontmatter keys
protecting machine-owned fields from incidental edits to unrelated fields in the same
note. **Not found** — no plugin README, wiki page, or forum post states this as a
deliberate convention. Closest adjacent evidence: Metadata Menu's `fileClass` names a
schema rather than namespacing every machine field; Kanban avoids the collision problem
structurally by owning the whole note rather than namespacing; and
[`YishenTu/claudian#842`](https://github.com/YishenTu/claudian/issues/842) (a request to
move plugin state *out* of note content into `.obsidian/`) is tangential evidence that
even plugin authors default to keeping machine state out of note content when they can.

If mycelia adopts any version of frontmatter-as-config, this namespacing mechanism would
need to be designed from scratch, not adopted from precedent.

## Summary table

| Question | Confirmed? | Precedent found | Closest analog |
|---|---|---|---|
| Does Obsidian's own GUI corrupt/reformat frontmatter on edit | **Yes — confirmed by Obsidian's lead developer, stated as intentional and won't-fix** | None; no mitigation shipped by Obsidian itself | forum thread [#65851](https://forum.obsidian.md/t/yaml-properties-api-processfrontmatter-removes-alters-string-quotes-comments-types-formatting/65851) |
| Do real plugins treat frontmatter as authoritative machine config | Yes, at least two (Kanban, Spaced Repetition) | Partial — no validation-on-load or graceful-degradation pattern documented | Kanban plugin |
| Do SSGs (Jekyll/Hugo) ever put global config in content frontmatter | **No — confirmed absent, no counterexample found** | N/A — universal separation | Jekyll `_config.yml`, Hugo `hugo.toml` |
| Is there prior art for a schema-validated, machine-parsed note type | Partial — shipped for Metadata Menu (`fileClass`), RFC-level for Dendron (Type System) | Yes, but neither guards against GUI-driven reformatting, only against wrong content | Metadata Menu, Dendron Type System (RFC) |
| Is there a namespaced machine-vs-human key convention | **Not found — open gap** | None | — |

## Initial recommendation (superseded below — see "Correction")

**Do not move `control/estate.local.yaml`'s full schema into a vault note's frontmatter
as designed.** The one property that matters most for a job registry — a script can
trust the file's shape didn't change since the last commit unless something touched
*that specific field* — is exactly what Obsidian's own Properties UI does not guarantee,
by the maintainers' own admission, with no plan to fix it. This isn't a corruption risk
mycelia would be introducing hypothetically; it's a live, acknowledged behavior in the
tool the vault is built around.

A follow-up research pass (below) found this risk is narrower than it first appeared —
scoped to one specific write path, not to YAML or frontmatter generally — which changes
the recommendation. Kept here rather than deleted so the reasoning trail is visible.

## Correction — the risk is narrower than Finding 1 first suggested

A follow-up research pass, prompted by the operator asking how Claude/agentic workflows
actually integrate with Obsidian in practice, sharpened Finding 1 considerably:

- **The corruption is scoped to one specific code path**, not "Obsidian touches YAML" in
  general. It fires only when a write happens through `processFrontMatter`/`Vault.process`
  — i.e. the Properties panel UI, or a plugin explicitly calling that API. It converts
  YAML to a JS object via `js-yaml` (which has no round-trip mode) and loses
  comments/formatting/quote style on *that save*. Confirmed directly from the same forum
  thread: Licat's own advice to anyone who cares about YAML fidelity is *"avoid having
  Obsidian touch the YAML altogether"* — i.e. avoid that specific API, not avoid YAML.
- **Opening, viewing, or indexing a note never rewrites it.** Obsidian's `MetadataCache`
  (which powers Graph view, backlinks, etc.) is confirmed read-only — it updates *from*
  file changes, it does not write *to* files.
- **A script writing hand-crafted YAML directly to the file** (via `vault.modify()` or
  plain filesystem writes, bypassing `processFrontMatter` entirely) never touches the
  lossy path at all. This is confirmed as the actual convention used by the dominant
  real-world Obsidian integration, `coddingtonbear/obsidian-local-rest-api`: its
  frontmatter PATCH operation does not call `processFrontMatter` anywhere in its source —
  it uses the `markdown-patch` library, backed by the round-trip-preserving `yaml` npm
  package (not Obsidian core's lossy `js-yaml`), and writes via `app.vault.modify()`.
- **This matches how real "AI second brain" workflows are actually built**: multiple
  independent write-ups of Claude Code + Obsidian workflows describe the same pattern —
  the agent owns a consistent frontmatter schema and writes/rewrites notes wholesale as
  plain text; the human is expected to consume them in reading view, not hand-edit the
  same fields via Properties. There is no official Anthropic↔Obsidian integration at all
  — every real integration (Local REST API, community MCP servers, or Claude Code
  operating on files directly) works by writing files on disk, with Obsidian's app layer
  either uninvolved or deliberately routed around its lossy API.
- **Separately confirmed: a standalone `.yaml` file needs none of this reasoning at
  all.** `.yaml`/`.yml` is not in Obsidian's list of recognized formats — it shows up in
  the file explorer but cannot be opened, previewed, or indexed by Obsidian, and no
  plugin touches non-registered extensions by default. `control/estate.local.yaml` can
  keep existing exactly as it is, inside the same vault folder, permanently inert to
  Obsidian. There is no separate "installation step" needed to put config in the vault —
  the whole mycelia clone already *is* a vault the moment Obsidian is pointed at it.

## Recommendation (revised)

The risk in Finding 1 is real but narrow: **a human editing agent-owned frontmatter
through Obsidian's Properties panel**, not writing YAML in general and not scripts
writing files directly. Revised recommendation, in order of preference:

1. **Do nothing new — keep `control/estate.local.yaml` as a plain `.yaml` file.** This
   already satisfies "config lives inside the substrate it configures," since the vault
   *is* the whole clone, including `control/`. Zero risk, zero new mechanism, confirmed
   inert to Obsidian.
2. **If richer vault-native config/dashboard notes are still wanted**, frontmatter
   written *only* by scripts (never through `processFrontMatter`/Properties) is now
   confirmed safe in practice — matching the dominant real-world integration pattern.
   The discipline required: keep those specific fields out of anything the operator is
   expected to touch via Obsidian's UI, exactly as `control/*.local.yaml` is already
   treated as script-owned rather than vault-prose. A load-time schema validation gate
   (reject and refuse to run on malformed input) is still worth keeping as defense in
   depth, since nothing stops a future plugin or the operator from opening the Properties
   panel on that note anyway.
3. The original two narrower variants (read-through mirror; dedicated schema-validated
   note type) remain valid fallback designs if option 2 is pursued, but are no longer
   necessary purely to avoid corruption — they're about UX/dashboarding value-add, not
   safety.

This is a recommendation for the operator to confirm or override, not yet a decision —
once decided, fold the outcome into `docs/adr/0002-framework-instance-separation.md`
alongside the chezmoi/Terraform findings from
`docs/research/framework-instance-separation.md`.

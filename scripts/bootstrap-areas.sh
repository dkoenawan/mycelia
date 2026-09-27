#!/usr/bin/env bash
# bootstrap-areas.sh — create one 20-areas/<slug>.md note per entry in
# control/areas.local.yaml.
#
# Create-only: a note that already exists is skipped, never opened for writing,
# so re-running after editing the manifest is always safe. Renaming or removing
# an entry does not rename or delete its note — do that by hand.
#
# If control/areas.local.yaml is absent it is first seeded from
# control/areas.example.yaml (same copy-if-absent path install.sh uses). Notes are
# only ever generated from the local manifest. The whole manifest is validated
# before anything is written; a bad entry stops the run with no file created.
#
# Requires python3 with PyYAML. Never stages, commits, or checks out anything.
#
# Usage: ./scripts/bootstrap-areas.sh   (takes no arguments)
# Also invoked as `task bootstrap-areas` — see Taskfile.yml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

AREAS_EXAMPLE="$MYCELIA_CONTROL/areas.example.yaml"
AREAS_LOCAL="$MYCELIA_CONTROL/areas.local.yaml"
AREAS_DIR="$MYCELIA_ROOT/20-areas"

# Validator + note generator. One embedded block so the note template lives in
# exactly one place (ADR-0005 "New constraints").
#   python3 - --check <manifest>
#   python3 - --write <manifest> <YYYY-MM-DD> <areas-dir>
# Exit 0 on success, 1 on any validation or write error (nothing written on a
# validation error). Per-slug report on stdout; errors and warnings on stderr.
run_generator() {
  python3 - "$@" <<'PYEOF'
import datetime
import os
import re
import sys

import yaml

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
ENTRY_KEYS = {"slug", "description"}


def err(msg):
    print(f"ERROR: {msg}", file=sys.stderr)


def validate(path, shown):
    """Return the list of entries, or None after printing every problem found."""
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        err(f"{shown} cannot be read: {exc.strerror}")
        return None
    try:
        # Parsed from a string, not the file handle, so PyYAML's message carries
        # no absolute path; the location is reported relative to the file.
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        where = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
        problem = getattr(exc, "problem", None) or str(exc)
        err(f"{shown} does not parse as YAML{where}: {problem}")
        return None

    if not isinstance(data, dict):
        err(f"{shown}: top level must be a mapping with a single 'areas' key")
        return None
    problems = 0
    extra = sorted(str(k) for k in data if k != "areas")
    if extra:
        err(f"{shown}: unknown top-level key(s): {', '.join(extra)} (only 'areas' is allowed)")
        problems += 1
    if "areas" not in data:
        err(f"{shown}: missing top-level 'areas' key")
        return None
    areas = data["areas"]
    if not isinstance(areas, list):
        err(f"{shown}: 'areas' must be a list of entries")
        return None

    seen = {}
    for i, entry in enumerate(areas, start=1):
        if not isinstance(entry, dict):
            err(f"{shown} entry {i}: must be a mapping with 'slug' and 'description'")
            problems += 1
            continue
        slug = entry.get("slug")
        label = f"{shown} entry {i}" + (f" (slug {slug!r})" if "slug" in entry else "")
        unknown = sorted(str(k) for k in entry if k not in ENTRY_KEYS)
        for key in unknown:
            err(f"{label}: unknown key {key!r} (only 'slug' and 'description' are allowed)")
            problems += 1
        if "slug" not in entry or slug is None:
            err(f"{label}: missing slug")
            problems += 1
        elif not isinstance(slug, str):
            err(f"{label}: slug must be a string — quote it, e.g. slug: \"{slug}\"")
            problems += 1
        elif not SLUG_RE.match(slug):
            err(f"{label}: slug is not kebab-case ({SLUG_RE.pattern})")
            problems += 1
        elif slug in seen:
            err(f"{label}: slug repeats entry {seen[slug]}")
            problems += 1
        else:
            seen[slug] = i
        desc = entry.get("description")
        if "description" not in entry or desc is None:
            err(f"{label}: missing description")
            problems += 1
        elif not isinstance(desc, str):
            err(f"{label}: description must be a string — quote it")
            problems += 1
        elif not desc.strip():
            err(f"{label}: description is empty")
            problems += 1
        elif "\n" in desc or "\r" in desc:
            err(f"{label}: description must be a single line")
            problems += 1
    return None if problems else areas


def frontmatter_line(key, value):
    # safe_dump quotes only what needs quoting, so parsing the note back yields the
    # exact manifest string; width=inf keeps every value on one line; date objects
    # are emitted as bare YYYY-MM-DD.
    return yaml.safe_dump(
        {key: value}, allow_unicode=True, width=float("inf"), default_flow_style=False
    )


def render(slug, description, day):
    return (
        "---\n"
        + frontmatter_line("name", slug)
        + frontmatter_line("description", description)
        + frontmatter_line("type", "area")
        + frontmatter_line("created", day)
        + frontmatter_line("updated", day)
        + "---\n"
        + "\n"
        + "Projects that serve this area — link each one here as a wikilink, e.g. `[[project-slug]]`,\n"
        + f"and link back to this area from the project note with [[{slug}]]:\n"
        + "\n"
        + "-\n"
        + "\n"
        + "Resources with reusable patterns for this area — link each `30-resources/` note, e.g.\n"
        + "`[[resource-slug]]`:\n"
        + "\n"
        + "-\n"
    )


def main(argv):
    if len(argv) < 2 or argv[0] not in ("--check", "--write"):
        err("generator usage: --check <manifest> | --write <manifest> <date> <areas-dir>")
        return 1
    mode, manifest = argv[0], argv[1]
    shown = "control/" + os.path.basename(manifest)
    areas = validate(manifest, shown)
    if areas is None:
        return 1
    if mode == "--check":
        return 0

    if len(argv) != 4:
        err("generator usage: --write <manifest> <date> <areas-dir>")
        return 1
    day = datetime.date.fromisoformat(argv[2])
    areas_dir = argv[3]
    shown_dir = os.path.basename(os.path.normpath(areas_dir))
    if not areas:
        print(f"WARN: {shown} lists no areas — nothing to create.", file=sys.stderr)

    os.makedirs(areas_dir, exist_ok=True)
    created = skipped = 0
    for entry in areas:
        slug = entry["slug"]
        path = os.path.join(areas_dir, f"{slug}.md")
        shown_path = f"{shown_dir}/{slug}.md"
        try:
            fh = open(path, "x", encoding="utf-8")
        except FileExistsError:
            print(f"skipped  {shown_path} (already exists)")
            skipped += 1
            continue
        try:
            with fh:
                fh.write(render(slug, entry["description"], day))
        except BaseException:
            # This run created the file moments ago, so it owns it: remove the
            # partial note so a re-run retries it instead of skipping it.
            os.remove(path)
            raise
        print(f"created  {shown_path}")
        created += 1

    print(f"Areas bootstrap: {created} created, {skipped} skipped (from {shown}).")
    return 0


sys.exit(main(sys.argv[1:]))
PYEOF
}

# 1. Arguments.
[[ $# -eq 0 ]] || die "usage: bootstrap-areas.sh (takes no arguments)"

# 2. The example must exist even when a local manifest does: without it this is
#    not a complete checkout.
[[ -f "$AREAS_EXAMPLE" ]] \
  || die "control/areas.example.yaml not found — is this a complete mycelia checkout?"

# 3. Dependencies, before anything is created.
command -v python3 &>/dev/null \
  || die "python3 not found on PATH — bootstrap-areas needs python3 with PyYAML."
python3 -c 'import yaml' &>/dev/null \
  || die "python3 found but PyYAML is not installed — install it (pip install pyyaml, or your OS package, e.g. python3-yaml) and re-run."

# 4. Defence in depth: everything this script writes must be gitignored. Catches a
#    future .gitignore regression before a file git would track is written.
#    Skipped outside a git work tree, where nothing can be tracked.
if git -C "$MYCELIA_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
  for probe in control/areas.local.yaml 20-areas/bootstrap-probe.md; do
    git -C "$MYCELIA_ROOT" check-ignore -q "$probe" \
      || die "$probe is not gitignored — refusing to write files git would track. Check .gitignore."
  done
fi

# 5. Validate whatever the notes will come from before writing anything, so a bad
#    example can't leave a seeded local file behind.
if [[ -f "$AREAS_LOCAL" ]]; then SOURCE="$AREAS_LOCAL"; else SOURCE="$AREAS_EXAMPLE"; fi
if ! run_generator --check "$SOURCE"; then
  die "control/$(basename "$SOURCE") is invalid — no notes written."
fi

# 6. Seed the local manifest if absent (no-op with a "left untouched" message otherwise).
seed_local "$AREAS_EXAMPLE" "$AREAS_LOCAL"

# 7. Generate, always from the local manifest. Re-validates, which covers the file
#    changing since step 5.
if ! run_generator --write "$AREAS_LOCAL" "$(date -u '+%Y-%m-%d')" "$AREAS_DIR"; then
  die "areas bootstrap failed — see errors above."
fi

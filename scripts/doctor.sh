#!/usr/bin/env bash
# doctor.sh — verifies a mycelia install is actually usable.
#
# Runs every check regardless of earlier failures and reports pass/fail per check,
# then exits 0 only if all checks passed. This is the gate referenced throughout
# CLAUDE.md ("autonomy is licensed by gates") applied to the install itself: a
# fresh clone counts as installed once this exits 0, not once someone believes the
# README was followed correctly.
#
# Usage: ./scripts/doctor.sh
# Also invoked as `task doctor` — see Taskfile.yml.

set -uo pipefail  # deliberately not -e: doctor must keep checking after a failure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

FAILURES=0
CHECKS=0

pass() { CHECKS=$((CHECKS + 1)); echo "  [ok]   $*"; }
fail() { CHECKS=$((CHECKS + 1)); FAILURES=$((FAILURES + 1)); echo "  [FAIL] $*"; }
note() { echo "         $*"; }

echo "mycelia doctor — $MYCELIA_ROOT"
echo ""

# --- 1. Local config files exist -----------------------------------------

ROOTS="$MYCELIA_CONTROL/roots.local.yaml"
ESTATE="$MYCELIA_CONTROL/estate.local.yaml"

if [[ -f "$ROOTS" ]]; then
  pass "control/roots.local.yaml exists"
else
  fail "control/roots.local.yaml missing — run 'task install' (or ./scripts/install.sh) first"
fi

if [[ -f "$ESTATE" ]]; then
  pass "control/estate.local.yaml exists"
else
  fail "control/estate.local.yaml missing — run 'task install' (or ./scripts/install.sh) first"
fi

# Nothing further can run meaningfully without both local files.
if [[ ! -f "$ROOTS" || ! -f "$ESTATE" ]]; then
  echo ""
  echo "$FAILURES/$CHECKS checks failed. Fix the above, then re-run."
  exit 1
fi

# --- 2. Local YAML parses -------------------------------------------------
# Uses python3+PyYAML if available (best validation); falls back to a plain
# structural sanity check otherwise so doctor.sh has no hard new dependency.

yaml_parses() {
  local file="$1"
  if command -v python3 &>/dev/null && python3 -c "import yaml" &>/dev/null; then
    python3 -c "import yaml, sys; yaml.safe_load(open(sys.argv[1]))" "$file" 2>/dev/null
  else
    # Fallback: reject obvious tab-indentation (the most common hand-edit break).
    ! grep -qP '^\t' "$file" 2>/dev/null
  fi
}

if yaml_parses "$ROOTS"; then
  pass "control/roots.local.yaml parses as YAML"
else
  fail "control/roots.local.yaml does not parse as valid YAML"
fi

if yaml_parses "$ESTATE"; then
  pass "control/estate.local.yaml parses as YAML"
else
  fail "control/estate.local.yaml does not parse as valid YAML"
fi

# --- 3. Schema version check (ADR-0002: version becomes load-bearing) ----

read_version() {
  grep -m1 -E '^version:' "$1" 2>/dev/null | sed -E 's/^version:[[:space:]]*//' | tr -d '"'"'"' '
}

EXAMPLE_VERSION="$(read_version "$MYCELIA_CONTROL/estate.example.yaml")"
LOCAL_VERSION="$(read_version "$ESTATE")"

if [[ -z "$LOCAL_VERSION" ]]; then
  fail "control/estate.local.yaml has no 'version:' field"
elif [[ "$LOCAL_VERSION" == "$EXAMPLE_VERSION" ]]; then
  pass "estate.local.yaml version ($LOCAL_VERSION) matches current framework version"
else
  fail "estate.local.yaml version ($LOCAL_VERSION) is behind framework version ($EXAMPLE_VERSION)"
  UPGRADE_DOC="$MYCELIA_CONTROL/UPGRADE-${EXAMPLE_VERSION}.md"
  if [[ -f "$UPGRADE_DOC" ]]; then
    note "See control/UPGRADE-${EXAMPLE_VERSION}.md for what changed and how to update your local files."
  else
    note "control/UPGRADE-${EXAMPLE_VERSION}.md does not exist yet — this is a framework defect, not"
    note "something you can fix locally. Report it, or diff control/estate.example.yaml against your"
    note "estate.local.yaml by hand in the meantime."
  fi
fi

# --- 4. roots.local.yaml aliases resolve to real directories --------------

if [[ -f "$ROOTS" ]]; then
  HOME_ROOT="$(grep -m1 -E '^home:' "$ROOTS" | sed -E 's/^home:[[:space:]]*//')"
  REPOS_ROOT="$(grep -m1 -E '^repos:' "$ROOTS" | sed -E 's/^repos:[[:space:]]*//')"
  LOGS_ROOT="$(grep -m1 -E '^logs:' "$ROOTS" | sed -E 's/^logs:[[:space:]]*//')"

  for pair in "home:$HOME_ROOT" "repos:$REPOS_ROOT" "logs:$LOGS_ROOT"; do
    key="${pair%%:*}" path="${pair#*:}"
    if [[ -z "$path" || "$path" == "/path/to/"* ]]; then
      fail "roots.local.yaml '$key' is unset or still the placeholder value"
    elif [[ -d "$path" ]]; then
      pass "roots.local.yaml '$key' -> $path (exists)"
    else
      fail "roots.local.yaml '$key' -> $path (directory does not exist)"
    fi
  done
fi

# --- 5. claude binary resolves (needed by any job that invokes it) -------

if resolve_claude &>/dev/null; then
  pass "claude binary resolves ($(resolve_claude))"
else
  fail "claude binary not found on PATH, \$CLAUDE_BIN, ~/.local/bin, or /usr/local/bin"
fi

# --- 6. task binary present (ADR-0001) ------------------------------------

if command -v task &>/dev/null; then
  pass "task (go-task) resolves ($(task --version 2>&1 | head -1))"
else
  fail "task (go-task) not found on PATH — required per ADR-0001"
fi

# --- 7. estate.local.yaml jobs: commits:false without a note is a defect -

if [[ -f "$ESTATE" ]] && command -v python3 &>/dev/null && python3 -c "import yaml" &>/dev/null; then
  DEFECT_JOBS="$(python3 - "$ESTATE" <<'PYEOF'
import sys, yaml
with open(sys.argv[1]) as f:
    data = yaml.safe_load(f) or {}
bad = []
for job in data.get("jobs", []) or []:
    if job.get("commits") is False and not job.get("note"):
        bad.append(job.get("id", "<unnamed>"))
print(",".join(bad))
PYEOF
)"
  if [[ -z "$DEFECT_JOBS" ]]; then
    pass "no job has commits:false without an explanatory note"
  else
    fail "job(s) with commits:false and no note (known defect pattern): $DEFECT_JOBS"
  fi
else
  note "skipped commits:false check — needs python3+PyYAML (optional, not a hard dependency)"
fi

# --- 8. framework self-check: every version bump shipped its UPGRADE doc -
# ADR-0002 commits to "any schema-breaking change bumps version: and ships
# control/UPGRADE-<N>.md in the same change." This is currently enforced only
# by that sentence of prose. Catch the gap mechanically: every version from 2
# up to the framework's current version must have a matching upgrade doc.

if [[ "$EXAMPLE_VERSION" =~ ^[0-9]+$ ]] && [[ "$EXAMPLE_VERSION" -gt 1 ]]; then
  MISSING_UPGRADE_DOCS=""
  for ((v = 2; v <= EXAMPLE_VERSION; v++)); do
    [[ -f "$MYCELIA_CONTROL/UPGRADE-${v}.md" ]] || MISSING_UPGRADE_DOCS+="${MISSING_UPGRADE_DOCS:+,}$v"
  done
  if [[ -z "$MISSING_UPGRADE_DOCS" ]]; then
    pass "every schema version bump (2..$EXAMPLE_VERSION) has a matching control/UPGRADE-N.md"
  else
    fail "schema version(s) missing control/UPGRADE-N.md: $MISSING_UPGRADE_DOCS (ADR-0002 violation)"
  fi
else
  pass "framework still at version 1 — no UPGRADE docs required yet"
fi

echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo "$CHECKS/$CHECKS checks passed. Install looks healthy."
  exit 0
else
  echo "$FAILURES/$CHECKS checks failed."
  exit 1
fi

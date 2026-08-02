#!/usr/bin/env bash
# common.sh — shared helpers for mycelia runners.
#
# Source, do not execute:
#   source "$(dirname "$(realpath "$0")")/lib/common.sh"
#
# Every helper here encodes a failure mode that recurs in unattended agent work.
# See CLAUDE.md "Writing runners" for the rationale behind each.

# --- Paths ---------------------------------------------------------------

MYCELIA_ROOT="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/../.." && pwd)"
MYCELIA_CONTROL="$MYCELIA_ROOT/control"
MYCELIA_ESTATE="$MYCELIA_CONTROL/estate.yaml"
MYCELIA_DAILY="$MYCELIA_ROOT/daily"
MYCELIA_INBOX="$MYCELIA_ROOT/00-inbox"
MYCELIA_LOGS="$MYCELIA_ROOT/logs"

export MYCELIA_ROOT MYCELIA_CONTROL MYCELIA_ESTATE MYCELIA_DAILY MYCELIA_INBOX MYCELIA_LOGS

# --- Logging -------------------------------------------------------------
# Writes to stderr so a runner's stdout stays clean for real output.
# Never pipe these through `tee` into a file the scheduler already redirects to;
# every line gets written twice.

log()  { echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $*" >&2; }
warn() { log "WARN: $*"; }
die()  { log "ERROR: $*"; exit 1; }

# --- Environment ---------------------------------------------------------

# Resolve the claude binary. Cron does not source a shell profile, so ~/.local/bin
# is frequently absent from PATH. The crontab currently sets PATH explicitly, but
# runners must not depend on that remaining true.
resolve_claude() {
  if [[ -n "${CLAUDE_BIN:-}" && -x "${CLAUDE_BIN}" ]]; then
    echo "$CLAUDE_BIN"; return 0
  fi
  local candidate
  candidate="$(command -v claude 2>/dev/null || true)"
  [[ -n "$candidate" ]] && { echo "$candidate"; return 0; }
  for candidate in "$HOME/.local/bin/claude" /usr/local/bin/claude; do
    [[ -x "$candidate" ]] && { echo "$candidate"; return 0; }
  done
  return 1
}

require_cmd() {
  command -v "$1" &>/dev/null || die "'$1' not found on PATH."
}

# --- Git safety ----------------------------------------------------------
# These encode the most costly failure in unattended agent work: an agent that edits
# files and exits without committing. Its work is destroyed by the next branch
# checkout, silently, while its logs still read as success.

git_current_branch() {
  git -C "$1" rev-parse --abbrev-ref HEAD 2>/dev/null
}

git_is_clean() {
  [[ -z "$(git -C "$1" status --porcelain 2>/dev/null)" ]]
}

# Age in hours of the oldest uncommitted change. Empty if the tree is clean.
# Detects agent work that was produced but never committed.
git_uncommitted_age_hours() {
  local repo="$1" oldest now
  git_is_clean "$repo" && return 0
  oldest="$(git -C "$repo" status --porcelain | awk '{print $NF}' | while read -r f; do
    [[ -e "$repo/$f" ]] && stat -c %Y "$repo/$f" 2>/dev/null
  done | sort -n | head -1)"
  [[ -z "$oldest" ]] && return 0
  now="$(date +%s)"
  echo $(( (now - oldest) / 3600 ))
}

# Check out a dedicated working branch, remembering the branch to return to.
# Pairs with git_restore_branch. Lets a scheduled job commit safely in a repo the
# operator is also working in, without colliding with their checkout.
git_enter_work_branch() {
  local repo="$1" branch="$2"
  MYCELIA_ORIGINAL_BRANCH="$(git_current_branch "$repo")"
  export MYCELIA_ORIGINAL_BRANCH
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$repo" checkout "$branch" >/dev/null 2>&1 || return 1
  else
    git -C "$repo" checkout -b "$branch" >/dev/null 2>&1 || return 1
  fi
  log "On work branch '$branch' (will restore '$MYCELIA_ORIGINAL_BRANCH')"
}

git_restore_branch() {
  local repo="$1"
  [[ -z "${MYCELIA_ORIGINAL_BRANCH:-}" ]] && return 0
  git -C "$repo" checkout "$MYCELIA_ORIGINAL_BRANCH" >/dev/null 2>&1 \
    && log "Restored branch '$MYCELIA_ORIGINAL_BRANCH'" \
    || warn "Could not restore branch '$MYCELIA_ORIGINAL_BRANCH'"
}

# Commit explicitly named files. Refuses '.' and '-A' by design — staging
# everything is how unrelated work gets swept into an agent's commit.
git_commit_files() {
  local repo="$1" message="$2"; shift 2
  [[ $# -eq 0 ]] && { warn "No files to commit."; return 1; }
  local f
  for f in "$@"; do
    [[ "$f" == "." || "$f" == "-A" || "$f" == "--all" ]] && die "Refusing to stage '$f'. Name files explicitly."
    git -C "$repo" add -- "$f" || return 1
  done
  git -C "$repo" diff --cached --quiet && { log "Nothing staged; no commit made."; return 0; }
  git -C "$repo" commit -m "$message" >/dev/null || return 1
  log "Committed: $message"
}

# --- Vault writes --------------------------------------------------------

today_note() { echo "$MYCELIA_DAILY/$(date -u '+%Y-%m-%d').md"; }

# Append a line to today's daily note, creating it with frontmatter if absent.
append_daily() {
  local note; note="$(today_note)"
  local today; today="$(date -u '+%Y-%m-%d')"
  mkdir -p "$MYCELIA_DAILY"
  if [[ ! -f "$note" ]]; then
    cat > "$note" <<EOF
---
name: $today
description: Daily log for $today
type: daily
created: $today
updated: $today
---

EOF
  fi
  echo "$*" >> "$note"
}

# Raise something for the operator's attention. Use sparingly — the inbox is the only
# queue they are expected to triage, so noise here defeats the purpose.
inbox_note() {
  local slug="$1" description="$2" body="$3"
  local today; today="$(date -u '+%Y-%m-%d')"
  local path="$MYCELIA_INBOX/${today}-${slug}.md"
  mkdir -p "$MYCELIA_INBOX"
  cat > "$path" <<EOF
---
name: ${today}-${slug}
description: $description
type: reference
created: $today
updated: $today
---

$body
EOF
  log "Inbox note: $path"
}

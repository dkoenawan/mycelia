#!/usr/bin/env bash
# install.sh — idempotent bootstrap for a fresh mycelia clone.
#
# Copies control/*.example.yaml to control/*.local.yaml ONLY if the local file is
# absent. Never overwrites an existing local file — re-running this after editing
# your local config is always safe.
#
# Usage: ./scripts/install.sh
# Also invoked as `task install` — see Taskfile.yml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

[[ -f "$MYCELIA_CONTROL/estate.example.yaml" ]] \
  || die "control/estate.example.yaml not found — is this a mycelia checkout? (looked under $MYCELIA_ROOT)"

seed_local() {
  local example="$1" local_file="$2"
  if [[ -f "$local_file" ]]; then
    log "Already present, left untouched: ${local_file#$MYCELIA_ROOT/}"
  else
    cp "$example" "$local_file"
    log "Created ${local_file#$MYCELIA_ROOT/} from $(basename "$example") — edit it before running 'task doctor'."
  fi
}

seed_local "$MYCELIA_CONTROL/roots.example.yaml"  "$MYCELIA_CONTROL/roots.local.yaml"
seed_local "$MYCELIA_CONTROL/estate.example.yaml" "$MYCELIA_CONTROL/estate.local.yaml"

log ""
log "Next steps:"
log "  1. Edit control/roots.local.yaml  — set home/repos/logs paths and repo aliases for this machine."
log "  2. Edit control/estate.local.yaml — describe your own scheduled jobs (or leave the jobs list empty)."
log "  3. Run 'task doctor' (or ./scripts/doctor.sh) to verify the install."
log "  4. Open this directory as a vault in Obsidian if you want the GUI — it's just a folder of Markdown."

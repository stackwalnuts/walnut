#!/bin/bash
# Hook: Session Resume — SessionStart (resume)
# Reads squirrel entry by session_id, re-injects stash + preferences.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/alive-common.sh"

read_hook_input
read_session_fields
find_world || { echo "No ALIVE world found."; exit 0; }

SESSION_ID="${HOOK_SESSION_ID}"

# Resolve preferences
source "$SCRIPT_DIR/alive-resolve-preferences.sh"
PREFS=$(resolve_preferences "$WORLD_ROOT")

# Find squirrel entry by session_id (exact match) or fall back to most recent unsigned
SQUIRRELS_DIR="$WORLD_ROOT/.alive/_squirrels"
ENTRY=""
if [ -n "$SESSION_ID" ] && [ -f "$SQUIRRELS_DIR/$SESSION_ID.yaml" ]; then
  ENTRY="$SQUIRRELS_DIR/$SESSION_ID.yaml"
elif [ -d "$SQUIRRELS_DIR" ]; then
  ENTRY=$(grep -rl 'ended: null' "$SQUIRRELS_DIR/"*.yaml 2>/dev/null | head -1)
fi

if [ -n "$ENTRY" ] && [ -f "$ENTRY" ]; then
  ENTRY_SESSION_ID=$(grep '^session_id:' "$ENTRY" | head -1 | sed 's/session_id: *//')
  WALNUT=$(grep '^walnut:' "$ENTRY" | head -1 | sed 's/walnut: *//')

  # Extract stash items — lines starting with "- " after "stash:" until next top-level key
  STASH=$(sed -n '/^stash:/,/^[a-z]/{/^  *- /p}' "$ENTRY" 2>/dev/null || true)
  if [ -z "${STASH:-}" ]; then
    STASH="(empty)"
  fi

  cat << EOF
ALIVE session resumed. Session ID: ${ENTRY_SESSION_ID:-unknown}
Walnut: ${WALNUT:-none}
$PREFS
Previous stash:
$STASH
EOF
else
  cat << EOF
ALIVE session resumed. No matching entry found — clean start.
$PREFS
EOF
fi

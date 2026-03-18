#!/bin/bash
# Deploy alive plugin from local clone to cache
# Usage: ./deploy.sh [--dry-run]

set -euo pipefail

SOURCE="$(cd "$(dirname "$0")/plugins/alive" && pwd)"
CACHE="$HOME/.claude/plugins/cache/alivecomputer/alive/1.0.1-beta"

if [ ! -d "$SOURCE" ]; then
  echo "ERROR: Source not found at $SOURCE"
  exit 1
fi

if [ ! -d "$CACHE" ]; then
  echo "ERROR: Cache not found at $CACHE"
  exit 1
fi

DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
  echo "=== DRY RUN ==="
fi

echo "Source: $SOURCE"
echo "Cache:  $CACHE"
echo ""

rsync -av --delete \
  --exclude='.git' \
  --exclude='.DS_Store' \
  $DRY_RUN \
  "$SOURCE/" "$CACHE/"

echo ""
echo "Deployed $(date '+%Y-%m-%d %H:%M:%S')"

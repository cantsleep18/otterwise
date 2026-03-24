#!/usr/bin/env bash
# version-sync.sh
# Reads the canonical version from .claude-plugin/plugin.json and syncs it
# to marketplace.json and package.json. Run with a version argument to set
# a new version, or with no arguments to just verify they match.
#
# Usage:
#   ./scripts/version-sync.sh          # Verify all versions match
#   ./scripts/version-sync.sh 1.3.0    # Set version to 1.3.0 everywhere

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# Validate required files exist
for f in "$PLUGIN_JSON" "$MARKETPLACE_JSON"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Required file not found: $f"
    exit 1
  fi
done

# If a version argument is provided, update plugin.json first (the source of truth)
if [ $# -ge 1 ]; then
  NEW_VERSION="$1"

  # Validate semver format (basic check)
  if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
    echo "ERROR: Invalid version format '$NEW_VERSION'. Expected semver (e.g., 1.2.3)"
    exit 1
  fi

  echo "Setting version to $NEW_VERSION..."

  # Update plugin.json (source of truth)
  jq --arg v "$NEW_VERSION" '.version = $v' "$PLUGIN_JSON" > "$PLUGIN_JSON.tmp" \
    && mv "$PLUGIN_JSON.tmp" "$PLUGIN_JSON"
fi

# Read canonical version from plugin.json
CANONICAL=$(jq -r '.version' "$PLUGIN_JSON")

if [ -z "$CANONICAL" ] || [ "$CANONICAL" = "null" ]; then
  echo "ERROR: No version found in $PLUGIN_JSON"
  exit 1
fi

echo "Canonical version: $CANONICAL"

# Sync to marketplace.json — update both metadata.version and plugins[0].version
jq --arg v "$CANONICAL" '
  .metadata.version = $v |
  .plugins[0].version = $v
' "$MARKETPLACE_JSON" > "$MARKETPLACE_JSON.tmp" \
  && mv "$MARKETPLACE_JSON.tmp" "$MARKETPLACE_JSON"

echo "  Synced $MARKETPLACE_JSON"

# Verify all synced versions match
MARKET_META=$(jq -r '.metadata.version' "$MARKETPLACE_JSON")
MARKET_PLUGIN=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON")

MISMATCHES=()

if [ "$MARKET_META" != "$CANONICAL" ]; then
  MISMATCHES+=("marketplace.json metadata.version: $MARKET_META")
fi

if [ "$MARKET_PLUGIN" != "$CANONICAL" ]; then
  MISMATCHES+=("marketplace.json plugins[0].version: $MARKET_PLUGIN")
fi

if [ ${#MISMATCHES[@]} -gt 0 ]; then
  echo "ERROR: Version mismatch after sync:"
  for m in "${MISMATCHES[@]}"; do
    echo "  - $m (expected $CANONICAL)"
  done
  exit 1
fi

echo "OK: All versions synced to $CANONICAL"
exit 0

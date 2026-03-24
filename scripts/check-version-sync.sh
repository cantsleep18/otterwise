#!/usr/bin/env bash
# check-version-sync.sh — Verify version consistency across plugin files
# Exit codes: 0 = in sync, 1 = mismatch, 2 = file not found
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# Track all files and versions for reporting
declare -A VERSIONS
FILES_CHECKED=()

# Check files exist
for f in "$PLUGIN_JSON" "$MARKETPLACE_JSON"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found" >&2
    exit 2
  fi
done

# Extract versions using jq
V_PLUGIN=$(jq -r '.version' "$PLUGIN_JSON")
V_MKT_META=$(jq -r '.metadata.version' "$MARKETPLACE_JSON")
V_MKT_PLUG=$(jq -r '.plugins[0].version' "$MARKETPLACE_JSON")

# Record for reporting
VERSIONS["plugin.json .version"]="$V_PLUGIN"
FILES_CHECKED+=(".claude-plugin/plugin.json")

VERSIONS["marketplace.json .metadata.version"]="$V_MKT_META"
VERSIONS["marketplace.json .plugins[0].version"]="$V_MKT_PLUG"
FILES_CHECKED+=(".claude-plugin/marketplace.json")

# Report all files checked
echo "Files checked:"
for f in "${FILES_CHECKED[@]}"; do
  echo "  $f"
done
echo ""

echo "Versions found:"
echo "  plugin.json .version:                $V_PLUGIN"
echo "  marketplace.json .metadata.version:   $V_MKT_META"
echo "  marketplace.json .plugins[0].version: $V_MKT_PLUG"
echo ""

# Compare all against canonical (plugin.json)
CANONICAL="$V_PLUGIN"
MISMATCHES=()

if [ "$V_MKT_META" != "$CANONICAL" ]; then
  MISMATCHES+=("marketplace.json .metadata.version: $V_MKT_META (expected $CANONICAL)")
fi

if [ "$V_MKT_PLUG" != "$CANONICAL" ]; then
  MISMATCHES+=("marketplace.json .plugins[0].version: $V_MKT_PLUG (expected $CANONICAL)")
fi

if [ ${#MISMATCHES[@]} -gt 0 ]; then
  echo "MISMATCH: versions are out of sync"
  for m in "${MISMATCHES[@]}"; do
    echo "  - $m"
  done
  echo ""
  echo "Run: ./scripts/version-sync.sh to fix"
  exit 1
fi

echo "OK: All versions in sync ($CANONICAL)"
exit 0

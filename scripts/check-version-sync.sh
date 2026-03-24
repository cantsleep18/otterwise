#!/usr/bin/env bash
# check-version-sync.sh — Verify version consistency across plugin files
# Exit codes: 0 = in sync, 1 = mismatch, 2 = file not found
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$PLUGIN_ROOT/.claude-plugin/marketplace.json"

# Check files exist
for f in "$PLUGIN_JSON" "$MARKETPLACE_JSON"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found" >&2
    exit 2
  fi
done

# Extract versions using node (available since Node >= 20 is required)
V_PLUGIN=$(node -e "console.log(require('$PLUGIN_JSON').version)")
V_MKT_META=$(node -e "console.log(require('$MARKETPLACE_JSON').metadata.version)")
V_MKT_PLUG=$(node -e "console.log(require('$MARKETPLACE_JSON').plugins[0].version)")

# Compare
if [ "$V_PLUGIN" = "$V_MKT_META" ] && [ "$V_PLUGIN" = "$V_MKT_PLUG" ]; then
  echo "OK: All versions in sync ($V_PLUGIN)"
  exit 0
else
  echo "MISMATCH:"
  echo "  plugin.json:              $V_PLUGIN"
  echo "  marketplace.json metadata: $V_MKT_META"
  echo "  marketplace.json plugin:   $V_MKT_PLUG"
  exit 1
fi

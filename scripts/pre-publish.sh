#!/usr/bin/env bash
# pre-publish.sh
# Pre-publish validation for the Otterwise Claude Code marketplace plugin.
# Checks that all required files exist, JSON configs are valid, tests pass,
# and the build output is current.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/servers/python-repl"
ERRORS=()

echo "=== Otterwise pre-publish validation ==="

# --- Step 1: Required files ---
echo ""
echo "Checking required files..."

REQUIRED_FILES=(
  ".claude-plugin/plugin.json"
  ".claude-plugin/marketplace.json"
  "servers/python-repl/package.json"
  "servers/python-repl/scripts/build.mjs"
  "servers/python-repl/dist/mcp-server.cjs"
  "skills/research/SKILL.md"
  "skills/ow-setup/SKILL.md"
  "CLAUDE.md"
)

for rel in "${REQUIRED_FILES[@]}"; do
  f="$REPO_ROOT/$rel"
  if [ -f "$f" ]; then
    echo "  OK: $rel"
  else
    echo "  MISSING: $rel"
    ERRORS+=("Required file missing: $rel")
  fi
done

# --- Step 2: Validate JSON configs ---
echo ""
echo "Validating JSON configs..."

JSON_FILES=(
  ".claude-plugin/plugin.json"
  ".claude-plugin/marketplace.json"
  "servers/python-repl/package.json"
)

for rel in "${JSON_FILES[@]}"; do
  f="$REPO_ROOT/$rel"
  if [ -f "$f" ]; then
    if jq empty "$f" 2>/dev/null; then
      echo "  OK: $rel"
    else
      echo "  INVALID: $rel"
      ERRORS+=("Invalid JSON: $rel")
    fi
  fi
done

# --- Step 3: Version consistency ---
echo ""
echo "Checking version consistency..."

PLUGIN_VER=$(jq -r '.version // "missing"' "$REPO_ROOT/.claude-plugin/plugin.json" 2>/dev/null || echo "error")
MARKET_META_VER=$(jq -r '.metadata.version // "missing"' "$REPO_ROOT/.claude-plugin/marketplace.json" 2>/dev/null || echo "error")
MARKET_PLUGIN_VER=$(jq -r '.plugins[0].version // "missing"' "$REPO_ROOT/.claude-plugin/marketplace.json" 2>/dev/null || echo "error")

echo "  plugin.json:                $PLUGIN_VER"
echo "  marketplace.json (meta):    $MARKET_META_VER"
echo "  marketplace.json (plugin):  $MARKET_PLUGIN_VER"

if [ "$PLUGIN_VER" != "$MARKET_META_VER" ] || [ "$PLUGIN_VER" != "$MARKET_PLUGIN_VER" ]; then
  ERRORS+=("Version mismatch: plugin.json=$PLUGIN_VER, marketplace meta=$MARKET_META_VER, marketplace plugin=$MARKET_PLUGIN_VER")
fi

# --- Step 4: Build freshness ---
echo ""
echo "Checking build freshness..."

BUILD_OUTPUT="$SERVER_DIR/dist/mcp-server.cjs"
if [ -f "$BUILD_OUTPUT" ]; then
  # Check if any source file is newer than the build output
  STALE_SRC=$(find "$SERVER_DIR/src" -name "*.ts" -newer "$BUILD_OUTPUT" 2>/dev/null | head -5)
  if [ -n "$STALE_SRC" ]; then
    echo "  STALE: Source files newer than build output:"
    echo "$STALE_SRC" | while read -r line; do echo "    $line"; done
    ERRORS+=("Build output is stale — run: cd servers/python-repl && node scripts/build.mjs")
  else
    SIZE=$(wc -c < "$BUILD_OUTPUT")
    echo "  OK: Build output current ($SIZE bytes)"
  fi
else
  echo "  MISSING: Build output does not exist"
  ERRORS+=("Build output missing: servers/python-repl/dist/mcp-server.cjs")
fi

# --- Step 5: Run tests (if available) ---
echo ""
echo "Running tests..."

if [ -f "$SERVER_DIR/package.json" ] && jq -e '.scripts.test' "$SERVER_DIR/package.json" > /dev/null 2>&1; then
  if (cd "$SERVER_DIR" && npm test -- --run 2>&1); then
    echo "  OK: Tests passed"
  else
    ERRORS+=("Tests failed in servers/python-repl/")
  fi
else
  echo "  SKIP: No test script defined"
fi

# --- Summary ---
echo ""
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "FAILED: ${#ERRORS[@]} issue(s) found:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi

echo "OK: All pre-publish checks passed."
exit 0

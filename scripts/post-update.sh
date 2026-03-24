#!/usr/bin/env bash
# post-update.sh
# Runs after a git pull to rebuild changed components.
# Called by ow-setup auto-update or manually after updating the plugin.
#
# Usage: bash scripts/post-update.sh [--check-only]
#   --check-only  Print what would be rebuilt without doing it.
#
# Exit codes:
#   0 = success (or nothing to do)
#   1 = rebuild failed (caller should consider rollback)

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_SERVER_DIR="$PLUGIN_ROOT/servers/python-repl"
CHECK_ONLY=false

if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=true
fi

# Track what needs rebuilding
NEEDS_NPM_INSTALL=false
NEEDS_ESBUILD=false
CHANGES_SUMMARY=()

# Determine what changed between the previous HEAD and current HEAD.
# The caller should set OW_PRE_UPDATE_SHA; fall back to HEAD~1.
PRE_SHA="${OW_PRE_UPDATE_SHA:-$(git -C "$PLUGIN_ROOT" rev-parse HEAD~1 2>/dev/null || echo "")}"
POST_SHA="$(git -C "$PLUGIN_ROOT" rev-parse HEAD 2>/dev/null || echo "")"

if [[ -z "$PRE_SHA" || -z "$POST_SHA" || "$PRE_SHA" == "$POST_SHA" ]]; then
  echo "post-update: no commit range to compare — skipping."
  exit 0
fi

# Get list of changed files between pre-update and post-update
CHANGED_FILES="$(git -C "$PLUGIN_ROOT" diff --name-only "$PRE_SHA" "$POST_SHA" 2>/dev/null || echo "")"

if [[ -z "$CHANGED_FILES" ]]; then
  echo "post-update: no files changed — nothing to rebuild."
  exit 0
fi

# Check if npm install is needed (package.json or lockfile changed)
if echo "$CHANGED_FILES" | grep -qE '^servers/python-repl/package(-lock)?\.json$'; then
  NEEDS_NPM_INSTALL=true
  CHANGES_SUMMARY+=("package.json changed → npm install needed")
fi

# Check if esbuild rebuild is needed (any TypeScript source changed)
if echo "$CHANGED_FILES" | grep -qE '^servers/python-repl/src/.*\.ts$'; then
  NEEDS_ESBUILD=true
  CHANGES_SUMMARY+=("TypeScript source changed → esbuild rebuild needed")
fi

# Check if build script itself changed
if echo "$CHANGED_FILES" | grep -qE '^servers/python-repl/scripts/build\.mjs$'; then
  NEEDS_ESBUILD=true
  CHANGES_SUMMARY+=("build script changed → esbuild rebuild needed")
fi

# Check if esbuild rebuild is needed (esbuild config in package.json may have changed)
if echo "$CHANGED_FILES" | grep -qE '^servers/python-repl/tsconfig\.json$'; then
  NEEDS_ESBUILD=true
  CHANGES_SUMMARY+=("tsconfig.json changed → esbuild rebuild needed")
fi

# Print summary
if [[ ${#CHANGES_SUMMARY[@]} -eq 0 ]]; then
  echo "post-update: no rebuilds needed."
  exit 0
fi

echo "post-update: detected changes requiring rebuild:"
for line in "${CHANGES_SUMMARY[@]}"; do
  echo "  - $line"
done

if $CHECK_ONLY; then
  echo "post-update: --check-only mode, skipping actual rebuild."
  exit 0
fi

# Run npm install if needed
if $NEEDS_NPM_INSTALL; then
  echo "post-update: running npm install..."
  if (cd "$MCP_SERVER_DIR" && npm install --no-audit --no-fund 2>&1); then
    echo "post-update: npm install completed."
  else
    echo "ERROR: npm install failed."
    exit 1
  fi
fi

# Run esbuild rebuild if needed
if $NEEDS_ESBUILD; then
  echo "post-update: rebuilding MCP server with esbuild..."
  if (cd "$MCP_SERVER_DIR" && node scripts/build.mjs 2>&1); then
    echo "post-update: esbuild rebuild completed."
  else
    echo "ERROR: esbuild rebuild failed."
    exit 1
  fi
fi

# Verify the built artifact exists
if $NEEDS_ESBUILD; then
  if [[ ! -f "$MCP_SERVER_DIR/dist/mcp-server.cjs" ]]; then
    echo "ERROR: build artifact servers/python-repl/dist/mcp-server.cjs not found after rebuild."
    exit 1
  fi
  echo "post-update: build artifact verified."
fi

echo "post-update: all rebuilds completed successfully."
exit 0

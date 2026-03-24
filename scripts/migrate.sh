#!/usr/bin/env bash
# migrate.sh — Cache & config migration for Otterwise plugin updates
#
# Run after `git pull` to reconcile config changes and rebuild artifacts.
# Designed to be idempotent: safe to run multiple times.
#
# Usage: bash scripts/migrate.sh [--dry-run]

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN=false
CHANGES=0
WARNINGS=0
ERRORS=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# --- Helpers ----------------------------------------------------------------

info()  { printf '  \033[36mINFO\033[0m  %s\n' "$1"; }
ok()    { printf '  \033[32m  OK\033[0m  %s\n' "$1"; }
warn()  { printf '  \033[33mWARN\033[0m  %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
fail()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; ERRORS=$((ERRORS + 1)); }
changed() { CHANGES=$((CHANGES + 1)); }

heading() {
  printf '\n\033[1m%s\033[0m\n' "$1"
}

# Check if a command exists
need() {
  command -v "$1" >/dev/null 2>&1 || { fail "$1 not found"; return 1; }
}

# --- 1. Merge settings.json (preserve user customizations) ------------------

merge_settings() {
  heading "Settings Migration"

  local SETTINGS="$PLUGIN_ROOT/settings.json"
  if [ ! -f "$SETTINGS" ]; then
    fail "settings.json not found"
    return
  fi

  need jq || return

  # Canonical tool list — the MCP server exposes a single tool
  local CANONICAL_TOOLS=(
    "mcp__python-repl__python_repl"
  )

  local CURRENT_TOOLS
  CURRENT_TOOLS=$(jq -r '.permissions.allow[]' "$SETTINGS" 2>/dev/null || echo "")

  # Security: check for unauthorized permissions (not in canonical list)
  local UNAUTHORIZED=()
  while IFS= read -r perm; do
    [ -z "$perm" ] && continue
    local FOUND=false
    for tool in "${CANONICAL_TOOLS[@]}"; do
      if [ "$perm" = "$tool" ]; then
        FOUND=true
        break
      fi
    done
    if [ "$FOUND" = false ]; then
      UNAUTHORIZED+=("$perm")
    fi
  done <<< "$CURRENT_TOOLS"

  if [ ${#UNAUTHORIZED[@]} -gt 0 ]; then
    warn "settings.json contains ${#UNAUTHORIZED[@]} non-whitelisted permission(s):"
    for perm in "${UNAUTHORIZED[@]}"; do
      warn "  - $perm"
    done
    warn "These will be removed during migration (whitelist-only policy)"
  fi

  local MISSING=()
  for tool in "${CANONICAL_TOOLS[@]}"; do
    if ! echo "$CURRENT_TOOLS" | grep -qx "$tool"; then
      MISSING+=("$tool")
    fi
  done

  if [ ${#MISSING[@]} -eq 0 ] && [ ${#UNAUTHORIZED[@]} -eq 0 ]; then
    ok "settings.json has all ${#CANONICAL_TOOLS[@]} tools (no unauthorized)"
    return
  fi

  info "Adding ${#MISSING[@]} missing tool(s) to settings.json"
  for tool in "${MISSING[@]}"; do
    info "  + $tool"
  done

  if [ "$DRY_RUN" = true ]; then
    info "(dry-run) Would update settings.json"
    return
  fi

  # Build JSON array from canonical list
  local JSON_ARRAY
  JSON_ARRAY=$(printf '%s\n' "${CANONICAL_TOOLS[@]}" | jq -R . | jq -s .)

  jq --argjson tools "$JSON_ARRAY" '.permissions.allow = ($tools | unique)' "$SETTINGS" > "${SETTINGS}.tmp"
  mv "${SETTINGS}.tmp" "$SETTINGS"
  ok "settings.json updated with ${#CANONICAL_TOOLS[@]} tools"
  changed
}

# --- 2. Update hooks.json with new hook definitions -------------------------

merge_hooks() {
  heading "Hooks Migration"

  local HOOKS="$PLUGIN_ROOT/hooks/hooks.json"
  if [ ! -f "$HOOKS" ]; then
    fail "hooks/hooks.json not found"
    return
  fi

  need jq || return

  # Canonical hooks — matchers that must exist under PostToolUse
  local -A CANONICAL_MATCHERS
  CANONICAL_MATCHERS["TaskUpdate"]='bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate-summary.sh $TOOL_INPUT'
  CANONICAL_MATCHERS["Write"]='bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate-autopilot-state.sh'

  local CURRENT_MATCHERS
  CURRENT_MATCHERS=$(jq -r '.hooks.PostToolUse[]?.matcher // empty' "$HOOKS" 2>/dev/null || echo "")

  local MISSING=()
  for matcher in "${!CANONICAL_MATCHERS[@]}"; do
    if ! echo "$CURRENT_MATCHERS" | grep -qx "$matcher"; then
      MISSING+=("$matcher")
    fi
  done

  if [ ${#MISSING[@]} -eq 0 ]; then
    ok "hooks.json has all ${#CANONICAL_MATCHERS[@]} hook matchers"
  else
    info "Missing hook matchers: ${MISSING[*]}"
    if [ "$DRY_RUN" = false ]; then
      for matcher in "${MISSING[@]}"; do
        local cmd="${CANONICAL_MATCHERS[$matcher]}"
        jq --arg m "$matcher" --arg c "$cmd" \
          '.hooks.PostToolUse += [{"matcher": $m, "hooks": [{"type": "command", "command": $c}]}]' \
          "$HOOKS" > "${HOOKS}.tmp"
        mv "${HOOKS}.tmp" "$HOOKS"
        info "  + $matcher"
      done
      ok "hooks.json updated"
      changed
    else
      info "(dry-run) Would add missing hooks"
    fi
  fi

  # Security: validate hook commands reference only known scripts (no arbitrary execution)
  local SCRIPTS
  SCRIPTS=$(jq -r '.hooks.PostToolUse[].hooks[].command' "$HOOKS" 2>/dev/null || echo "")
  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue

    # Reject dangerous command patterns
    if echo "$cmd" | grep -qE '(curl|wget|eval|nc |bash -c|sh -c|python -c|node -e)'; then
      fail "Dangerous command pattern in hooks.json: $cmd"
      continue
    fi

    # Extract script path from command, expanding ${CLAUDE_PLUGIN_ROOT}
    local script_path
    script_path=$(echo "$cmd" | sed "s|\${CLAUDE_PLUGIN_ROOT}|$PLUGIN_ROOT|g" | awk '{print $2}')
    if [ -n "$script_path" ] && [ ! -f "$script_path" ]; then
      warn "Hook script not found: $script_path"
    fi
  done <<< "$SCRIPTS"
}

# --- 3. Handle .mcp.json changes -------------------------------------------

merge_mcp() {
  heading "MCP Config Migration"

  local MCP="$PLUGIN_ROOT/.mcp.json"
  if [ ! -f "$MCP" ]; then
    fail ".mcp.json not found"
    return
  fi

  need jq || return

  # Verify python-repl server entry exists and points to bundled artifact
  local SERVER_CMD
  SERVER_CMD=$(jq -r '.mcpServers["python-repl"].command // empty' "$MCP" 2>/dev/null)
  local SERVER_ARGS
  SERVER_ARGS=$(jq -r '.mcpServers["python-repl"].args[0] // empty' "$MCP" 2>/dev/null)

  if [ -z "$SERVER_CMD" ]; then
    fail ".mcp.json missing python-repl server entry"
    return
  fi

  # Check it points to the bundled CJS artifact (not tsx dev mode)
  if echo "$SERVER_ARGS" | grep -q 'dist/mcp-server.cjs'; then
    ok ".mcp.json points to bundled artifact"
  elif echo "$SERVER_ARGS" | grep -q 'src/index.ts'; then
    warn ".mcp.json points to source (src/index.ts) instead of bundle (dist/mcp-server.cjs)"
    if [ "$DRY_RUN" = false ]; then
      jq '.mcpServers["python-repl"].args = ["${CLAUDE_PLUGIN_ROOT}/servers/python-repl/dist/mcp-server.cjs"]' \
        "$MCP" > "${MCP}.tmp"
      mv "${MCP}.tmp" "$MCP"
      ok ".mcp.json updated to bundled artifact"
      changed
    fi
  else
    warn ".mcp.json has unexpected server path: $SERVER_ARGS"
  fi
}

# --- 4. Clean stale build artifacts -----------------------------------------

clean_build() {
  heading "Build Artifact Cleanup"

  local DIST="$PLUGIN_ROOT/servers/python-repl/dist"

  if [ ! -d "$DIST" ]; then
    info "No dist/ directory — will be created during build"
    return
  fi

  # Remove stale artifacts that are not part of the current build output
  # The build produces only: mcp-server.cjs
  # Legacy artifacts: index.js, index.d.ts (from old tsc build)
  local STALE_FILES=("index.js" "index.d.ts")
  local FOUND_STALE=()

  for f in "${STALE_FILES[@]}"; do
    if [ -f "$DIST/$f" ]; then
      FOUND_STALE+=("$f")
    fi
  done

  if [ ${#FOUND_STALE[@]} -eq 0 ]; then
    ok "No stale build artifacts"
    return
  fi

  info "Found ${#FOUND_STALE[@]} stale artifact(s): ${FOUND_STALE[*]}"
  if [ "$DRY_RUN" = false ]; then
    for f in "${FOUND_STALE[@]}"; do
      rm -f "$DIST/$f"
      info "  Removed $f"
    done
    ok "Stale artifacts cleaned"
    changed
  else
    info "(dry-run) Would remove stale artifacts"
  fi
}

# --- 5. Rebuild MCP server --------------------------------------------------

rebuild_server() {
  heading "MCP Server Rebuild"

  local BUILD_SCRIPT="$PLUGIN_ROOT/servers/python-repl/scripts/build.mjs"
  if [ ! -f "$BUILD_SCRIPT" ]; then
    fail "Build script not found: $BUILD_SCRIPT"
    return
  fi

  need node || return

  if [ "$DRY_RUN" = true ]; then
    info "(dry-run) Would rebuild MCP server"
    return
  fi

  info "Rebuilding MCP server..."
  if (cd "$PLUGIN_ROOT/servers/python-repl" && node scripts/build.mjs 2>&1); then
    ok "MCP server rebuilt successfully"
    changed
  else
    fail "MCP server build failed"
  fi
}

# --- 6. Validate .otterwise/ cache integrity --------------------------------

validate_cache() {
  heading "Cache & Schema Migration"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  if [ ! -d "$CACHE_DIR" ]; then
    info "No .otterwise/ cache directory (first run) — skipping"
    return
  fi

  # Read current plugin version for migration stamps
  local PLUGIN_VERSION="unknown"
  local PLUGIN_FILE="$PLUGIN_ROOT/.claude-plugin/plugin.json"
  if [ -f "$PLUGIN_FILE" ] && jq empty "$PLUGIN_FILE" 2>/dev/null; then
    PLUGIN_VERSION=$(jq -r '.version // "unknown"' "$PLUGIN_FILE")
  fi

  # Expected schema version for current plugin
  local EXPECTED_SCHEMA=2

  # Migrate each user data file
  # config.json = research session config
  # autopilot.json = autopilot session config (rounds, settings)
  # autopilot-state.json = runtime control signal (command, updatedAt, reason)
  local DATA_FILES=("config.json" "autopilot.json" "autopilot-state.json")
  for filename in "${DATA_FILES[@]}"; do
    local filepath="$CACHE_DIR/$filename"

    if [ ! -f "$filepath" ]; then
      continue
    fi

    # Validate JSON
    if ! jq empty "$filepath" 2>/dev/null; then
      warn "$filename is not valid JSON — removing corrupt file"
      if [ "$DRY_RUN" = false ]; then
        rm -f "$filepath"
        changed
      fi
      continue
    fi

    # Read schema version (default to 1 if absent)
    local CURRENT_SCHEMA
    CURRENT_SCHEMA=$(jq -r '.schemaVersion // 1' "$filepath")

    if [ "$CURRENT_SCHEMA" -eq "$EXPECTED_SCHEMA" ]; then
      ok "$filename schema up to date (v$CURRENT_SCHEMA)"
      continue
    fi

    if [ "$CURRENT_SCHEMA" -gt "$EXPECTED_SCHEMA" ]; then
      warn "$filename schema v$CURRENT_SCHEMA ahead of expected v$EXPECTED_SCHEMA — possible downgrade"
      continue
    fi

    # Schema needs migration: current < expected
    info "$filename needs migration: schema v$CURRENT_SCHEMA → v$EXPECTED_SCHEMA"

    if [ "$DRY_RUN" = true ]; then
      info "(dry-run) Would migrate $filename"
      continue
    fi

    # Backup before migrate
    local backup="$filepath.backup-v${CURRENT_SCHEMA}"
    cp "$filepath" "$backup"
    info "Backed up to $backup"

    # Apply migrations sequentially
    local MIGRATE_OK=true
    local schema="$CURRENT_SCHEMA"

    while [ "$schema" -lt "$EXPECTED_SCHEMA" ]; do
      local next=$((schema + 1))
      case "${filename}:v${schema}:v${next}" in
        config.json:v1:v2|autopilot-state.json:v1:v2|autopilot-config.json:v1:v2)
          # v1 → v2: add schemaVersion and pluginVersion
          jq --arg pv "$PLUGIN_VERSION" \
            '. + {"schemaVersion": 2, "pluginVersion": $pv}' \
            "$filepath" > "${filepath}.tmp" 2>/dev/null
          if [ $? -eq 0 ] && jq empty "${filepath}.tmp" 2>/dev/null; then
            mv "${filepath}.tmp" "$filepath"
          else
            rm -f "${filepath}.tmp"
            MIGRATE_OK=false
            break
          fi
          ;;
        *)
          warn "No migration path for $filename v$schema → v$next"
          MIGRATE_OK=false
          break
          ;;
      esac
      schema=$next
    done

    if [ "$MIGRATE_OK" = true ]; then
      ok "$filename migrated to schema v$EXPECTED_SCHEMA"
      changed
    else
      # Restore from backup
      cp "$backup" "$filepath"
      fail "$filename migration failed — restored from backup"
    fi
  done

  # Check for orphaned research cache files (directories without summary.md)
  local ORPHANS=0
  for dir in "$CACHE_DIR"/*/; do
    [ -d "$dir" ] || continue
    local dirname
    dirname=$(basename "$dir")
    case "$dirname" in
      .*|update-backup) continue ;; # skip hidden dirs and backup dir
    esac
    if [ ! -f "$dir/summary.md" ] && ls "$dir"/*.md >/dev/null 2>&1; then
      warn "Possible orphaned research cache: $dir"
      ORPHANS=$((ORPHANS + 1))
    fi
  done

  if [ "$ORPHANS" -eq 0 ]; then
    ok "No orphaned research cache detected"
  fi
}

# --- 7. Validate plugin.json paths ------------------------------------------

validate_plugin() {
  heading "Plugin Manifest Validation"

  local PLUGIN="$PLUGIN_ROOT/.claude-plugin/plugin.json"
  if [ ! -f "$PLUGIN" ]; then
    fail ".claude-plugin/plugin.json not found"
    return
  fi

  need jq || return

  # Check all skill paths exist
  local PATHS
  PATHS=$(jq -r '.skills[]?.path // empty' "$PLUGIN" 2>/dev/null)
  local ALL_OK=true

  while IFS= read -r skill_path; do
    [ -z "$skill_path" ] && continue
    local full_path="$PLUGIN_ROOT/$skill_path"
    if [ -d "$full_path" ] && [ -f "$full_path/SKILL.md" ]; then
      continue
    else
      warn "Skill path missing or has no SKILL.md: $skill_path"
      ALL_OK=false
    fi
  done <<< "$PATHS"

  if [ "$ALL_OK" = true ]; then
    ok "All skill paths valid"
  fi
}

# --- Main -------------------------------------------------------------------

main() {
  printf '\n\033[1;36mOtterwise Migration\033[0m\n'
  printf '==================\n'
  if [ "$DRY_RUN" = true ]; then
    printf '\033[33m(DRY RUN — no changes will be made)\033[0m\n'
  fi

  merge_settings
  merge_hooks
  merge_mcp
  clean_build
  rebuild_server
  validate_cache
  validate_plugin

  heading "Summary"
  printf '  Changes: %d | Warnings: %d | Errors: %d\n' "$CHANGES" "$WARNINGS" "$ERRORS"

  if [ "$ERRORS" -gt 0 ]; then
    printf '\n  \033[31mMigration completed with errors. Review output above.\033[0m\n\n'
    exit 1
  elif [ "$CHANGES" -gt 0 ]; then
    printf '\n  \033[32mMigration completed. %d change(s) applied.\033[0m\n\n' "$CHANGES"
  else
    printf '\n  \033[32mEverything up to date. No migration needed.\033[0m\n\n'
  fi
}

main

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

  # Canonical tool list — no MCP tools after REPL removal
  local CANONICAL_TOOLS=(
  )

  local CURRENT_TOOLS
  CURRENT_TOOLS=$(jq -r '.permissions.allow[]' "$SETTINGS" 2>/dev/null || echo "")

  # Remove stale MCP tool permissions (mcp__* entries from old REPL server)
  local STALE_MCP=()
  while IFS= read -r perm; do
    [ -z "$perm" ] && continue
    if [[ "$perm" == mcp__* ]]; then
      STALE_MCP+=("$perm")
    fi
  done <<< "$CURRENT_TOOLS"

  if [ ${#STALE_MCP[@]} -gt 0 ]; then
    info "Removing ${#STALE_MCP[@]} stale MCP tool permission(s):"
    for perm in "${STALE_MCP[@]}"; do
      info "  - $perm"
    done
    if [ "$DRY_RUN" = false ]; then
      jq '[.permissions.allow[] | select(startswith("mcp__") | not)] as $cleaned | .permissions.allow = $cleaned' \
        "$SETTINGS" > "${SETTINGS}.tmp"
      mv "${SETTINGS}.tmp" "$SETTINGS"
      ok "Removed stale MCP permissions"
      changed
      # Re-read after cleanup
      CURRENT_TOOLS=$(jq -r '.permissions.allow[]' "$SETTINGS" 2>/dev/null || echo "")
    else
      info "(dry-run) Would remove stale MCP permissions"
    fi
  fi

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
    ok "settings.json permissions clean (no stale or unauthorized entries)"
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
  ok "settings.json updated"
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

  # Verify no stale MCP server entries remain
  local SERVER_COUNT
  SERVER_COUNT=$(jq '.mcpServers | keys | length' "$MCP" 2>/dev/null || echo "0")

  if [ "$SERVER_COUNT" -eq 0 ]; then
    ok ".mcp.json has no MCP servers (expected)"
  else
    warn ".mcp.json has $SERVER_COUNT server(s) — review for stale entries"
    jq -r '.mcpServers | keys[]' "$MCP" 2>/dev/null | while read -r name; do
      warn "  MCP server: $name"
    done
  fi
}

# --- 4. Validate .otterwise/ cache integrity --------------------------------

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
  local EXPECTED_SCHEMA=3

  # Migrate each user data file
  # config.json = research session config
  # autopilot.json = autopilot session config (nodes, settings)
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
        config.json:v1:v2|autopilot-state.json:v1:v2|autopilot.json:v1:v2)
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
        config.json:v2:v3|autopilot-state.json:v2:v3)
          # v2 → v3: bump schemaVersion only (no structural changes)
          jq --arg pv "$PLUGIN_VERSION" \
            '. + {"schemaVersion": 3, "pluginVersion": $pv}' \
            "$filepath" > "${filepath}.tmp" 2>/dev/null
          if [ $? -eq 0 ] && jq empty "${filepath}.tmp" 2>/dev/null; then
            mv "${filepath}.tmp" "$filepath"
          else
            rm -f "${filepath}.tmp"
            MIGRATE_OK=false
            break
          fi
          ;;
        autopilot.json:v2:v3)
          # v2 → v3: nodes[] → strategies[], add modeStats{}, lastModes[]
          # Each node becomes a strategy entry with researchMode defaulting to "brute_force"
          jq --arg pv "$PLUGIN_VERSION" '
            # Convert nodes[] to strategies[]
            .strategies = [(.nodes // [])[] | {
              id: .id,
              name: .name,
              type: "seed",
              status: (if .status == "completed" then "draft" else .status end),
              phenomenon: "",
              researchMode: "brute_force"
            }] |
            # Initialize modeStats with zero counters for all 10 modes
            .modeStats = {
              "brute_force":       {"total": 0, "successful": 0},
              "news_replay":       {"total": 0, "successful": 0},
              "condition_combo":   {"total": 0, "successful": 0},
              "anomaly_detection": {"total": 0, "successful": 0},
              "copycat":           {"total": 0, "successful": 0},
              "narrative_shift":   {"total": 0, "successful": 0},
              "consensus_gap":     {"total": 0, "successful": 0},
              "supply_chain":      {"total": 0, "successful": 0},
              "regulatory":        {"total": 0, "successful": 0},
              "behavioral":        {"total": 0, "successful": 0}
            } |
            # Backfill modeStats from migrated strategies (all counted as brute_force)
            .modeStats.brute_force.total = (.strategies | length) |
            .modeStats.brute_force.successful = (.strategies | length) |
            # Initialize lastModes as empty (no historical mode tracking)
            .lastModes = [] |
            # Remove old nodes array and deprecated fields
            del(.nodes) | del(.maxRounds) | del(.maxNodes) |
            # Bump schema
            . + {"schemaVersion": 3, "pluginVersion": $pv}
          ' "$filepath" > "${filepath}.tmp" 2>/dev/null
          if [ $? -eq 0 ] && jq empty "${filepath}.tmp" 2>/dev/null; then
            mv "${filepath}.tmp" "$filepath"
            info "  Converted nodes[] → strategies[], added modeStats/lastModes"
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

# --- 5. Version migration: 1.2.0 → 1.3.0 -----------------------------------
#
# Handles the round-based → graph-based autopilot redesign:
#   - round-* directories → nodes/ structure
#   - autopilot.json rounds[] → nodes[] with parentIds
#   - Remove deprecated maxRounds/maxNodes fields
#   - autopilot-state.json command "completed" → "aborted"
#   - Remove autopilot-report.md (final report concept removed)

migrate_v120_to_v130() {
  heading "Version Migration (1.2.0 → 1.3.0)"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  if [ ! -d "$CACHE_DIR" ]; then
    info "No .otterwise/ directory — skipping version migration"
    return
  fi

  need jq || return

  # 5a. Rename round-* directories to nodes/ structure
  local ROUND_DIRS=()
  for dir in "$CACHE_DIR"/round-*/; do
    [ -d "$dir" ] || continue
    ROUND_DIRS+=("$dir")
  done

  if [ ${#ROUND_DIRS[@]} -gt 0 ]; then
    info "Found ${#ROUND_DIRS[@]} legacy round-* directory(s) to migrate"
    if [ "$DRY_RUN" = false ]; then
      mkdir -p "$CACHE_DIR/nodes"
      for dir in "${ROUND_DIRS[@]}"; do
        local round_name
        round_name=$(basename "$dir")
        # Extract round number: round-1 → node-1, round-02 → node-02
        local node_name="${round_name/round-/node-}"
        local target="$CACHE_DIR/nodes/$node_name"
        if [ -d "$target" ]; then
          warn "Target already exists, skipping: nodes/$node_name"
          continue
        fi
        mv "$dir" "$target"
        info "  Moved $round_name → nodes/$node_name"
      done
      ok "Migrated round directories to nodes/ structure"
      changed
    else
      info "(dry-run) Would migrate round-* dirs to nodes/"
    fi
  else
    ok "No legacy round-* directories found"
  fi

  # 5b. Migrate autopilot.json: rounds[] → nodes[], remove maxRounds/maxNodes
  local AP_FILE="$CACHE_DIR/autopilot.json"
  if [ -f "$AP_FILE" ] && jq empty "$AP_FILE" 2>/dev/null; then
    local AP_CHANGED=false

    # Convert rounds[] to nodes[] if present
    if jq -e '.rounds' "$AP_FILE" >/dev/null 2>&1; then
      info "autopilot.json has legacy rounds[] — converting to nodes[]"
      if [ "$DRY_RUN" = false ]; then
        # Convert each round entry: add parentIds array based on position
        # First round gets parentIds:[], subsequent get parentIds:[previous-id]
        jq '
          if .rounds then
            .nodes = [.rounds | to_entries[] | .value + (
              if .key == 0 then {parentIds: []}
              else {parentIds: [(.key - 1) as $prev | $input.rounds[$prev].id // ""]}
              end
            ) | del(.round) ] |
            del(.rounds)
          else . end
        ' "$AP_FILE" > "${AP_FILE}.tmp" 2>/dev/null
        if [ $? -eq 0 ] && jq empty "${AP_FILE}.tmp" 2>/dev/null; then
          mv "${AP_FILE}.tmp" "$AP_FILE"
          AP_CHANGED=true
          info "  Converted rounds[] → nodes[] with parentIds"
        else
          rm -f "${AP_FILE}.tmp"
          warn "Failed to convert rounds[] — leaving unchanged"
        fi
      else
        info "(dry-run) Would convert rounds[] to nodes[]"
      fi
    fi

    # Remove deprecated maxRounds field
    if jq -e '.maxRounds' "$AP_FILE" >/dev/null 2>&1; then
      info "Removing deprecated maxRounds from autopilot.json"
      if [ "$DRY_RUN" = false ]; then
        jq 'del(.maxRounds)' "$AP_FILE" > "${AP_FILE}.tmp"
        mv "${AP_FILE}.tmp" "$AP_FILE"
        AP_CHANGED=true
      else
        info "(dry-run) Would remove maxRounds"
      fi
    fi

    # Remove deprecated maxNodes field
    if jq -e '.maxNodes' "$AP_FILE" >/dev/null 2>&1; then
      info "Removing deprecated maxNodes from autopilot.json"
      if [ "$DRY_RUN" = false ]; then
        jq 'del(.maxNodes)' "$AP_FILE" > "${AP_FILE}.tmp"
        mv "${AP_FILE}.tmp" "$AP_FILE"
        AP_CHANGED=true
      else
        info "(dry-run) Would remove maxNodes"
      fi
    fi

    if [ "$AP_CHANGED" = true ]; then
      ok "autopilot.json migrated to 1.3.0 schema"
      changed
    else
      ok "autopilot.json already compatible with 1.3.0"
    fi
  fi

  # 5c. Fix autopilot-state.json: "completed" → "aborted"
  local STATE_FILE="$CACHE_DIR/autopilot-state.json"
  if [ -f "$STATE_FILE" ] && jq empty "$STATE_FILE" 2>/dev/null; then
    local STATE_CMD
    STATE_CMD=$(jq -r '.command // empty' "$STATE_FILE")
    if [ "$STATE_CMD" = "completed" ]; then
      info "autopilot-state.json has deprecated command 'completed' — changing to 'aborted'"
      if [ "$DRY_RUN" = false ]; then
        jq '.command = "aborted"' "$STATE_FILE" > "${STATE_FILE}.tmp"
        mv "${STATE_FILE}.tmp" "$STATE_FILE"
        ok "autopilot-state.json command updated: completed → aborted"
        changed
      else
        info "(dry-run) Would change command 'completed' to 'aborted'"
      fi
    else
      ok "autopilot-state.json command is valid ('$STATE_CMD')"
    fi
  fi

  # 5d. Remove autopilot-report.md (final report concept removed in 1.3.0)
  local REPORT_FILE="$CACHE_DIR/autopilot-report.md"
  if [ -f "$REPORT_FILE" ]; then
    info "Removing deprecated autopilot-report.md (final report concept removed)"
    if [ "$DRY_RUN" = false ]; then
      rm -f "$REPORT_FILE"
      ok "Removed autopilot-report.md"
      changed
    else
      info "(dry-run) Would remove autopilot-report.md"
    fi
  fi
}

# --- 5b. Version migration: 1.3.0 → 1.4.0 ----------------------------------
#
# Handles the graph-node → strategy-node redesign (OLJC loop):
#   - nodes/ directories → strategies/ structure
#   - node report.md files → strategy .md files with updated frontmatter
#   - autopilot.json nodes[] → strategies[] (handled by schema v2→v3 in validate_cache)

migrate_v130_to_v140() {
  heading "Version Migration (1.3.0 → 1.4.0)"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  if [ ! -d "$CACHE_DIR" ]; then
    info "No .otterwise/ directory — skipping version migration"
    return
  fi

  need jq || return

  # 5b-a. Rename nodes/ directory to strategies/
  local NODES_DIR="$CACHE_DIR/nodes"
  local STRAT_DIR="$CACHE_DIR/strategies"
  if [ -d "$NODES_DIR" ]; then
    info "Found legacy nodes/ directory — migrating to strategies/"
    if [ "$DRY_RUN" = false ]; then
      if [ -d "$STRAT_DIR" ]; then
        warn "strategies/ already exists — merging nodes/ contents into it"
      else
        mkdir -p "$STRAT_DIR"
      fi

      # Move each node directory's report.md to strategies/{name}.md
      for node_dir in "$NODES_DIR"/*/; do
        [ -d "$node_dir" ] || continue
        local node_name
        node_name=$(basename "$node_dir")
        local report="$node_dir/report.md"

        if [ -f "$report" ]; then
          # Extract name from frontmatter if available, else use dir name
          local strat_name
          strat_name=$(sed -n '/^---$/,/^---$/{ /^name:/{ s/^name: *//; s/^"//; s/"$//; p; q; } }' "$report" 2>/dev/null)
          if [ -z "$strat_name" ]; then
            strat_name="$node_name"
          fi
          local target="$STRAT_DIR/${strat_name}.md"
          if [ -f "$target" ]; then
            warn "Strategy file already exists, skipping: ${strat_name}.md"
          else
            cp "$report" "$target"
            info "  Migrated nodes/$node_name/report.md → strategies/${strat_name}.md"
          fi
        fi
      done

      # Create look/ and research-log/ subdirectories
      mkdir -p "$STRAT_DIR/look"
      mkdir -p "$STRAT_DIR/research-log"

      # Remove old nodes/ directory after migration
      rm -rf "$NODES_DIR"
      ok "Migrated nodes/ → strategies/"
      changed
    else
      info "(dry-run) Would migrate nodes/ to strategies/"
    fi
  else
    ok "No legacy nodes/ directory found"
  fi

  # 5b-b. Migrate autopilot.json: nodes[] → strategies[], add modeStats{}, lastModes[]
  local AP_FILE="$CACHE_DIR/autopilot.json"
  if [ -f "$AP_FILE" ] && jq empty "$AP_FILE" 2>/dev/null; then
    local AP_CHANGED=false

    # Convert nodes[] → strategies[]
    if jq -e '.nodes' "$AP_FILE" >/dev/null 2>&1; then
      info "Converting autopilot.json nodes[] → strategies[]"
      if [ "$DRY_RUN" = false ]; then
        jq '
          .strategies = [.nodes[] | {
            id: .id,
            name: (.name // .id),
            type: (if (.parentIds // []) | length == 0 then "seed"
                   elif (.parentIds // []) | length > 1 then "combine"
                   else "derive" end),
            status: (if .status == "completed" then "established"
                     elif .status == "running" then "developing"
                     else "draft" end),
            phenomenon: "migrated from v1.3.0 node",
            researchMode: "brute_force"
          }] | del(.nodes)
        ' "$AP_FILE" > "${AP_FILE}.tmp" 2>/dev/null
        if [ $? -eq 0 ] && jq empty "${AP_FILE}.tmp" 2>/dev/null; then
          mv "${AP_FILE}.tmp" "$AP_FILE"
          AP_CHANGED=true
        else
          rm -f "${AP_FILE}.tmp"
          warn "Failed to convert nodes[] → strategies[]"
        fi
      fi
    elif jq -e '.strategies' "$AP_FILE" >/dev/null 2>&1; then
      ok "autopilot.json already has strategies[]"
    fi

    # Add modeStats{} if missing
    if ! jq -e '.modeStats' "$AP_FILE" >/dev/null 2>&1; then
      if [ "$DRY_RUN" = false ]; then
        jq '. + {"modeStats": {
          "brute_force": {"total": 0, "successful": 0},
          "news_replay": {"total": 0, "successful": 0},
          "condition_combo": {"total": 0, "successful": 0},
          "anomaly_detection": {"total": 0, "successful": 0},
          "copycat": {"total": 0, "successful": 0},
          "narrative_shift": {"total": 0, "successful": 0},
          "consensus_gap": {"total": 0, "successful": 0},
          "supply_chain": {"total": 0, "successful": 0},
          "regulatory": {"total": 0, "successful": 0},
          "behavioral": {"total": 0, "successful": 0}
        }}' "$AP_FILE" > "${AP_FILE}.tmp"
        mv "${AP_FILE}.tmp" "$AP_FILE"
        AP_CHANGED=true
        info "  Added modeStats{}"
      fi
    fi

    # Add lastModes[] if missing
    if ! jq -e '.lastModes' "$AP_FILE" >/dev/null 2>&1; then
      if [ "$DRY_RUN" = false ]; then
        jq '. + {"lastModes": []}' "$AP_FILE" > "${AP_FILE}.tmp"
        mv "${AP_FILE}.tmp" "$AP_FILE"
        AP_CHANGED=true
        info "  Added lastModes[]"
      fi
    fi

    if [ "$AP_CHANGED" = true ]; then
      ok "autopilot.json migrated to v1.4.0 schema"
      changed
    fi
  fi
}

# --- 6. Clean up design docs from .otterwise/ ------------------------------
#
# .otterwise/ should only contain research data (config, state, strategies/).
# Design docs and planning files are not research artifacts.

cleanup_design_docs() {
  heading "Design Doc Cleanup"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  if [ ! -d "$CACHE_DIR" ]; then
    return
  fi

  # Known non-research files that should not live in .otterwise/
  # These are design docs created during development, not user research data.
  local STALE_DOCS=(
    "STOPPING_CONDITIONS_FRAMEWORK.md"
    "RESOURCE_MANAGEMENT_FINDINGS.md"
    "DAG_INTELLIGENCE_FRAMEWORK.md"
    "STATE_MANAGEMENT_DESIGN.md"
    "node-selection-algorithm-design.md"
    "refactor-manifest.md"
  )

  local REMOVED=0
  for doc in "${STALE_DOCS[@]}"; do
    local filepath="$CACHE_DIR/$doc"
    if [ -f "$filepath" ]; then
      info "Removing design doc: .otterwise/$doc"
      if [ "$DRY_RUN" = false ]; then
        rm -f "$filepath"
        REMOVED=$((REMOVED + 1))
      else
        info "(dry-run) Would remove .otterwise/$doc"
      fi
    fi
  done

  if [ "$REMOVED" -gt 0 ]; then
    ok "Removed $REMOVED design doc(s) from .otterwise/"
    changed
  elif [ "$DRY_RUN" = false ]; then
    ok "No stale design docs in .otterwise/"
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
  migrate_v120_to_v130
  migrate_v130_to_v140
  validate_cache
  cleanup_design_docs
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

#!/usr/bin/env bash
# migrate-to-investment.sh — Migrate v1.3.0 (graph-based nodes) to v1.4.0 (investment strategies)
#
# Migrates:
#   .otterwise/nodes/{id}/report.md  → .otterwise/strategies/{name}.md
#   autopilot.json nodes[]           → strategies[] + modeStats{} + lastModes[]
#   config.json                      → adds investmentMode: true
#
# Backs up old structure before any changes.
# Idempotent: safe to run multiple times. Skips already-migrated data.
#
# Usage: bash scripts/migrate-to-investment.sh [--dry-run]

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

info()    { printf '  \033[36mINFO\033[0m  %s\n' "$1"; }
ok()      { printf '  \033[32m  OK\033[0m  %s\n' "$1"; }
warn()    { printf '  \033[33mWARN\033[0m  %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
fail()    { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; ERRORS=$((ERRORS + 1)); }
changed() { CHANGES=$((CHANGES + 1)); }

heading() {
  printf '\n\033[1m%s\033[0m\n' "$1"
}

need() {
  command -v "$1" >/dev/null 2>&1 || { fail "$1 not found"; return 1; }
}

# --- Pre-flight checks ------------------------------------------------------

preflight() {
  heading "Pre-flight Checks"

  need jq || return

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  if [ ! -d "$CACHE_DIR" ]; then
    info "No .otterwise/ directory — nothing to migrate"
    exit 0
  fi

  # Already migrated? Check if strategies/ exists and nodes/ does not
  if [ -d "$CACHE_DIR/strategies" ] && [ ! -d "$CACHE_DIR/nodes" ]; then
    info "Already migrated (strategies/ exists, nodes/ absent)"

    # Still check autopilot.json for completeness
    local AP_FILE="$CACHE_DIR/autopilot.json"
    if [ -f "$AP_FILE" ] && jq -e '.strategies' "$AP_FILE" >/dev/null 2>&1; then
      ok "autopilot.json already uses strategies[] schema"
      exit 0
    fi
  fi

  ok "Pre-flight passed"
}

# --- 1. Backup --------------------------------------------------------------

backup_old_structure() {
  heading "Backup"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  local BACKUP_DIR="$CACHE_DIR/migration-backup-v130"

  if [ -d "$BACKUP_DIR" ]; then
    ok "Backup already exists at migration-backup-v130/"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    info "(dry-run) Would create backup at migration-backup-v130/"
    return
  fi

  mkdir -p "$BACKUP_DIR"

  # Backup autopilot.json
  if [ -f "$CACHE_DIR/autopilot.json" ]; then
    cp "$CACHE_DIR/autopilot.json" "$BACKUP_DIR/autopilot.json"
    info "Backed up autopilot.json"
  fi

  # Backup config.json
  if [ -f "$CACHE_DIR/config.json" ]; then
    cp "$CACHE_DIR/config.json" "$BACKUP_DIR/config.json"
    info "Backed up config.json"
  fi

  # Backup nodes/ directory (copy, not move — we move later)
  if [ -d "$CACHE_DIR/nodes" ]; then
    cp -r "$CACHE_DIR/nodes" "$BACKUP_DIR/nodes"
    info "Backed up nodes/ directory"
  fi

  ok "Backup created at .otterwise/migration-backup-v130/"
  changed
}

# --- 2. Migrate nodes/ → strategies/ ----------------------------------------

migrate_nodes_to_strategies() {
  heading "Node → Strategy Migration"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  local NODES_DIR="$CACHE_DIR/nodes"
  local STRAT_DIR="$CACHE_DIR/strategies"

  if [ ! -d "$NODES_DIR" ]; then
    info "No nodes/ directory found — skipping"
    return
  fi

  # Count report.md files
  local REPORT_COUNT=0
  for report in "$NODES_DIR"/*/report.md; do
    [ -f "$report" ] || continue
    REPORT_COUNT=$((REPORT_COUNT + 1))
  done

  if [ "$REPORT_COUNT" -eq 0 ]; then
    info "No report.md files found in nodes/ — skipping"
    return
  fi

  info "Found $REPORT_COUNT node report(s) to convert"

  if [ "$DRY_RUN" = true ]; then
    info "(dry-run) Would convert $REPORT_COUNT report(s) to strategy format"
    return
  fi

  mkdir -p "$STRAT_DIR"
  mkdir -p "$STRAT_DIR/look"
  mkdir -p "$STRAT_DIR/discarded"

  local CONVERTED=0

  for node_dir in "$NODES_DIR"/*/; do
    [ -d "$node_dir" ] || continue

    local report="$node_dir/report.md"
    if [ ! -f "$report" ]; then
      warn "Node directory without report.md: $(basename "$node_dir") — skipping"
      continue
    fi

    # Extract frontmatter fields from report.md
    local NODE_ID NODE_NAME PARENT_IDS DATASET STATUS FINDINGS_COUNT
    NODE_ID=$(sed -n '/^---$/,/^---$/{ /^id:/{ s/^id:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/; p; } }' "$report" | head -1)
    NODE_NAME=$(sed -n '/^---$/,/^---$/{ /^name:/{ s/^name:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/; p; } }' "$report" | head -1)
    DATASET=$(sed -n '/^---$/,/^---$/{ /^dataset:/{ s/^dataset:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/; p; } }' "$report" | head -1)
    STATUS=$(sed -n '/^---$/,/^---$/{ /^status:/{ s/^status:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}/\1/; p; } }' "$report" | head -1)
    FINDINGS_COUNT=$(sed -n '/^---$/,/^---$/{ /^findings_count:/{ s/^findings_count:[[:space:]]*//; p; } }' "$report" | head -1)

    # Check for parentIds to determine type
    PARENT_IDS=$(sed -n '/^---$/,/^---$/{ /^parentIds:/{ s/^parentIds:[[:space:]]*//; p; } }' "$report" | head -1)

    # Determine strategy type from parentIds
    local STRATEGY_TYPE="seed"
    if [ -n "$PARENT_IDS" ] && [ "$PARENT_IDS" != "[]" ]; then
      # Count parents: >1 = combine, 1 = derive
      local PARENT_COUNT
      PARENT_COUNT=$(echo "$PARENT_IDS" | tr ',' '\n' | grep -c '"' || echo 0)
      PARENT_COUNT=$((PARENT_COUNT / 2))  # each id has 2 quotes
      if [ "$PARENT_COUNT" -gt 1 ]; then
        STRATEGY_TYPE="combine"
      else
        STRATEGY_TYPE="derive"
      fi
    fi

    # Use node name for strategy filename, fallback to node id
    local STRAT_NAME="${NODE_NAME:-$NODE_ID}"
    if [ -z "$STRAT_NAME" ]; then
      STRAT_NAME="migrated-$(basename "$node_dir")"
    fi
    local STRAT_FILE="$STRAT_DIR/${STRAT_NAME}.md"

    # Map old status to new status
    local NEW_STATUS="draft"
    case "${STATUS:-}" in
      completed) NEW_STATUS="established" ;;
      running|in_progress) NEW_STATUS="developing" ;;
      *) NEW_STATUS="draft" ;;
    esac

    # Extract body content (everything after second ---)
    local BODY
    BODY=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2){found=1; next}} found{print}' "$report")

    # Build new strategy.md with extended frontmatter
    cat > "$STRAT_FILE" <<STRATEGY_EOF
---
id: "${NODE_ID}"
type: ${STRATEGY_TYPE}
status: ${NEW_STATUS}
phenomenon: "migrated from v1.3.0 node"
dataUsed: ["${DATASET:-unknown}"]
observationPeriod: "unknown"
researchMode: "brute_force"
tags:
  - migrated
  - v130
---

# ${STRAT_NAME}

## 관련 전략

$(if [ "$STRATEGY_TYPE" = "seed" ]; then
  echo "독립 전략 (seed) — 관련 없음."
elif [ -n "$PARENT_IDS" ] && [ "$PARENT_IDS" != "[]" ]; then
  # Convert parentIds to wikilinks
  echo "$PARENT_IDS" | tr -d '[]"' | tr ',' '\n' | while read -r pid; do
    pid=$(echo "$pid" | xargs)
    [ -n "$pid" ] && echo "- [[$pid]]"
  done
else
  echo "관련 전략 정보 없음 (마이그레이션 데이터 부족)."
fi)

## 현상

> 이 전략은 v1.3.0 노드에서 자동 마이그레이션되었습니다.
> 원본 노드: ${NODE_ID}
> 원본 findings_count: ${FINDINGS_COUNT:-0}

${BODY}

## 한계 및 주의사항

- v1.3.0에서 자동 마이그레이션된 전략으로, 현상/가격관찰/해석/전략아이디어 섹션 구분이 원본과 다를 수 있습니다.
- 수동 검토 후 현상 필드 및 태그를 업데이트하는 것을 권장합니다.
STRATEGY_EOF

    info "  Converted: $(basename "$node_dir") → ${STRAT_NAME}.md (type: $STRATEGY_TYPE)"
    CONVERTED=$((CONVERTED + 1))
  done

  if [ "$CONVERTED" -gt 0 ]; then
    ok "Converted $CONVERTED node(s) to strategy format"
    changed
  fi

  # Remove old nodes/ directory after successful conversion
  if [ "$CONVERTED" -eq "$REPORT_COUNT" ]; then
    rm -rf "$NODES_DIR"
    ok "Removed old nodes/ directory"
    changed
  else
    warn "Not all nodes converted ($CONVERTED/$REPORT_COUNT) — keeping nodes/ directory"
  fi
}

# --- 3. Migrate autopilot.json schema ---------------------------------------

migrate_autopilot_json() {
  heading "autopilot.json Schema Migration (v1.3.0 → v1.4.0)"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  local AP_FILE="$CACHE_DIR/autopilot.json"

  if [ ! -f "$AP_FILE" ]; then
    info "No autopilot.json found — skipping"
    return
  fi

  need jq || return

  if ! jq empty "$AP_FILE" 2>/dev/null; then
    fail "autopilot.json is not valid JSON"
    return
  fi

  # Already migrated?
  if jq -e '.strategies' "$AP_FILE" >/dev/null 2>&1 && \
     jq -e '.modeStats' "$AP_FILE" >/dev/null 2>&1 && \
     jq -e '.lastModes' "$AP_FILE" >/dev/null 2>&1; then
    ok "autopilot.json already has v1.4.0 schema"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    info "(dry-run) Would migrate autopilot.json to v1.4.0 schema"
    return
  fi

  local AP_CHANGED=false

  # Convert nodes[] → strategies[]
  if jq -e '.nodes' "$AP_FILE" >/dev/null 2>&1; then
    info "Converting nodes[] → strategies[]"
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
      }] |
      del(.nodes)
    ' "$AP_FILE" > "${AP_FILE}.tmp" 2>/dev/null

    if [ $? -eq 0 ] && jq empty "${AP_FILE}.tmp" 2>/dev/null; then
      mv "${AP_FILE}.tmp" "$AP_FILE"
      AP_CHANGED=true
      info "  Converted nodes[] → strategies[]"
    else
      rm -f "${AP_FILE}.tmp"
      fail "Failed to convert nodes[] — leaving unchanged"
      return
    fi
  fi

  # Add modeStats{} if missing
  if ! jq -e '.modeStats' "$AP_FILE" >/dev/null 2>&1; then
    info "Adding modeStats{}"

    # Count existing strategies per mode to seed stats
    jq '
      .modeStats = {
        "brute_force":       { "total": ([.strategies[]? | select(.researchMode == "brute_force")]       | length), "successful": ([.strategies[]? | select(.researchMode == "brute_force")]       | length) },
        "news_replay":       { "total": ([.strategies[]? | select(.researchMode == "news_replay")]       | length), "successful": ([.strategies[]? | select(.researchMode == "news_replay")]       | length) },
        "condition_combo":   { "total": ([.strategies[]? | select(.researchMode == "condition_combo")]   | length), "successful": ([.strategies[]? | select(.researchMode == "condition_combo")]   | length) },
        "anomaly_detection": { "total": ([.strategies[]? | select(.researchMode == "anomaly_detection")] | length), "successful": ([.strategies[]? | select(.researchMode == "anomaly_detection")] | length) },
        "copycat":           { "total": ([.strategies[]? | select(.researchMode == "copycat")]           | length), "successful": ([.strategies[]? | select(.researchMode == "copycat")]           | length) },
        "narrative_shift":   { "total": ([.strategies[]? | select(.researchMode == "narrative_shift")]   | length), "successful": ([.strategies[]? | select(.researchMode == "narrative_shift")]   | length) },
        "consensus_gap":     { "total": ([.strategies[]? | select(.researchMode == "consensus_gap")]     | length), "successful": ([.strategies[]? | select(.researchMode == "consensus_gap")]     | length) },
        "supply_chain":      { "total": ([.strategies[]? | select(.researchMode == "supply_chain")]      | length), "successful": ([.strategies[]? | select(.researchMode == "supply_chain")]      | length) },
        "regulatory":        { "total": ([.strategies[]? | select(.researchMode == "regulatory")]        | length), "successful": ([.strategies[]? | select(.researchMode == "regulatory")]        | length) },
        "behavioral":        { "total": ([.strategies[]? | select(.researchMode == "behavioral")]        | length), "successful": ([.strategies[]? | select(.researchMode == "behavioral")]        | length) }
      }
    ' "$AP_FILE" > "${AP_FILE}.tmp" 2>/dev/null

    if [ $? -eq 0 ] && jq empty "${AP_FILE}.tmp" 2>/dev/null; then
      mv "${AP_FILE}.tmp" "$AP_FILE"
      AP_CHANGED=true
      info "  Added modeStats{} (seeded from existing strategies)"
    else
      rm -f "${AP_FILE}.tmp"
      fail "Failed to add modeStats"
    fi
  fi

  # Add lastModes[] if missing
  if ! jq -e '.lastModes' "$AP_FILE" >/dev/null 2>&1; then
    info "Adding lastModes[]"

    # Seed from existing strategies' researchMode (last 10)
    jq '
      .lastModes = ([.strategies[]?.researchMode] | .[-10:])
    ' "$AP_FILE" > "${AP_FILE}.tmp" 2>/dev/null

    if [ $? -eq 0 ] && jq empty "${AP_FILE}.tmp" 2>/dev/null; then
      mv "${AP_FILE}.tmp" "$AP_FILE"
      AP_CHANGED=true
      info "  Added lastModes[] (seeded from existing strategies)"
    else
      rm -f "${AP_FILE}.tmp"
      fail "Failed to add lastModes"
    fi
  fi

  # Ensure cooldown[] exists
  if ! jq -e '.cooldown' "$AP_FILE" >/dev/null 2>&1; then
    jq '. + {"cooldown": []}' "$AP_FILE" > "${AP_FILE}.tmp"
    mv "${AP_FILE}.tmp" "$AP_FILE"
    AP_CHANGED=true
    info "  Added empty cooldown[]"
  fi

  # Remove deprecated fields
  for field in maxRounds maxNodes; do
    if jq -e ".$field" "$AP_FILE" >/dev/null 2>&1; then
      jq "del(.$field)" "$AP_FILE" > "${AP_FILE}.tmp"
      mv "${AP_FILE}.tmp" "$AP_FILE"
      AP_CHANGED=true
      info "  Removed deprecated .$field"
    fi
  done

  if [ "$AP_CHANGED" = true ]; then
    ok "autopilot.json migrated to v1.4.0 schema"
    changed
  else
    ok "autopilot.json already compatible"
  fi
}

# --- 4. Update config.json --------------------------------------------------

migrate_config_json() {
  heading "config.json Migration"

  local CACHE_DIR="$PLUGIN_ROOT/.otterwise"
  local CONFIG_FILE="$CACHE_DIR/config.json"

  if [ ! -f "$CONFIG_FILE" ]; then
    info "No config.json found — skipping"
    return
  fi

  need jq || return

  if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
    fail "config.json is not valid JSON"
    return
  fi

  # Already has investmentMode?
  if jq -e '.investmentMode' "$CONFIG_FILE" >/dev/null 2>&1; then
    ok "config.json already has investmentMode"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    info "(dry-run) Would add investmentMode: true to config.json"
    return
  fi

  jq '. + {"investmentMode": true}' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
  if [ $? -eq 0 ] && jq empty "${CONFIG_FILE}.tmp" 2>/dev/null; then
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    ok "Added investmentMode: true to config.json"
    changed
  else
    rm -f "${CONFIG_FILE}.tmp"
    fail "Failed to update config.json"
  fi
}

# --- Main -------------------------------------------------------------------

main() {
  printf '\n\033[1;36mOtterwise Investment Migration (v1.3.0 → v1.4.0)\033[0m\n'
  printf '=================================================\n'
  if [ "$DRY_RUN" = true ]; then
    printf '\033[33m(DRY RUN — no changes will be made)\033[0m\n'
  fi

  preflight
  backup_old_structure
  migrate_nodes_to_strategies
  migrate_autopilot_json
  migrate_config_json

  heading "Summary"
  printf '  Changes: %d | Warnings: %d | Errors: %d\n' "$CHANGES" "$WARNINGS" "$ERRORS"

  if [ "$ERRORS" -gt 0 ]; then
    printf '\n  \033[31mMigration completed with errors. Review output above.\033[0m\n'
    printf '  \033[31mBackup available at .otterwise/migration-backup-v130/\033[0m\n\n'
    exit 1
  elif [ "$CHANGES" -gt 0 ]; then
    printf '\n  \033[32mMigration completed. %d change(s) applied.\033[0m\n' "$CHANGES"
    printf '  \033[32mBackup at .otterwise/migration-backup-v130/\033[0m\n\n'
  else
    printf '\n  \033[32mEverything up to date. No migration needed.\033[0m\n\n'
  fi
}

main

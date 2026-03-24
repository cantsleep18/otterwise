#!/usr/bin/env bash
# validate-autopilot-state.sh
# Validates autopilot-state.json integrity after writes.
# Called as a PostToolUse hook on Write to catch corrupted or invalid state early.
#
# The state file is a lightweight control signal with three fields:
#   command   — "running", "pause", "resume", "abort", or "completed"
#   updatedAt — ISO 8601 timestamp
#   reason    — optional string (null allowed)
#
# Resource guards (safety ceilings) are checked against the separate
# autopilot.json session config, not the state file itself.
#
# Resource guard limits:
#   - ABSOLUTE_MAX_NODES: 20 — hard cap regardless of config
#   - MAX_CONCURRENT_TEAMS: 10 — prevents runaway team spawning
#   - MAX_TOTAL_AGENTS: 50 — absolute ceiling on total agent count

set -euo pipefail

STATE_FILE=".otterwise/autopilot-state.json"

# --- Resource guard constants ---
ABSOLUTE_MAX_NODES=20
MAX_CONCURRENT_TEAMS=10
MAX_TOTAL_AGENTS=50

# If no state file exists yet, nothing to validate
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Ensure the file is valid JSON
if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo "ERROR: $STATE_FILE is not valid JSON."
  exit 1
fi

# --- Required fields ---
MISSING=()
for field in command updatedAt; do
  val=$(jq -r ".$field // empty" "$STATE_FILE")
  if [ -z "$val" ]; then
    MISSING+=("$field")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: $STATE_FILE missing required fields: ${MISSING[*]}"
  exit 1
fi

# --- Command validation ---
COMMAND=$(jq -r '.command' "$STATE_FILE")
VALID_COMMANDS="running pause resume abort completed"

if ! echo "$VALID_COMMANDS" | grep -qw "$COMMAND"; then
  echo "ERROR: Invalid command '$COMMAND'. Must be one of: $VALID_COMMANDS"
  exit 1
fi

# --- Validate reason field type (string or null) ---
REASON_TYPE=$(jq -r '.reason | type' "$STATE_FILE" 2>/dev/null)
if [ "$REASON_TYPE" != "string" ] && [ "$REASON_TYPE" != "null" ]; then
  echo "ERROR: 'reason' field must be a string or null, got: $REASON_TYPE"
  exit 1
fi

# --- Resource guards (check autopilot.json session config if present) ---
CONFIG_FILE=".otterwise/autopilot.json"
if [ -f "$CONFIG_FILE" ] && jq empty "$CONFIG_FILE" 2>/dev/null; then
  # Max concurrent teams guard
  CONCURRENT=$(jq -r '.maxConcurrentTeammates // 0' "$CONFIG_FILE")
  if [ "$CONCURRENT" -gt "$MAX_CONCURRENT_TEAMS" ]; then
    echo "ERROR: maxConcurrentTeammates ($CONCURRENT) exceeds safety limit ($MAX_CONCURRENT_TEAMS)."
    exit 1
  fi

  # Max nodes guard
  MAX_N=$(jq -r '.maxNodes // 0' "$CONFIG_FILE")
  if [ "$MAX_N" -gt "$ABSOLUTE_MAX_NODES" ]; then
    echo "ERROR: maxNodes ($MAX_N) in config exceeds absolute safety limit ($ABSOLUTE_MAX_NODES)."
    exit 1
  fi

  # Nodes array length guard (append-only, should not exceed max nodes)
  TOTAL_NODES=$(jq '.nodes | length // 0' "$CONFIG_FILE" 2>/dev/null || echo 0)
  if [ "$TOTAL_NODES" -gt "$ABSOLUTE_MAX_NODES" ]; then
    echo "ERROR: nodes array length ($TOTAL_NODES) exceeds absolute safety limit ($ABSOLUTE_MAX_NODES)."
    exit 1
  fi

  # Total agents guard
  TOTAL_AGENTS=$(jq -r '.totalAgents // 0' "$CONFIG_FILE" 2>/dev/null || echo 0)
  if [ "$TOTAL_AGENTS" -gt "$MAX_TOTAL_AGENTS" ]; then
    echo "ERROR: totalAgents ($TOTAL_AGENTS) exceeds absolute safety limit ($MAX_TOTAL_AGENTS)."
    exit 1
  fi
fi

echo "OK: $STATE_FILE passed validation."
exit 0

#!/usr/bin/env bash
# validate-autopilot-state.sh
# Validates autopilot-state.json integrity after writes.
# Called as a PostToolUse hook to catch corrupted or invalid state early.
#
# Resource guard limits (absolute safety ceilings):
#   - ABSOLUTE_MAX_ROUNDS: 20 — hard cap regardless of config
#   - MAX_CONCURRENT_TEAMS: 10 — prevents runaway team spawning
#   - MAX_TOTAL_AGENTS: 50 — cap on total agents across all rounds
# These are last-resort safeguards. The autopilot config has its own
# user-facing limits (maxIterations, maxConcurrentTeammates) which should
# always be lower than these values.

set -euo pipefail

STATE_FILE=".otterwise/autopilot-state.json"

# --- Resource guard constants ---
ABSOLUTE_MAX_ROUNDS=20
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
for field in status currentRound maxRounds; do
  val=$(jq -r ".$field // empty" "$STATE_FILE")
  if [ -z "$val" ]; then
    MISSING+=("$field")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: $STATE_FILE missing required fields: ${MISSING[*]}"
  exit 1
fi

# --- Status validation ---
STATUS=$(jq -r '.status' "$STATE_FILE")
VALID_STATUSES="running paused pause_requested completed aborted abort_requested"

if ! echo "$VALID_STATUSES" | grep -qw "$STATUS"; then
  echo "ERROR: Invalid status '$STATUS'. Must be one of: $VALID_STATUSES"
  exit 1
fi

# --- Round bounds ---
CURRENT=$(jq -r '.currentRound' "$STATE_FILE")
MAX=$(jq -r '.maxRounds' "$STATE_FILE")

if [ "$CURRENT" -gt "$MAX" ]; then
  echo "ERROR: currentRound ($CURRENT) exceeds maxRounds ($MAX)."
  exit 1
fi

# --- Absolute safety ceiling on rounds ---
if [ "$MAX" -gt "$ABSOLUTE_MAX_ROUNDS" ]; then
  echo "ERROR: maxRounds ($MAX) exceeds absolute safety limit ($ABSOLUTE_MAX_ROUNDS)."
  exit 1
fi

if [ "$CURRENT" -gt "$ABSOLUTE_MAX_ROUNDS" ]; then
  echo "ERROR: currentRound ($CURRENT) exceeds absolute safety limit ($ABSOLUTE_MAX_ROUNDS)."
  exit 1
fi

# --- Resource guards (check config if present) ---
CONFIG_FILE=".otterwise/autopilot-config.json"
if [ -f "$CONFIG_FILE" ] && jq empty "$CONFIG_FILE" 2>/dev/null; then
  # Max concurrent teams guard
  CONCURRENT=$(jq -r '.maxConcurrentTeammates // 0' "$CONFIG_FILE")
  if [ "$CONCURRENT" -gt "$MAX_CONCURRENT_TEAMS" ]; then
    echo "ERROR: maxConcurrentTeammates ($CONCURRENT) exceeds safety limit ($MAX_CONCURRENT_TEAMS)."
    exit 1
  fi

  # Max iterations guard (redundant with round check, but catches config drift)
  MAX_ITER=$(jq -r '.maxIterations // 0' "$CONFIG_FILE")
  if [ "$MAX_ITER" -gt "$ABSOLUTE_MAX_ROUNDS" ]; then
    echo "ERROR: maxIterations ($MAX_ITER) in config exceeds absolute safety limit ($ABSOLUTE_MAX_ROUNDS)."
    exit 1
  fi
fi

# --- Agent count guard (check roundHistory for runaway spawning) ---
TOTAL_ROUNDS=$(jq '.roundHistory | length // 0' "$STATE_FILE" 2>/dev/null || echo 0)
if [ "$TOTAL_ROUNDS" -gt "$MAX_TOTAL_AGENTS" ]; then
  echo "ERROR: roundHistory length ($TOTAL_ROUNDS) exceeds max total agents safety limit ($MAX_TOTAL_AGENTS)."
  exit 1
fi

echo "OK: $STATE_FILE passed validation."
exit 0

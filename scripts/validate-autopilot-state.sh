#!/usr/bin/env bash
# validate-autopilot-state.sh
# Validates autopilot-state.json integrity after writes.
# Called as a PostToolUse hook on Write to catch corrupted or invalid state early.
#
# The state file is a lightweight control signal with three fields:
#   command   — "running", "pause", or "abort"
#   updatedAt — ISO 8601 timestamp
#   reason    — optional string (null allowed)

set -euo pipefail

STATE_FILE=".otterwise/autopilot-state.json"

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
VALID_COMMANDS="running pause abort"

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

echo "OK: $STATE_FILE passed validation."
exit 0

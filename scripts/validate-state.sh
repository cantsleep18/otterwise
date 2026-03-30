#!/usr/bin/env bash
# validate-state.sh
# Validates autopilot-state.json integrity after writes.
# Called as a PostToolUse hook on Write for all skills (research, continue, autopilot)
# to catch corrupted or invalid state early.
#
# The state file is a lightweight control signal with three fields:
#   command   — "running", "pause", or "abort"
#   updatedAt — ISO 8601 timestamp
#   reason    — optional string (null allowed)

set -euo pipefail

# Only validate autopilot-state.json writes; skip everything else
FILE_PATH="${TOOL_INPUT_file_path:-}"
if [[ "$FILE_PATH" != *autopilot-state.json ]]; then
  exit 0
fi

STATE_FILE=".otterwise/autopilot-state.json"

# If no state file exists yet, nothing to validate
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Ensure the file is valid JSON
if ! jq empty "$STATE_FILE" 2>/dev/null; then
  echo "ERROR: autopilot-state.json is not valid JSON"
  exit 1
fi

# --- Required fields ---
COMMAND=$(jq -r '.command // empty' "$STATE_FILE")
if [ -z "$COMMAND" ]; then
  echo "ERROR: missing required field 'command'"
  exit 1
fi

UPDATED_AT=$(jq -r '.updatedAt // empty' "$STATE_FILE")
if [ -z "$UPDATED_AT" ]; then
  echo "ERROR: missing required field 'updatedAt'"
  exit 1
fi

# --- Command validation ---
if [[ "$COMMAND" != "running" && "$COMMAND" != "pause" && "$COMMAND" != "abort" ]]; then
  echo "ERROR: invalid command '$COMMAND', must be one of: running, pause, abort"
  exit 1
fi

# --- Validate reason field type (string or null) ---
REASON_TYPE=$(jq -r '.reason | type' "$STATE_FILE" 2>/dev/null)
if [ "$REASON_TYPE" != "string" ] && [ "$REASON_TYPE" != "null" ]; then
  echo "ERROR: 'reason' field must be a string or null, got: $REASON_TYPE"
  exit 1
fi

echo "OK: autopilot-state.json passed validation."
exit 0

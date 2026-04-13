#!/bin/bash
# PreToolUse hook: block rm -rf on ~/.claude/teams/ and ~/.claude/tasks/
# Exit 2 = block command, Exit 0 = allow

COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

if echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr).*\.claude/(teams|tasks)'; then
  echo "BLOCKED: rm -rf on ~/.claude/ paths is forbidden. Use TeamDelete instead. If TeamDelete fails, ignore and continue."
  exit 2
fi

exit 0

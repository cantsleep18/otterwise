#!/usr/bin/env bash
# warn-summary-sources.sh
# PostToolUse hook (Write): warns if a summary.md lacks source/URL references.
# This is advisory only — always exits 0 so it never blocks.

FILE_PATH="${TOOL_INPUT_file_path:-}"

# Only check summary.md files
if [[ "$FILE_PATH" != *summary.md ]]; then
  exit 0
fi

# If the file doesn't exist (shouldn't happen post-Write, but be safe)
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Check for at least one URL or source reference
if grep -qiE '(https?://|source:|reference:|cited from)' "$FILE_PATH"; then
  exit 0
fi

echo "WARNING: $FILE_PATH contains no URL or source references. Consider adding sources to support findings."
exit 0

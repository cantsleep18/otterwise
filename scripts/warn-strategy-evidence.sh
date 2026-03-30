#!/usr/bin/env bash
# warn-strategy-evidence.sh
# PostToolUse hook (Write): warns if a strategy .md lacks data evidence.
# Checks for data tables, source callouts, and case sections.
# This is advisory only — always exits 0 so it never blocks.

FILE_PATH="${TOOL_INPUT_file_path:-}"

# Only check strategy files under .otterwise/strategies/
if [[ "$FILE_PATH" != *.otterwise/strategies/*.md ]]; then
  exit 0
fi

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

WARNINGS=()

# Check for data tables (markdown table syntax: | col | col |)
if ! grep -q '|.*|.*|' "$FILE_PATH"; then
  WARNINGS+=("No data tables found. Strategy should include date/price/event tables.")
fi

# Check for source callouts (> [!data] format)
if ! grep -q '> \[!data\]' "$FILE_PATH"; then
  WARNINGS+=("No source callouts found. Add '> [!data]- 원본 데이터' callouts.")
fi

# Check for case sections (### 사례 N:)
if ! grep -qE '^### (⚠️ )?사례 [0-9]+' "$FILE_PATH"; then
  WARNINGS+=("No case sections found. Add '### 사례 N: 종목명 (시기)' sections.")
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "WARNING: $FILE_PATH data evidence issues:"
  for w in "${WARNINGS[@]}"; do
    echo "  - $w"
  done
fi

exit 0

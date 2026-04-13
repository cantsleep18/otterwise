#!/usr/bin/env bash
# warn-strategy-evidence.sh
# PostToolUse hook (Write): warns if a strategy .md lacks backtest evidence.
# Checks for overnight return tables, aggregate metrics, and event counts.
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

# Check for overnight return table (6+ column table with 종가/익일시가 headers)
if ! grep -qE '\|.*종가.*익일시가.*\|' "$FILE_PATH" && ! grep -qE '\|.*\|.*\|.*\|.*\|.*\|' "$FILE_PATH"; then
  WARNINGS+=("No overnight return table found. Strategy should include 날짜|종목|이벤트|종가|익일시가|수익률 table.")
fi

# Check for aggregate metrics (profit_factor or PF)
if ! grep -qi 'profit_factor\|PF' "$FILE_PATH"; then
  WARNINGS+=("No aggregate metrics found. Add profit_factor/PF to 집계 section.")
fi

# Check for event count (총 N회 pattern)
if ! grep -qE '총.*회' "$FILE_PATH"; then
  WARNINGS+=("No event count found. Add '총 N회' to 집계 section.")
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "WARNING: $FILE_PATH data evidence issues:"
  for w in "${WARNINGS[@]}"; do
    echo "  - $w"
  done
fi

exit 0

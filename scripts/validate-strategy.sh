#!/usr/bin/env bash
# validate-strategy.sh
# Validates that strategy .md files in .otterwise/strategies/
# contain required YAML frontmatter fields and body sections.

set -euo pipefail

FILE_PATH="${TOOL_INPUT_file_path:-}"

# Only check strategy files under .otterwise/strategies/
if [[ "$FILE_PATH" != *.otterwise/strategies/*.md ]]; then
  exit 0
fi

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Check minimum content length (at least 200 characters for a strategy)
CHAR_COUNT=$(wc -c < "$FILE_PATH")
if [ "$CHAR_COUNT" -lt 200 ]; then
  echo "ERROR: $FILE_PATH is too short (${CHAR_COUNT} chars, minimum 200)."
  exit 1
fi

# --- YAML frontmatter validation ---
# Extract frontmatter (between first two --- lines)
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$FILE_PATH" | sed '1d;$d')

if [ -z "$FRONTMATTER" ]; then
  echo "ERROR: $FILE_PATH has no YAML frontmatter."
  exit 1
fi

MISSING_FM=()

if ! echo "$FRONTMATTER" | grep -q '^id:'; then
  MISSING_FM+=("id")
fi

if ! echo "$FRONTMATTER" | grep -q '^type:'; then
  MISSING_FM+=("type")
fi

if ! echo "$FRONTMATTER" | grep -q '^status:'; then
  MISSING_FM+=("status")
fi

if ! echo "$FRONTMATTER" | grep -q '^phenomenon:'; then
  MISSING_FM+=("phenomenon")
fi

if ! echo "$FRONTMATTER" | grep -q '^researchMode:'; then
  MISSING_FM+=("researchMode")
fi

if ! echo "$FRONTMATTER" | grep -q '^tags:'; then
  MISSING_FM+=("tags")
fi

if ! echo "$FRONTMATTER" | grep -q '^backtest:'; then
  MISSING_FM+=("backtest")
fi

if [ ${#MISSING_FM[@]} -gt 0 ]; then
  echo "ERROR: $FILE_PATH frontmatter is missing required fields:"
  for field in "${MISSING_FM[@]}"; do
    echo "  - $field"
  done
  exit 1
fi

# Validate type value
TYPE_VAL=$(echo "$FRONTMATTER" | grep '^type:' | sed 's/^type:\s*//')
if [[ "$TYPE_VAL" != *seed* ]] && [[ "$TYPE_VAL" != *derive* ]] && [[ "$TYPE_VAL" != *explore* ]] && [[ "$TYPE_VAL" != *combine* ]]; then
  echo "ERROR: $FILE_PATH has invalid type '$TYPE_VAL' (must be seed, derive, explore, or combine)."
  exit 1
fi

# Validate status value
STATUS_VAL=$(echo "$FRONTMATTER" | grep '^status:' | sed 's/^status:\s*//')
if [[ "$STATUS_VAL" != *draft* ]] && [[ "$STATUS_VAL" != *developing* ]] && [[ "$STATUS_VAL" != *established* ]] && [[ "$STATUS_VAL" != *archived* ]]; then
  echo "ERROR: $FILE_PATH has invalid status '$STATUS_VAL' (must be draft, developing, established, or archived)."
  exit 1
fi

# --- Backtest sub-field validation ---
# Extract the backtest block from frontmatter (indented lines after backtest:)
BACKTEST_BLOCK=$(echo "$FRONTMATTER" | sed -n '/^backtest:/,/^[^ ]/p' | tail -n +2 | grep '^ ')

MISSING_BT=()
INVALID_BT=()

# Fields that must exist (no numeric check)
for field in tickers period; do
  if ! echo "$BACKTEST_BLOCK" | grep -q "^  ${field}:"; then
    MISSING_BT+=("backtest.$field")
  fi
done

# Fields that must exist and be numeric
for field in trades winners losers win_rate_pct avg_return_pct profit_factor max_consecutive_losses fee_applied_pct; do
  if ! echo "$BACKTEST_BLOCK" | grep -q "^  ${field}:"; then
    MISSING_BT+=("backtest.$field")
  else
    VAL=$(echo "$BACKTEST_BLOCK" | grep "^  ${field}:" | sed 's/^  '"${field}"':\s*//')
    if ! echo "$VAL" | grep -qE '^-?[0-9]+\.?[0-9]*$'; then
      INVALID_BT+=("backtest.$field (got '$VAL', expected numeric)")
    fi
  fi
done

if [ ${#MISSING_BT[@]} -gt 0 ]; then
  echo "ERROR: $FILE_PATH backtest block is missing required fields:"
  for field in "${MISSING_BT[@]}"; do
    echo "  - $field"
  done
  exit 1
fi

if [ ${#INVALID_BT[@]} -gt 0 ]; then
  echo "ERROR: $FILE_PATH backtest block has non-numeric fields:"
  for field in "${INVALID_BT[@]}"; do
    echo "  - $field"
  done
  exit 1
fi

# --- Required body sections ---
MISSING_SECTIONS=()

if ! grep -q '^## 현상' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 현상")
fi

if ! grep -q '^## 이벤트 발생일 및 종가베팅 결과' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 이벤트 발생일 및 종가베팅 결과")
fi

if ! grep -q '^## 집계' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 집계")
fi

if ! grep -q '^## 해석' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 해석")
fi

if ! grep -q '^## 한계 및 주의사항' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 한계 및 주의사항")
fi

if [ ${#MISSING_SECTIONS[@]} -gt 0 ]; then
  echo "ERROR: $FILE_PATH is missing required sections:"
  for section in "${MISSING_SECTIONS[@]}"; do
    echo "  - $section"
  done
  exit 1
fi

echo "OK: $FILE_PATH passed strategy validation."
exit 0

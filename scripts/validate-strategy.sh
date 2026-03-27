#!/usr/bin/env bash
# validate-strategy.sh
# Validates that strategy .md files in .otterwise/strategies/
# contain required YAML frontmatter fields and body sections.

set -euo pipefail

FILE_PATH="${TOOL_INPUT_file_path:-}"

# Only check strategy files under .otterwise/strategies/ (not look/ or discarded/)
if [[ "$FILE_PATH" != *.otterwise/strategies/*.md ]]; then
  exit 0
fi
# Skip subdirectory files (look/, research-log/, discarded/)
BASENAME_DIR=$(dirname "$FILE_PATH")
if [[ "$BASENAME_DIR" == */look ]] || [[ "$BASENAME_DIR" == */research-log ]] || [[ "$BASENAME_DIR" == */discarded ]]; then
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

# --- Required body sections ---
MISSING_SECTIONS=()

if ! grep -q '^## 현상' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 현상")
fi

if ! grep -q '^## 가격 관찰' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 가격 관찰")
fi

if ! grep -q '^## 해석' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 해석")
fi

if ! grep -q '^## 전략 아이디어' "$FILE_PATH"; then
  MISSING_SECTIONS+=("## 전략 아이디어")
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

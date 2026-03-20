#!/usr/bin/env bash
# validate-finding.sh
# Validates that finding-*.md files in .otterwise/ contain required
# YAML frontmatter fields and an Evidence section.

set -euo pipefail

OTTERWISE_DIR=".otterwise"

# No .otterwise directory yet — might be a non-research task
if [ ! -d "$OTTERWISE_DIR" ]; then
  exit 0
fi

# Find the most recently modified finding-*.md under .otterwise/
FINDING=$(find "$OTTERWISE_DIR" -name "finding-*.md" -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn \
  | head -n1 \
  | cut -d' ' -f2-)

if [ -z "$FINDING" ]; then
  # No finding files found — might be a non-research task
  exit 0
fi

# Check minimum content length (at least 100 characters)
CHAR_COUNT=$(wc -c < "$FINDING")
if [ "$CHAR_COUNT" -lt 100 ]; then
  echo "ERROR: $FINDING is too short (${CHAR_COUNT} chars, minimum 100)."
  exit 1
fi

# Verify YAML frontmatter exists (file starts with ---)
if ! head -n1 "$FINDING" | grep -q '^---$'; then
  echo "ERROR: $FINDING is missing YAML frontmatter (must start with ---)."
  exit 1
fi

# Extract frontmatter block (between first and second ---)
FRONTMATTER=$(awk 'BEGIN{in_fm=0} /^---$/{if(in_fm){exit}else{in_fm=1;next}} in_fm{print}' "$FINDING")

# Required frontmatter fields
MISSING=()

for field in id exploration agent confidence tags; do
  if ! echo "$FRONTMATTER" | grep -qE "^${field}:"; then
    MISSING+=("$field")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: $FINDING is missing required frontmatter fields:"
  for field in "${MISSING[@]}"; do
    echo "  - $field"
  done
  exit 1
fi

# Check for Evidence section
if ! grep -qiE '^#{1,2}\s+Evidence' "$FINDING"; then
  MISSING+=("'## Evidence' section")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: $FINDING is missing required sections:"
  for section in "${MISSING[@]}"; do
    echo "  - $section"
  done
  exit 1
fi

echo "OK: $FINDING passed validation."
exit 0

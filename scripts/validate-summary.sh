#!/usr/bin/env bash
# validate-summary.sh
# Validates that the most recently modified summary.md in .otterwise/
# contains all required sections and meets minimum content length.

set -euo pipefail

OTTERWISE_DIR=".otterwise"

# Find the most recently modified summary.md under .otterwise/
if [ ! -d "$OTTERWISE_DIR" ]; then
  # No .otterwise directory yet — might be a non-research task
  exit 0
fi

SUMMARY=$(find "$OTTERWISE_DIR" -name "summary.md" -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn \
  | head -n1 \
  | cut -d' ' -f2-)

if [ -z "$SUMMARY" ]; then
  # No summary.md found — might be a non-research task
  exit 0
fi

# Check minimum content length (at least 100 characters)
CHAR_COUNT=$(wc -c < "$SUMMARY")
if [ "$CHAR_COUNT" -lt 100 ]; then
  echo "ERROR: $SUMMARY is too short (${CHAR_COUNT} chars, minimum 100)."
  exit 1
fi

# Required sections — each entry is a grep pattern and a human-readable label
MISSING=()

if ! grep -qiE '^#{1,2}\s+(Investigation:|Objective)' "$SUMMARY"; then
  MISSING+=("'# Investigation:' or '## Objective'")
fi

if ! grep -qiE '^#{1,2}\s+Approach' "$SUMMARY"; then
  MISSING+=("'## Approach'")
fi

if ! grep -qiE '^#{1,2}\s+Key Findings' "$SUMMARY"; then
  MISSING+=("'## Key Findings'")
fi

if ! grep -qiE '^#{1,2}\s+Confidence' "$SUMMARY"; then
  MISSING+=("'## Confidence'")
fi

if ! grep -qiE '^#{1,2}\s+Dead Ends' "$SUMMARY"; then
  MISSING+=("'## Dead Ends'")
fi

if ! grep -qiE '^#{1,2}\s+Suggested Follow-ups' "$SUMMARY"; then
  MISSING+=("'## Suggested Follow-ups'")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: $SUMMARY is missing required sections:"
  for section in "${MISSING[@]}"; do
    echo "  - $section"
  done
  exit 1
fi

echo "OK: $SUMMARY passed validation."
exit 0

#!/usr/bin/env bash
# validate-skill-md-research.sh
# Validates skills/research/SKILL.md structural integrity.
# Tests: YAML frontmatter, OLJC phases, strategy template, research modes,
#        Teams API operations, data evidence rules, Korean content, Obsidian compat.
# Research is single-shot (no infinite loop, no RESUME phase).

set -euo pipefail

SKILL_FILE="${1:-skills/research/SKILL.md}"
PASS=0
FAIL=0
ERRORS=()

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+=("$1"); echo "  FAIL: $1"; }

# ── 1. YAML Frontmatter Validation ──────────────────────────────

echo "=== 1. YAML Frontmatter ==="

if [ ! -f "$SKILL_FILE" ]; then
  fail "SKILL.md not found at $SKILL_FILE"
  echo "RESULT: 0 passed, 1 failed"
  exit 1
fi

if head -1 "$SKILL_FILE" | grep -q '^---$'; then
  pass "Frontmatter opening delimiter"
else
  fail "Missing opening '---' delimiter"
fi

CLOSING_LINE=$(awk '/^---$/{n++; if(n==2){print NR; exit}}' "$SKILL_FILE")
if [ -n "$CLOSING_LINE" ]; then
  pass "Frontmatter closing delimiter at line $CLOSING_LINE"
else
  fail "Missing closing '---' delimiter"
fi

if grep -qP '^name:\s+\S' "$SKILL_FILE"; then
  pass "Frontmatter has 'name' field"
else
  fail "Missing 'name' field in frontmatter"
fi

if grep -qP '^description:\s+\S' "$SKILL_FILE"; then
  pass "Frontmatter has 'description' field"
else
  fail "Missing 'description' field in frontmatter"
fi

NAME_VAL=$(awk '/^name:/{print $2; exit}' "$SKILL_FILE")
if [ "$NAME_VAL" = "research" ]; then
  pass "Frontmatter name is 'research'"
else
  fail "Frontmatter name is '$NAME_VAL', expected 'research'"
fi

# ── 2. Strategy Template Sections ────────────────────────────────

echo ""
echo "=== 2. Strategy Template Sections ==="

STRATEGY_SECTIONS=(
  "관련 전략"
  "현상"
  "가격 관찰"
  "해석"
  "전략 아이디어"
  "한계 및 주의사항"
)

for section in "${STRATEGY_SECTIONS[@]}"; do
  if grep -q "## $section" "$SKILL_FILE"; then
    pass "Strategy template references '## $section'"
  else
    fail "Strategy template missing '## $section' section"
  fi
done

# Check strategy frontmatter fields are documented
STRATEGY_FM_FIELDS=("id" "type" "status" "phenomenon" "researchMode" "tags")

for field in "${STRATEGY_FM_FIELDS[@]}"; do
  if grep -q "$field" "$SKILL_FILE"; then
    pass "Strategy frontmatter documents '$field'"
  else
    fail "Strategy frontmatter missing '$field' field"
  fi
done

# ── 3. Research Modes (all 10) ───────────────────────────────────

echo ""
echo "=== 3. Research Modes ==="

MODES=(
  "brute_force"
  "news_replay"
  "condition_combo"
  "anomaly_detection"
  "copycat"
  "narrative_shift"
  "consensus_gap"
  "supply_chain"
  "regulatory"
  "behavioral"
)

MODE_COUNT=0
for mode in "${MODES[@]}"; do
  if grep -q "$mode" "$SKILL_FILE"; then
    pass "Mode '$mode' referenced"
    MODE_COUNT=$((MODE_COUNT + 1))
  else
    fail "Mode '$mode' NOT referenced"
  fi
done

if [ "$MODE_COUNT" -eq 10 ]; then
  pass "All 10 research modes present"
else
  fail "Only $MODE_COUNT/10 research modes found"
fi

# ── 4. OLJC Flow Completeness ────────────────────────────────────

echo ""
echo "=== 4. OLJC Flow ==="

PHASES=("OBSERVE" "LOOK" "JUDGE" "CRYSTALLIZE" "ROUTE")

for phase in "${PHASES[@]}"; do
  if grep -qP "^## (Phase: )?$phase" "$SKILL_FILE" || grep -qP "^## $phase " "$SKILL_FILE"; then
    pass "Phase '$phase' section exists"
  else
    fail "Phase '$phase' section missing"
  fi
done

# Check INIT phase exists (research has INIT for first-run setup)
if grep -qP "^## (Phase: )?INIT" "$SKILL_FILE"; then
  pass "INIT phase section exists"
else
  fail "INIT phase section missing"
fi

# Check RESUME does NOT exist (research is single-shot, no resume)
if grep -qP "^## (Phase: )?RESUME" "$SKILL_FILE"; then
  fail "RESUME phase found -- research should NOT have RESUME"
else
  pass "No RESUME phase (correct for single-shot research)"
fi

# Research is single-shot: should NOT have infinite loop language
if grep -qi "never self-terminates\|infinite loop\|Only.*abort stops\|loop never ends" "$SKILL_FILE"; then
  fail "Infinite loop language found -- research is single-shot, not infinite"
else
  pass "No infinite loop language (correct for single-shot research)"
fi

# ── 5. Teams API Lifecycle ───────────────────────────────────────

echo ""
echo "=== 5. Teams API Lifecycle ==="

TEAMS_OPS=("TeamCreate" "TaskCreate" "Agent" "TaskList" "SendMessage" "TeamDelete")
for op in "${TEAMS_OPS[@]}"; do
  if grep -q "$op" "$SKILL_FILE"; then
    pass "Teams API operation '$op' referenced"
  else
    fail "Teams API operation '$op' missing"
  fi
done

# ── 6. Data Evidence Rules ───────────────────────────────────────

echo ""
echo "=== 6. Data Evidence Rules ==="

if grep -q '\[!data\]' "$SKILL_FILE"; then
  pass "Data callout syntax [!data] documented"
else
  fail "Data callout syntax [!data] missing"
fi

# ── 7. Additional Structural Checks ─────────────────────────────

echo ""
echo "=== 7. Additional Checks ==="

# Korean content reference
if grep -q "Korean\|한국\|한글" "$SKILL_FILE"; then
  pass "Korean content requirement noted"
else
  fail "Korean content requirement missing"
fi

# Obsidian compatibility (wikilinks, callouts, tags)
if grep -q "wikilink\|Obsidian\|\[\[" "$SKILL_FILE"; then
  pass "Obsidian compatibility referenced"
else
  fail "Obsidian compatibility not referenced"
fi

# ── Summary ──────────────────────────────────────────────────────

echo ""
echo "========================================"
echo "RESULT: $PASS passed, $FAIL failed"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failures:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi

exit 0

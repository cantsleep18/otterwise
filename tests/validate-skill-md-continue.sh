#!/usr/bin/env bash
# validate-skill-md-continue.sh
# Validates skills/continue/SKILL.md structural integrity.
# Tests: YAML frontmatter, OLJC phases, LOAD phase, expansion types,
#        autopilot-state.json handling, user override flow, Teams API,
#        data evidence rules, Korean content, Obsidian compat.
# Continue is single-shot (no infinite loop, no INIT or RESUME phases).

set -euo pipefail

SKILL_FILE="${1:-skills/continue/SKILL.md}"
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
if [ "$NAME_VAL" = "continue" ]; then
  pass "Frontmatter name is 'continue'"
else
  fail "Frontmatter name is '$NAME_VAL', expected 'continue'"
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

# Check LOAD phase exists (continue loads existing DAG state)
if grep -qP "^## (Phase: )?LOAD" "$SKILL_FILE"; then
  pass "LOAD phase section exists"
else
  fail "LOAD phase section missing"
fi

# Check INIT does NOT exist (continue doesn't initialize, it loads)
if grep -qP "^## (Phase: )?INIT" "$SKILL_FILE"; then
  fail "INIT phase found -- continue should NOT have INIT (use LOAD instead)"
else
  pass "No INIT phase (correct for continue)"
fi

# Check RESUME does NOT exist
if grep -qP "^## (Phase: )?RESUME" "$SKILL_FILE"; then
  fail "RESUME phase found -- continue should NOT have RESUME"
else
  pass "No RESUME phase (correct for continue)"
fi

# Continue is single-shot: should NOT have infinite loop language
if grep -qi "never self-terminates\|infinite loop\|Only.*abort stops\|loop never ends" "$SKILL_FILE"; then
  fail "Infinite loop language found -- continue is single-shot, not infinite"
else
  pass "No infinite loop language (correct for single-shot continue)"
fi

# ── 5. Expansion Types ──────────────────────────────────────────

echo ""
echo "=== 5. Expansion Types ==="

EXPANSION_TYPES=("seed" "derive" "explore" "combine")
for etype in "${EXPANSION_TYPES[@]}"; do
  if grep -q "\`$etype\`" "$SKILL_FILE"; then
    pass "Expansion type '$etype' defined"
  else
    fail "Expansion type '$etype' missing"
  fi
done

# ── 6. autopilot-state.json Handling ────────────────────────────

echo ""
echo "=== 6. Autopilot State Handling ==="

if grep -q "autopilot-state.json" "$SKILL_FILE"; then
  pass "autopilot-state.json referenced"
else
  fail "autopilot-state.json not referenced"
fi

# ── 7. User Override / User-Directed Flow ────────────────────────

echo ""
echo "=== 7. User Override Flow ==="

if grep -qi "user.*override\|user.*direct\|user.*focus\|user.*specif" "$SKILL_FILE"; then
  pass "User override / user-directed flow referenced"
else
  fail "User override / user-directed flow not referenced"
fi

# ── 8. Teams API Lifecycle ───────────────────────────────────────

echo ""
echo "=== 8. Teams API Lifecycle ==="

TEAMS_OPS=("TeamCreate" "TaskCreate" "Agent" "TaskList" "SendMessage" "TeamDelete")
for op in "${TEAMS_OPS[@]}"; do
  if grep -q "$op" "$SKILL_FILE"; then
    pass "Teams API operation '$op' referenced"
  else
    fail "Teams API operation '$op' missing"
  fi
done

# ── 9. Data Evidence Rules ───────────────────────────────────────

echo ""
echo "=== 9. Data Evidence Rules ==="

if grep -q '\[!data\]' "$SKILL_FILE"; then
  pass "Data callout syntax [!data] documented"
else
  fail "Data callout syntax [!data] missing"
fi

# ── 10. Additional Structural Checks ────────────────────────────

echo ""
echo "=== 10. Additional Checks ==="

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

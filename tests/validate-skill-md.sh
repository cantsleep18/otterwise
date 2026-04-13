#!/usr/bin/env bash
# validate-skill-md.sh  (autopilot-specific)
# Validates skills/autopilot/SKILL.md structural integrity after assembly.
# For research and continue validators, see validate-skill-md-research.sh
# and validate-skill-md-continue.sh respectively.
# Tests: YAML frontmatter, strategy template sections, research modes,
#        OLJC flow completeness, autopilot-state.json checks between phases.

set -euo pipefail

SKILL_FILE="${1:-skills/autopilot/SKILL.md}"
PASS=0
FAIL=0
ERRORS=()

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+=("$1"); echo "  FAIL: $1"; }

# ── 1. YAML Frontmatter Validation ──────────────────────────────

echo "=== 1. YAML Frontmatter ==="

# Check file exists
if [ ! -f "$SKILL_FILE" ]; then
  fail "SKILL.md not found at $SKILL_FILE"
  echo "RESULT: 0 passed, 1 failed"
  exit 1
fi

# Check starts with ---
if head -1 "$SKILL_FILE" | grep -q '^---$'; then
  pass "Frontmatter opening delimiter"
else
  fail "Missing opening '---' delimiter"
fi

# Check closing ---
CLOSING_LINE=$(awk '/^---$/{n++; if(n==2){print NR; exit}}' "$SKILL_FILE")
if [ -n "$CLOSING_LINE" ]; then
  pass "Frontmatter closing delimiter at line $CLOSING_LINE"
else
  fail "Missing closing '---' delimiter"
fi

# Check required frontmatter fields
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

# Check name value is "autopilot"
NAME_VAL=$(awk '/^name:/{print $2; exit}' "$SKILL_FILE")
if [ "$NAME_VAL" = "autopilot" ]; then
  pass "Frontmatter name is 'autopilot'"
else
  fail "Frontmatter name is '$NAME_VAL', expected 'autopilot'"
fi

# ── 2. Strategy Template Sections ────────────────────────────────

echo ""
echo "=== 2. Strategy Template Sections ==="

# These are the required sections in strategy.md output (CRYSTALLIZE phase)
STRATEGY_SECTIONS=(
  "관련 전략"
  "현상"
  "이벤트 발생일 및 종가베팅 결과"
  "집계"
  "해석"
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
STRATEGY_FM_FIELDS=("id" "type" "status" "phenomenon" "researchMode" "tags" "backtest")

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

# Check Mode Objectives table exists
if grep -q "## Mode Objectives" "$SKILL_FILE" || grep -q "Mode.*Objectives" "$SKILL_FILE"; then
  pass "Mode Objectives section exists"
else
  fail "Mode Objectives section missing"
fi

# Check each mode has OBSERVE and LOOK focus in the table
for mode in "${MODES[@]}"; do
  # Check mode appears in a table row (pipe-delimited)
  if grep -qP "^\|.*\`$mode\`.*\|" "$SKILL_FILE"; then
    pass "Mode '$mode' has table entry"
  else
    fail "Mode '$mode' missing from Mode Objectives table"
  fi
done

# ── 4. OLJC Flow Completeness ────────────────────────────────────

echo ""
echo "=== 4. OLJC Flow ==="

# Check all OLJC phases exist as section headers
PHASES=("OBSERVE" "LOOK" "JUDGE" "CRYSTALLIZE" "ROUTE")

for phase in "${PHASES[@]}"; do
  if grep -qP "^## (Phase: )?$phase" "$SKILL_FILE" || grep -qP "^## $phase " "$SKILL_FILE"; then
    pass "Phase '$phase' section exists"
  else
    fail "Phase '$phase' section missing"
  fi
done

# Check INIT and RESUME exist
if grep -qP "^## Phase: INIT" "$SKILL_FILE"; then
  pass "INIT phase section exists"
else
  fail "INIT phase section missing"
fi

if grep -qP "^## Phase: RESUME" "$SKILL_FILE"; then
  pass "RESUME phase section exists"
else
  fail "RESUME phase section missing"
fi

# Check flow diagram shows OLJC order
if grep -q "ROUTE.*OBSERVE.*LOOK.*JUDGE.*CRYSTALLIZE" "$SKILL_FILE"; then
  pass "Workflow diagram shows ROUTE→OBSERVE→LOOK→JUDGE→CRYSTALLIZE order"
else
  fail "Workflow diagram does not show correct OLJC order"
fi

# Check CRYSTALLIZE returns to ROUTE (infinite loop)
if grep -q "Return to ROUTE" "$SKILL_FILE" || grep -q "CRYSTALLIZE.*ROUTE" "$SKILL_FILE"; then
  pass "CRYSTALLIZE returns to ROUTE (infinite loop)"
else
  fail "Missing CRYSTALLIZE→ROUTE loop back"
fi

# Check JUDGE has two outcomes: WRITE and SKIP
if grep -q "WRITE" "$SKILL_FILE" && grep -q "SKIP" "$SKILL_FILE"; then
  pass "JUDGE has WRITE and SKIP outcomes"
else
  fail "JUDGE missing WRITE/SKIP outcomes"
fi

# Check SKIP returns to ROUTE
if grep -q "SKIP.*ROUTE\|SKIP.*return to ROUTE\|SKIP.*log.*ROUTE" "$SKILL_FILE"; then
  pass "SKIP outcome returns to ROUTE"
else
  fail "SKIP outcome does not clearly return to ROUTE"
fi

# Check expansion types are defined
EXPANSION_TYPES=("seed" "derive" "explore" "combine")
for etype in "${EXPANSION_TYPES[@]}"; do
  if grep -q "\`$etype\`" "$SKILL_FILE"; then
    pass "Expansion type '$etype' defined"
  else
    fail "Expansion type '$etype' missing"
  fi
done

# ── 5. autopilot-state.json Checks Between Phases ────────────────

echo ""
echo "=== 5. State Checks ==="

# Check that autopilot-state.json is mentioned
if grep -q "autopilot-state.json" "$SKILL_FILE"; then
  pass "autopilot-state.json referenced in SKILL.md"
else
  fail "autopilot-state.json not referenced"
fi

# Count "State check" or "autopilot-state.json" references in phase sections
# Each OLJC phase should reference state checking
STATE_CHECK_COUNT=$(grep -c "State check\|autopilot-state.json" "$SKILL_FILE" || true)
if [ "$STATE_CHECK_COUNT" -ge 5 ]; then
  pass "State checks referenced $STATE_CHECK_COUNT times (need >= 5 for all phases + global)"
else
  fail "State checks only referenced $STATE_CHECK_COUNT times (need >= 5)"
fi

# Check the three valid commands are documented
for cmd in "running" "pause" "abort"; do
  if grep -q "\"$cmd\"" "$SKILL_FILE"; then
    pass "Command '$cmd' documented"
  else
    fail "Command '$cmd' not documented"
  fi
done

# Check pause behavior (wait loop)
if grep -q "wait.*loop\|re-read every\|wait loop\|10 seconds" "$SKILL_FILE"; then
  pass "Pause wait loop behavior documented"
else
  fail "Pause wait loop behavior not documented"
fi

# Check abort behavior (set aborted + stop)
if grep -q "aborted.*stop\|status.*aborted" "$SKILL_FILE"; then
  pass "Abort behavior (set aborted + stop) documented"
else
  fail "Abort behavior not documented"
fi

# ── 6. Teams API Lifecycle ───────────────────────────────────────

echo ""
echo "=== 6. Teams API Lifecycle ==="

TEAMS_OPS=("TeamCreate" "TaskCreate" "Agent" "TaskList" "SendMessage" "TeamDelete")
for op in "${TEAMS_OPS[@]}"; do
  if grep -q "$op" "$SKILL_FILE"; then
    pass "Teams API operation '$op' referenced"
  else
    fail "Teams API operation '$op' missing"
  fi
done

# Check bypassPermissions is mentioned
if grep -q "bypassPermissions" "$SKILL_FILE"; then
  pass "bypassPermissions mode referenced"
else
  fail "bypassPermissions mode not referenced"
fi

# Check run_in_background
if grep -q "run_in_background" "$SKILL_FILE"; then
  pass "run_in_background referenced"
else
  fail "run_in_background not referenced"
fi

# ── 7. Artifact Structure ──────────────────────────────────────

echo ""
echo "=== 7. Artifact Structure ==="

# Check new ID format: YYYYMMDD_HHMM_{8hex} (literal description or actual example)
if grep -qP 'YYYYMMDD_HHMM_\{?8hex\}?|\d{8}_\d{4}_[a-f0-9]{8}' "$SKILL_FILE"; then
  pass "New ID format YYYYMMDD_HHMM_{8hex} referenced"
else
  fail "New ID format YYYYMMDD_HHMM_{8hex} not referenced"
fi

# Check old ID format description is NOT present (YYYYMMDD_{8hex} without HHMM)
if grep -qP 'YYYYMMDD_\{?8hex\}?' "$SKILL_FILE" && ! grep -qP 'YYYYMMDD_HHMM' "$SKILL_FILE"; then
  fail "Old ID format YYYYMMDD_{8hex} still present (should be YYYYMMDD_HHMM_{8hex})"
else
  pass "No old ID format YYYYMMDD_{8hex} found"
fi

# Check artifacts/ directory referenced
if grep -q "artifacts/" "$SKILL_FILE"; then
  pass "artifacts/ directory referenced"
else
  fail "artifacts/ directory not referenced"
fi

# Check old directory paths NOT present
if grep -q "strategies/look/" "$SKILL_FILE"; then
  fail "Old path strategies/look/ still present"
else
  pass "No old strategies/look/ path"
fi

if grep -q "strategies/research-log/" "$SKILL_FILE"; then
  fail "Old path strategies/research-log/ still present"
else
  pass "No old strategies/research-log/ path"
fi

# Check phase file naming: 01_discovery, 02_evidence, 03_evaluation
PHASE_FILES=("01_discovery" "02_evidence" "03_evaluation")
for pf in "${PHASE_FILES[@]}"; do
  if grep -q "$pf" "$SKILL_FILE"; then
    pass "Phase file '$pf' referenced"
  else
    fail "Phase file '$pf' not referenced"
  fi
done

# Check no discarded/ directory
if grep -q "discarded/" "$SKILL_FILE"; then
  fail "discarded/ directory still referenced (should be removed)"
else
  pass "No discarded/ directory reference"
fi

# ── 8. Additional Structural Checks ─────────────────────────────

echo ""
echo "=== 8. Additional Checks ==="

# Check Error Handling section exists
if grep -q "## Error Handling" "$SKILL_FILE"; then
  pass "Error Handling section exists"
else
  fail "Error Handling section missing"
fi

# Check State Management section exists
if grep -q "## State Management" "$SKILL_FILE"; then
  pass "State Management section exists"
else
  fail "State Management section missing"
fi

# Check Important Rules section
if grep -q "## Important Rules" "$SKILL_FILE"; then
  pass "Important Rules section exists"
else
  fail "Important Rules section missing"
fi

# Check loop never self-terminates rule
if grep -q "never self-terminates\|Only.*abort stops" "$SKILL_FILE"; then
  pass "Infinite loop rule documented"
else
  fail "Infinite loop rule missing"
fi

# Check directory structure documents key paths
KEY_PATHS=("config.json" "autopilot.json" "autopilot-state.json" "error.log" "artifacts/")
for kp in "${KEY_PATHS[@]}"; do
  if grep -q "$kp" "$SKILL_FILE"; then
    pass "Path '$kp' documented"
  else
    fail "Path '$kp' not documented"
  fi
done

# Check Korean content requirement
if grep -q "Korean\|한국\|Korean" "$SKILL_FILE"; then
  pass "Korean content requirement noted"
else
  fail "Korean content requirement missing"
fi

# Check Obsidian compatibility (wikilinks, callouts, tags)
if grep -q "wikilink\|Obsidian\|\[\[" "$SKILL_FILE"; then
  pass "Obsidian compatibility referenced"
else
  fail "Obsidian compatibility not referenced"
fi

# Check backtest evidence rules
if grep -q 'profit_factor\|PF' "$SKILL_FILE"; then
  pass "Backtest metric profit_factor/PF referenced"
else
  fail "Backtest metric profit_factor/PF missing"
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

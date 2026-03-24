#!/usr/bin/env bash
# secure-update.sh — Secure update orchestrator for Otterwise marketplace plugin
#
# Fetches latest from remote, compares versions, pulls if needed,
# runs migration, clears plugin cache, and validates integrity.
#
# Usage:
#   bash scripts/secure-update.sh              # Full update flow
#   bash scripts/secure-update.sh pre-update   # Security checks only (legacy)
#   bash scripts/secure-update.sh post-update  # Post-update validation only (legacy)
#
# Exit codes:
#   0 = update applied successfully
#   1 = error (network, merge conflict, validation failure)
#   2 = no update needed (already at latest version)

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$PLUGIN_ROOT/.otterwise/update-backup"
PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
CACHE_DIR="${HOME}/.claude/plugins/cache/otterwise"
PHASE="${1:-update}"

# Expected remote origin — MUST match the canonical repository
EXPECTED_REMOTE="https://github.com/cantsleep18/otterwise.git"
EXPECTED_REMOTE_SSH="git@github.com:cantsleep18/otterwise.git"

# Allowed hook script paths (relative to PLUGIN_ROOT)
ALLOWED_HOOK_SCRIPTS=(
  "scripts/validate-summary.sh"
  "scripts/validate-autopilot-state.sh"
)

# Allowed permissions in settings.json
ALLOWED_PERMISSIONS=(
)

# --- Helpers ---------------------------------------------------------------

fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1" >&2; }
pass() { printf '  \033[32m  OK\033[0m  %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }
info() { printf '  \033[36mINFO\033[0m  %s\n' "$1"; }

check_jq() {
  command -v jq >/dev/null 2>&1 || { fail "jq not found — cannot validate JSON configs"; return 1; }
}

# Read version from a plugin.json (file path or git ref)
read_version() {
  local source="$1"
  if [ -f "$source" ]; then
    jq -r '.version // "unknown"' "$source" 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

# Read version from remote ref without checkout
read_remote_version() {
  git -C "$PLUGIN_ROOT" show origin/main:.claude-plugin/plugin.json 2>/dev/null \
    | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown"
}

# --- Pre-update checks -----------------------------------------------------

verify_remote_origin() {
  local REMOTE_URL
  REMOTE_URL=$(git -C "$PLUGIN_ROOT" remote get-url origin 2>/dev/null || echo "")

  if [ -z "$REMOTE_URL" ]; then
    fail "No git remote 'origin' configured"
    return 1
  fi

  # Normalize: strip trailing slashes and .git suffix for comparison
  local NORMALIZED EXPECTED_NORM EXPECTED_SSH_NORM
  NORMALIZED=$(echo "$REMOTE_URL" | sed 's/\/$//' | sed 's/\.git$//')
  EXPECTED_NORM=$(echo "$EXPECTED_REMOTE" | sed 's/\/$//' | sed 's/\.git$//')
  EXPECTED_SSH_NORM=$(echo "$EXPECTED_REMOTE_SSH" | sed 's/\/$//' | sed 's/\.git$//')

  if [ "$NORMALIZED" = "$EXPECTED_NORM" ] || [ "$NORMALIZED" = "$EXPECTED_SSH_NORM" ]; then
    pass "Remote origin verified: $REMOTE_URL"
    return 0
  fi

  if [ "$REMOTE_URL" = "$EXPECTED_REMOTE" ] || [ "$REMOTE_URL" = "$EXPECTED_REMOTE_SSH" ]; then
    pass "Remote origin verified: $REMOTE_URL"
    return 0
  fi

  fail "Remote origin does not match expected repository"
  fail "  Expected: $EXPECTED_REMOTE"
  fail "  Got:      $REMOTE_URL"
  return 1
}

check_dirty_workdir() {
  local STATUS
  STATUS=$(git -C "$PLUGIN_ROOT" status --porcelain 2>/dev/null || echo "")

  if [ -z "$STATUS" ]; then
    pass "Working directory is clean"
    return 0
  fi

  fail "Working directory has uncommitted changes"
  fail "  Stash or commit your changes before updating:"
  fail "    git stash       # to stash changes"
  fail "    git stash pop   # to restore after update"
  echo "$STATUS" | head -10 | while IFS= read -r line; do
    fail "    $line"
  done
  return 1
}

check_commit_signatures() {
  local UNSIGNED_COUNT TOTAL_COUNT
  TOTAL_COUNT=$(git -C "$PLUGIN_ROOT" rev-list HEAD..origin/main --count 2>/dev/null || echo "0")

  if [ "$TOTAL_COUNT" -eq 0 ]; then
    pass "No incoming commits to verify"
    return 0
  fi

  UNSIGNED_COUNT=$(git -C "$PLUGIN_ROOT" log HEAD..origin/main --format='%G?' 2>/dev/null | grep -c '^N' || true)

  if [ "$UNSIGNED_COUNT" -gt 0 ]; then
    warn "$UNSIGNED_COUNT of $TOTAL_COUNT incoming commits are unsigned"
  else
    pass "All $TOTAL_COUNT incoming commits are signed"
  fi
  return 0
}

backup_current_state() {
  mkdir -p "$BACKUP_DIR"

  local BACKUP_FILES=(
    "settings.json"
    "hooks/hooks.json"
    ".mcp.json"
    ".claude-plugin/plugin.json"
    ".claude-plugin/marketplace.json"
  )

  local TIMESTAMP
  TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
  local SNAPSHOT_DIR="$BACKUP_DIR/$TIMESTAMP"
  mkdir -p "$SNAPSHOT_DIR"

  for rel in "${BACKUP_FILES[@]}"; do
    local src="$PLUGIN_ROOT/$rel"
    if [ -f "$src" ]; then
      local dest_dir="$SNAPSHOT_DIR/$(dirname "$rel")"
      mkdir -p "$dest_dir"
      cp "$src" "$dest_dir/$(basename "$rel")"
    fi
  done

  git -C "$PLUGIN_ROOT" rev-parse HEAD > "$SNAPSHOT_DIR/HEAD_SHA" 2>/dev/null || true

  pass "Pre-update backup created: .otterwise/update-backup/$TIMESTAMP"

  # Prune old backups (keep last 5)
  local BACKUP_COUNT
  BACKUP_COUNT=$(ls -d "$BACKUP_DIR"/*/ 2>/dev/null | wc -l || echo "0")
  if [ "$BACKUP_COUNT" -gt 5 ]; then
    ls -dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +"6" | xargs rm -rf 2>/dev/null || true
    pass "Pruned old backups (kept last 5)"
  fi
}

verify_ff_only_possible() {
  local LOCAL_HEAD REMOTE_HEAD MERGE_BASE
  LOCAL_HEAD=$(git -C "$PLUGIN_ROOT" rev-parse HEAD 2>/dev/null || echo "")
  REMOTE_HEAD=$(git -C "$PLUGIN_ROOT" rev-parse origin/main 2>/dev/null || echo "")
  MERGE_BASE=$(git -C "$PLUGIN_ROOT" merge-base HEAD origin/main 2>/dev/null || echo "")

  if [ -z "$LOCAL_HEAD" ] || [ -z "$REMOTE_HEAD" ] || [ -z "$MERGE_BASE" ]; then
    fail "Cannot determine merge base — git state is inconsistent"
    return 1
  fi

  if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
    pass "Already up to date"
    return 0
  fi

  if [ "$MERGE_BASE" = "$LOCAL_HEAD" ]; then
    pass "Fast-forward merge is possible"
    return 0
  fi

  fail "Cannot fast-forward — local branch has diverged from origin/main"
  fail "  This may indicate unauthorized local modifications or a tampered history"
  fail "  Resolve manually: git log --oneline HEAD..origin/main"
  return 1
}

run_pre_update() {
  printf '\n\033[1mPre-Update Validation\033[0m\n'

  local ERRORS=0

  verify_remote_origin   || ERRORS=$((ERRORS + 1))
  check_dirty_workdir    || ERRORS=$((ERRORS + 1))
  check_commit_signatures || true  # WARN only
  verify_ff_only_possible || ERRORS=$((ERRORS + 1))
  backup_current_state   || ERRORS=$((ERRORS + 1))

  if [ "$ERRORS" -gt 0 ]; then
    fail "Pre-update checks failed ($ERRORS issue(s)). Update aborted."
    return 1
  fi

  pass "All pre-update checks passed"
  return 0
}

# --- Post-update checks ----------------------------------------------------

validate_no_unexpected_files() {
  local PRE_SHA_FILE="$BACKUP_DIR/$(ls -t "$BACKUP_DIR" 2>/dev/null | head -1)/HEAD_SHA"
  local PRE_SHA=""
  if [ -f "$PRE_SHA_FILE" ]; then
    PRE_SHA=$(cat "$PRE_SHA_FILE")
  fi

  if [ -z "$PRE_SHA" ]; then
    warn "No pre-update SHA found — skipping file diff check"
    return 0
  fi

  local POST_SHA
  POST_SHA=$(git -C "$PLUGIN_ROOT" rev-parse HEAD 2>/dev/null)

  local ADDED_FILES
  ADDED_FILES=$(git -C "$PLUGIN_ROOT" diff --name-only --diff-filter=A "$PRE_SHA" "$POST_SHA" 2>/dev/null || echo "")

  if [ -z "$ADDED_FILES" ]; then
    pass "No new files added by update"
    return 0
  fi

  local SUSPICIOUS=0

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    if [[ "$file" == *.sh ]] && [[ "$file" != scripts/* ]]; then
      warn "Shell script added outside scripts/: $file"
      SUSPICIOUS=$((SUSPICIOUS + 1))
    fi

    if [[ "$file" == *.env* ]] || [[ "$file" == *credential* ]] || [[ "$file" == *secret* ]] || [[ "$file" == *token* ]]; then
      fail "Potentially sensitive file added: $file"
      SUSPICIOUS=$((SUSPICIOUS + 1))
    fi

    if git -C "$PLUGIN_ROOT" diff --numstat "$PRE_SHA" "$POST_SHA" -- "$file" 2>/dev/null | grep -q '^-'; then
      warn "Binary file added: $file"
      SUSPICIOUS=$((SUSPICIOUS + 1))
    fi
  done <<< "$ADDED_FILES"

  if [ "$SUSPICIOUS" -eq 0 ]; then
    local FILE_COUNT
    FILE_COUNT=$(echo "$ADDED_FILES" | grep -c '.' || true)
    pass "All $FILE_COUNT new files look clean"
  else
    fail "$SUSPICIOUS suspicious file(s) detected — review before continuing"
    return 1
  fi
  return 0
}

validate_settings_no_escalation() {
  check_jq || return 1

  local SETTINGS="$PLUGIN_ROOT/settings.json"
  if [ ! -f "$SETTINGS" ]; then
    warn "settings.json not found — skipping permission check"
    return 0
  fi

  local CURRENT_PERMS
  CURRENT_PERMS=$(jq -r '.permissions.allow[]?' "$SETTINGS" 2>/dev/null || echo "")

  local ESCALATED=0
  while IFS= read -r perm; do
    [ -z "$perm" ] && continue
    local FOUND=false
    for allowed in "${ALLOWED_PERMISSIONS[@]}"; do
      if [ "$perm" = "$allowed" ]; then
        FOUND=true
        break
      fi
    done
    if [ "$FOUND" = false ]; then
      fail "Unauthorized permission in settings.json: $perm"
      ESCALATED=$((ESCALATED + 1))
    fi
  done <<< "$CURRENT_PERMS"

  if [ "$ESCALATED" -eq 0 ]; then
    pass "settings.json permissions are within whitelist"
  else
    fail "$ESCALATED unauthorized permission(s) detected"
    return 1
  fi
  return 0
}

validate_hooks_no_injection() {
  check_jq || return 1

  local HOOKS="$PLUGIN_ROOT/hooks/hooks.json"
  if [ ! -f "$HOOKS" ]; then
    warn "hooks/hooks.json not found — skipping hook validation"
    return 0
  fi

  local COMMANDS
  COMMANDS=$(jq -r '.. | .command? // empty' "$HOOKS" 2>/dev/null || echo "")

  local DANGEROUS=0
  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue

    local SCRIPT_REL
    SCRIPT_REL=$(echo "$cmd" | sed 's|.*\${CLAUDE_PLUGIN_ROOT}/||' | awk '{print $1}')

    if [ -z "$SCRIPT_REL" ]; then
      if echo "$cmd" | grep -qE '(curl|wget|eval|nc |bash -c|sh -c|python|node -e)'; then
        fail "Dangerous command pattern in hooks.json: $cmd"
        DANGEROUS=$((DANGEROUS + 1))
        continue
      fi
    fi

    local FOUND=false
    for allowed in "${ALLOWED_HOOK_SCRIPTS[@]}"; do
      if [ "$SCRIPT_REL" = "$allowed" ]; then
        FOUND=true
        break
      fi
    done

    if [ "$FOUND" = false ]; then
      fail "Hook references non-whitelisted script: $SCRIPT_REL"
      DANGEROUS=$((DANGEROUS + 1))
    fi
  done <<< "$COMMANDS"

  local EVENT_TYPES
  EVENT_TYPES=$(jq -r '.hooks | keys[]' "$HOOKS" 2>/dev/null || echo "")
  local VALID_EVENTS="PreToolUse PostToolUse Notification Stop"

  while IFS= read -r event; do
    [ -z "$event" ] && continue
    if ! echo "$VALID_EVENTS" | grep -qw "$event"; then
      warn "Unknown hook event type: $event"
    fi
  done <<< "$EVENT_TYPES"

  if [ "$DANGEROUS" -eq 0 ]; then
    pass "hooks.json only references whitelisted scripts"
  else
    fail "$DANGEROUS dangerous hook command(s) detected"
    return 1
  fi
  return 0
}

validate_plugin_json() {
  check_jq || return 1

  if [ ! -f "$PLUGIN_JSON" ]; then
    fail ".claude-plugin/plugin.json not found"
    return 1
  fi

  if ! jq empty "$PLUGIN_JSON" 2>/dev/null; then
    fail ".claude-plugin/plugin.json is not valid JSON"
    return 1
  fi

  local VERSION
  VERSION=$(jq -r '.version // empty' "$PLUGIN_JSON")
  if [ -z "$VERSION" ]; then
    fail "plugin.json missing version field"
    return 1
  fi

  # Check all skill paths exist and have SKILL.md
  local PATHS
  PATHS=$(jq -r '.skills[]?.path // empty' "$PLUGIN_JSON" 2>/dev/null)
  local SKILL_ERRORS=0

  while IFS= read -r skill_path; do
    [ -z "$skill_path" ] && continue
    local full_path="$PLUGIN_ROOT/$skill_path"
    if [ ! -d "$full_path" ] || [ ! -f "$full_path/SKILL.md" ]; then
      fail "Skill path missing or has no SKILL.md: $skill_path"
      SKILL_ERRORS=$((SKILL_ERRORS + 1))
    fi
  done <<< "$PATHS"

  if [ "$SKILL_ERRORS" -eq 0 ]; then
    pass "plugin.json valid — version $VERSION, all skill paths verified"
  else
    fail "$SKILL_ERRORS skill path(s) invalid"
    return 1
  fi
  return 0
}

validate_hooks_exist() {
  local HOOKS="$PLUGIN_ROOT/hooks/hooks.json"
  if [ ! -f "$HOOKS" ]; then
    fail "hooks/hooks.json not found"
    return 1
  fi

  if ! jq empty "$HOOKS" 2>/dev/null; then
    fail "hooks/hooks.json is not valid JSON"
    return 1
  fi

  pass "hooks/hooks.json exists and is valid JSON"
  return 0
}

run_post_update() {
  printf '\n\033[1mPost-Update Validation\033[0m\n'

  local ERRORS=0

  validate_no_unexpected_files     || ERRORS=$((ERRORS + 1))
  validate_settings_no_escalation  || ERRORS=$((ERRORS + 1))
  validate_hooks_no_injection      || ERRORS=$((ERRORS + 1))
  validate_plugin_json             || ERRORS=$((ERRORS + 1))
  validate_hooks_exist             || ERRORS=$((ERRORS + 1))

  if [ "$ERRORS" -gt 0 ]; then
    fail "Post-update validation failed ($ERRORS issue(s))"

    local LATEST_BACKUP
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ] && [ -f "$BACKUP_DIR/$LATEST_BACKUP/HEAD_SHA" ]; then
      local ROLLBACK_SHA
      ROLLBACK_SHA=$(cat "$BACKUP_DIR/$LATEST_BACKUP/HEAD_SHA")
      fail "  Rollback command: git reset --hard $ROLLBACK_SHA"
    fi
    return 1
  fi

  pass "All post-update validation passed"
  return 0
}

# --- Cache management -------------------------------------------------------

clear_plugin_cache() {
  printf '\n\033[1mPlugin Cache\033[0m\n'

  if [ -d "$CACHE_DIR" ]; then
    rm -rf "$CACHE_DIR"
    pass "Cleared plugin cache: $CACHE_DIR"
  else
    info "No plugin cache to clear (directory does not exist)"
  fi

  # Also clear stale .otterwise artifacts from old schema versions
  local OTTERWISE_DIR="$PLUGIN_ROOT/.otterwise"
  if [ -d "$OTTERWISE_DIR" ]; then
    local STALE=0
    for dir in "$OTTERWISE_DIR"/round-*/; do
      [ -d "$dir" ] || continue
      rm -rf "$dir"
      STALE=$((STALE + 1))
    done
    if [ "$STALE" -gt 0 ]; then
      pass "Removed $STALE stale round-* artifact(s) from .otterwise/"
    fi
  fi
}

# --- Full update flow -------------------------------------------------------

run_update() {
  printf '\n\033[1;36mOtterwise Secure Update\033[0m\n'
  printf '========================\n'

  check_jq || exit 1

  # Step 1: Read local version
  local LOCAL_VERSION
  LOCAL_VERSION=$(read_version "$PLUGIN_JSON")
  info "Local version: $LOCAL_VERSION"

  # Step 2: Fetch latest from remote
  printf '\n\033[1mFetching Remote\033[0m\n'
  if ! git -C "$PLUGIN_ROOT" fetch origin main 2>/dev/null; then
    fail "git fetch failed — check network connection and remote configuration"
    fail "  Try: git -C '$PLUGIN_ROOT' fetch origin main"
    exit 1
  fi
  pass "Fetched origin/main"

  # Step 3: Compare versions
  local REMOTE_VERSION
  REMOTE_VERSION=$(read_remote_version)
  info "Remote version: $REMOTE_VERSION"

  if [ "$REMOTE_VERSION" = "unknown" ]; then
    fail "Could not read version from remote plugin.json"
    exit 1
  fi

  if [ "$LOCAL_VERSION" = "$REMOTE_VERSION" ]; then
    pass "Already at latest version ($LOCAL_VERSION)"
    printf '\n  \033[32mNo update needed.\033[0m\n\n'
    exit 2
  fi

  info "Update available: $LOCAL_VERSION -> $REMOTE_VERSION"

  # Step 4: Pre-update security checks
  run_pre_update || exit 1

  # Step 5: Pull changes (fast-forward only)
  printf '\n\033[1mPulling Update\033[0m\n'
  local PULL_OUTPUT
  if ! PULL_OUTPUT=$(git -C "$PLUGIN_ROOT" pull --ff-only origin main 2>&1); then
    fail "git pull failed"
    # Check for merge conflict specifically
    if echo "$PULL_OUTPUT" | grep -qi "conflict\|merge"; then
      fail "Merge conflict detected. Resolve manually:"
      fail "  cd $PLUGIN_ROOT"
      fail "  git status  # see conflicting files"
      fail "  # resolve conflicts, then: git add . && git commit"
    else
      fail "  $PULL_OUTPUT"
    fi
    exit 1
  fi
  pass "Pulled latest changes"

  # Step 6: Run migration
  printf '\n\033[1mRunning Migration\033[0m\n'
  local MIGRATE_SCRIPT="$PLUGIN_ROOT/scripts/migrate.sh"
  if [ -f "$MIGRATE_SCRIPT" ]; then
    if bash "$MIGRATE_SCRIPT"; then
      pass "Migration completed"
    else
      warn "Migration had issues — check output above"
    fi
  else
    warn "migrate.sh not found — skipping migration"
  fi

  # Step 7: Clear plugin cache
  clear_plugin_cache

  # Step 8: Post-update validation
  run_post_update || exit 1

  # Step 9: Summary
  local NEW_VERSION
  NEW_VERSION=$(read_version "$PLUGIN_JSON")

  printf '\n\033[1;36mUpdate Summary\033[0m\n'
  printf '  Version:    %s -> %s\n' "$LOCAL_VERSION" "$NEW_VERSION"
  printf '  Migration:  applied\n'
  if [ -d "$CACHE_DIR" ]; then
    printf '  Cache:      present (rebuilt)\n'
  else
    printf '  Cache:      cleared (will rebuild on next use)\n'
  fi
  printf '\n  \033[32mUpdate successful.\033[0m\n\n'
  exit 0
}

# --- Main ------------------------------------------------------------------

case "$PHASE" in
  update)
    run_update
    ;;
  pre-update)
    # Legacy: standalone pre-update checks
    printf '\n\033[1mSecurity: Pre-Update Validation\033[0m\n'
    ERRORS=0
    verify_remote_origin    || ERRORS=$((ERRORS + 1))
    check_commit_signatures || true
    verify_ff_only_possible || ERRORS=$((ERRORS + 1))
    backup_current_state    || ERRORS=$((ERRORS + 1))
    if [ "$ERRORS" -gt 0 ]; then
      fail "Pre-update security check failed ($ERRORS issue(s)). Update aborted."
      exit 1
    fi
    pass "All pre-update security checks passed"
    ;;
  post-update)
    # Legacy: standalone post-update checks
    run_post_update || exit 1
    ;;
  *)
    echo "Usage: bash scripts/secure-update.sh [update|pre-update|post-update]" >&2
    echo "  update       Full update flow (default)" >&2
    echo "  pre-update   Security checks only (legacy)" >&2
    echo "  post-update  Post-update validation only (legacy)" >&2
    exit 1
    ;;
esac

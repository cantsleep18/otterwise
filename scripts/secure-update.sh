#!/usr/bin/env bash
# secure-update.sh — Security validation for Otterwise auto-update
#
# Validates the update source, pre-update state, and post-update integrity.
# Called by ow-setup before and after git pull.
#
# Usage:
#   bash scripts/secure-update.sh pre-update    # Run before git pull
#   bash scripts/secure-update.sh post-update   # Run after git pull
#
# Exit codes:
#   0 = all checks passed
#   1 = security check failed (caller must abort or rollback)

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$PLUGIN_ROOT/.otterwise/update-backup"
PHASE="${1:-}"

# Expected remote origin — MUST match the canonical repository
EXPECTED_REMOTE="https://github.com/cantsleep18/otterwise.git"
EXPECTED_REMOTE_SSH="git@github.com:cantsleep18/otterwise.git"

# Files that are allowed to exist in the repository root after update.
# Any unexpected executable or config file is flagged.
ALLOWED_ROOT_CONFIGS=(
  ".mcp.json"
  "settings.json"
  ".gitignore"
)

# Allowed hook script paths (relative to PLUGIN_ROOT).
# Hook commands in hooks.json MUST reference only these scripts.
ALLOWED_HOOK_SCRIPTS=(
  "scripts/validate-summary.sh"
  "scripts/validate-autopilot-state.sh"
)

# Allowed permissions in settings.json — the full whitelist.
# Any permission not in this list is a privilege escalation.
ALLOWED_PERMISSIONS=(
  "mcp__python-repl__python_repl"
)

# --- Helpers ---------------------------------------------------------------

fail() { printf '  \033[31mSEC-FAIL\033[0m  %s\n' "$1" >&2; }
pass() { printf '  \033[32mSEC-PASS\033[0m  %s\n' "$1"; }
warn() { printf '  \033[33mSEC-WARN\033[0m  %s\n' "$1"; }

check_jq() {
  command -v jq >/dev/null 2>&1 || { fail "jq not found — cannot validate JSON configs"; return 1; }
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
  local NORMALIZED
  NORMALIZED=$(echo "$REMOTE_URL" | sed 's/\/$//' | sed 's/\.git$//')
  local EXPECTED_NORM
  EXPECTED_NORM=$(echo "$EXPECTED_REMOTE" | sed 's/\/$//' | sed 's/\.git$//')
  local EXPECTED_SSH_NORM
  EXPECTED_SSH_NORM=$(echo "$EXPECTED_REMOTE_SSH" | sed 's/\/$//' | sed 's/\.git$//')

  if [ "$NORMALIZED" = "$EXPECTED_NORM" ] || [ "$NORMALIZED" = "$EXPECTED_SSH_NORM" ]; then
    pass "Remote origin verified: $REMOTE_URL"
    return 0
  fi

  # Also accept with .git suffix
  if [ "$REMOTE_URL" = "$EXPECTED_REMOTE" ] || [ "$REMOTE_URL" = "$EXPECTED_REMOTE_SSH" ]; then
    pass "Remote origin verified: $REMOTE_URL"
    return 0
  fi

  fail "Remote origin does not match expected repository"
  fail "  Expected: $EXPECTED_REMOTE"
  fail "  Got:      $REMOTE_URL"
  fail "  This could indicate the plugin was cloned from a fork or tampered remote."
  return 1
}

check_commit_signatures() {
  # Check if the incoming commits from origin/main are signed.
  # This is a WARN (not FAIL) since not all contributors may sign commits.
  local UNSIGNED_COUNT
  UNSIGNED_COUNT=$(git -C "$PLUGIN_ROOT" log HEAD..origin/main --format='%G?' 2>/dev/null | grep -c '^N' || true)
  local TOTAL_COUNT
  TOTAL_COUNT=$(git -C "$PLUGIN_ROOT" rev-list HEAD..origin/main --count 2>/dev/null || echo "0")

  if [ "$TOTAL_COUNT" -eq 0 ]; then
    pass "No incoming commits to verify"
    return 0
  fi

  if [ "$UNSIGNED_COUNT" -gt 0 ]; then
    warn "$UNSIGNED_COUNT of $TOTAL_COUNT incoming commits are unsigned"
    warn "Consider requiring signed commits for the repository"
  else
    pass "All $TOTAL_COUNT incoming commits are signed"
  fi
  return 0
}

backup_current_state() {
  # Create a backup of critical config files before update
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

  # Also record the current HEAD SHA for rollback
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
  # Ensure the pull can be done as fast-forward only
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
  fail "This may indicate unauthorized local modifications or a tampered history"
  fail "Resolve manually with: git log --oneline HEAD..origin/main"
  return 1
}

run_pre_update() {
  printf '\n\033[1mSecurity: Pre-Update Validation\033[0m\n'

  local ERRORS=0

  verify_remote_origin || ERRORS=$((ERRORS + 1))
  check_commit_signatures || true  # WARN only, don't block
  verify_ff_only_possible || ERRORS=$((ERRORS + 1))
  backup_current_state || ERRORS=$((ERRORS + 1))

  if [ "$ERRORS" -gt 0 ]; then
    fail "Pre-update security check failed ($ERRORS issue(s)). Update aborted."
    return 1
  fi

  pass "All pre-update security checks passed"
  return 0
}

# --- Post-update checks ----------------------------------------------------

validate_no_unexpected_files() {
  # Check for unexpected executable files added by the update
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

  # Get list of added files
  local ADDED_FILES
  ADDED_FILES=$(git -C "$PLUGIN_ROOT" diff --name-only --diff-filter=A "$PRE_SHA" "$POST_SHA" 2>/dev/null || echo "")

  if [ -z "$ADDED_FILES" ]; then
    pass "No new files added by update"
    return 0
  fi

  local SUSPICIOUS=0

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    # Flag executable files that weren't in allowed locations
    if [[ "$file" == *.sh ]] && [[ "$file" != scripts/* ]]; then
      warn "Shell script added outside scripts/: $file"
      SUSPICIOUS=$((SUSPICIOUS + 1))
    fi

    # Flag any new .env or credential-like files
    if [[ "$file" == *.env* ]] || [[ "$file" == *credential* ]] || [[ "$file" == *secret* ]] || [[ "$file" == *token* ]]; then
      fail "Potentially sensitive file added: $file"
      SUSPICIOUS=$((SUSPICIOUS + 1))
    fi

    # Flag new binary files
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
  # Ensure settings.json doesn't contain permissions beyond the whitelist
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
    fail "$ESCALATED unauthorized permission(s) detected — possible privilege escalation"
    return 1
  fi
  return 0
}

validate_hooks_no_injection() {
  # Ensure hooks.json only references allowed scripts — no arbitrary command execution
  check_jq || return 1

  local HOOKS="$PLUGIN_ROOT/hooks/hooks.json"
  if [ ! -f "$HOOKS" ]; then
    warn "hooks/hooks.json not found — skipping hook validation"
    return 0
  fi

  # Extract all command values from hooks
  local COMMANDS
  COMMANDS=$(jq -r '.. | .command? // empty' "$HOOKS" 2>/dev/null || echo "")

  local DANGEROUS=0
  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue

    # Extract the script path from the command
    # Expected format: bash ${CLAUDE_PLUGIN_ROOT}/scripts/something.sh [args]
    local SCRIPT_REL
    SCRIPT_REL=$(echo "$cmd" | sed 's|.*\${CLAUDE_PLUGIN_ROOT}/||' | awk '{print $1}')

    if [ -z "$SCRIPT_REL" ]; then
      # Command doesn't use CLAUDE_PLUGIN_ROOT — check for dangerous patterns
      if echo "$cmd" | grep -qE '(curl|wget|eval|nc |bash -c|sh -c|python|node -e)'; then
        fail "Dangerous command pattern in hooks.json: $cmd"
        DANGEROUS=$((DANGEROUS + 1))
        continue
      fi
    fi

    # Check against allowed script whitelist
    local FOUND=false
    for allowed in "${ALLOWED_HOOK_SCRIPTS[@]}"; do
      if [ "$SCRIPT_REL" = "$allowed" ]; then
        FOUND=true
        break
      fi
    done

    if [ "$FOUND" = false ]; then
      fail "Hook references non-whitelisted script: $SCRIPT_REL"
      fail "  Full command: $cmd"
      DANGEROUS=$((DANGEROUS + 1))
    fi
  done <<< "$COMMANDS"

  # Also validate hook event types (only known event names)
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
    fail "$DANGEROUS dangerous hook command(s) detected — possible code injection"
    return 1
  fi
  return 0
}

validate_mcp_config() {
  # Ensure .mcp.json only launches known server binaries
  check_jq || return 1

  local MCP="$PLUGIN_ROOT/.mcp.json"
  if [ ! -f "$MCP" ]; then
    warn ".mcp.json not found — skipping MCP config validation"
    return 0
  fi

  # Validate server command is 'node' (not arbitrary binary)
  local SERVER_CMD
  SERVER_CMD=$(jq -r '.mcpServers["python-repl"].command // empty' "$MCP" 2>/dev/null)

  if [ "$SERVER_CMD" != "node" ]; then
    fail ".mcp.json server command is '$SERVER_CMD' (expected 'node')"
    return 1
  fi

  # Validate args point to expected build artifact
  local SERVER_ARGS
  SERVER_ARGS=$(jq -r '.mcpServers["python-repl"].args[0] // empty' "$MCP" 2>/dev/null)

  local EXPECTED_PATTERNS=(
    '${CLAUDE_PLUGIN_ROOT}/servers/python-repl/dist/mcp-server.cjs'
    '${CLAUDE_PLUGIN_ROOT}/servers/python-repl/src/index.ts'
  )

  local ARGS_OK=false
  for pattern in "${EXPECTED_PATTERNS[@]}"; do
    if [ "$SERVER_ARGS" = "$pattern" ]; then
      ARGS_OK=true
      break
    fi
  done

  if [ "$ARGS_OK" = true ]; then
    pass ".mcp.json server args point to known entry point"
  else
    fail ".mcp.json server args point to unexpected path: $SERVER_ARGS"
    return 1
  fi

  # Check for unexpected additional MCP servers
  local SERVER_COUNT
  SERVER_COUNT=$(jq '.mcpServers | keys | length' "$MCP" 2>/dev/null || echo "0")
  if [ "$SERVER_COUNT" -gt 1 ]; then
    warn ".mcp.json has $SERVER_COUNT servers (expected 1) — review for unauthorized servers"
    jq -r '.mcpServers | keys[]' "$MCP" 2>/dev/null | while read -r name; do
      if [ "$name" != "python-repl" ]; then
        warn "  Unexpected MCP server: $name"
      fi
    done
  else
    pass ".mcp.json has exactly 1 MCP server (python-repl)"
  fi
  return 0
}

validate_no_secrets() {
  # Scan for accidentally committed secrets or tokens
  local ERRORS=0

  # Check for .env files in tracked files
  local ENV_FILES
  ENV_FILES=$(git -C "$PLUGIN_ROOT" ls-files '*.env' '.env.*' 2>/dev/null || echo "")
  if [ -n "$ENV_FILES" ]; then
    fail "Environment files tracked in git:"
    echo "$ENV_FILES" | while read -r f; do fail "  $f"; done
    ERRORS=$((ERRORS + 1))
  fi

  # Check for common secret patterns in tracked config files
  local CONFIG_FILES=("settings.json" "hooks/hooks.json" ".mcp.json" ".claude-plugin/plugin.json" ".claude-plugin/marketplace.json")
  for rel in "${CONFIG_FILES[@]}"; do
    local f="$PLUGIN_ROOT/$rel"
    [ -f "$f" ] || continue
    if grep -qiE '(password|secret_key|api_key|private_key|bearer |ghp_|sk-|AKIA)' "$f" 2>/dev/null; then
      fail "Possible secret found in $rel"
      ERRORS=$((ERRORS + 1))
    fi
  done

  if [ "$ERRORS" -eq 0 ]; then
    pass "No secrets detected in tracked config files"
  fi
  return "$ERRORS"
}

run_post_update() {
  printf '\n\033[1mSecurity: Post-Update Validation\033[0m\n'

  local ERRORS=0

  validate_no_unexpected_files || ERRORS=$((ERRORS + 1))
  validate_settings_no_escalation || ERRORS=$((ERRORS + 1))
  validate_hooks_no_injection || ERRORS=$((ERRORS + 1))
  validate_mcp_config || ERRORS=$((ERRORS + 1))
  validate_no_secrets || ERRORS=$((ERRORS + 1))

  if [ "$ERRORS" -gt 0 ]; then
    fail "Post-update security check failed ($ERRORS issue(s))."
    fail "Consider rolling back: git reset --hard <pre-update-sha>"

    # Show rollback SHA if available
    local LATEST_BACKUP
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ] && [ -f "$BACKUP_DIR/$LATEST_BACKUP/HEAD_SHA" ]; then
      local ROLLBACK_SHA
      ROLLBACK_SHA=$(cat "$BACKUP_DIR/$LATEST_BACKUP/HEAD_SHA")
      fail "  Rollback command: git reset --hard $ROLLBACK_SHA"
    fi
    return 1
  fi

  pass "All post-update security checks passed"
  return 0
}

# --- Main ------------------------------------------------------------------

case "$PHASE" in
  pre-update)
    run_pre_update
    ;;
  post-update)
    run_post_update
    ;;
  *)
    echo "Usage: bash scripts/secure-update.sh [pre-update|post-update]" >&2
    exit 1
    ;;
esac

---
name: ow-setup
description: Setup, diagnose, and update Otterwise
---

# /otterwise:ow-setup

One command to install, diagnose, and update Otterwise. Run checks in order, report each result, and auto-fix failures.

## Path Conventions

Three directories matter. **Always use absolute paths** in all commands.

| Name | Path | Purpose |
|------|------|---------|
| `{PLUGIN}` | `~/.claude/plugins/marketplaces/otterwise` | Git clone — where updates are pulled |
| `{CACHE}` | `~/.claude/plugins/cache/otterwise` | Runtime cache — Claude Code runs skills/hooks from here |
| `{PROJECT}` | User's current working directory (CWD) | Where `.otterwise/` research data lives |

All git commands run inside `{PLUGIN}`. All research data lives inside `{PROJECT}/.otterwise/`. Skills and scripts execute from `{CACHE}`.

## Data Scaffolding

Create `{PROJECT}/data/` folder structure if it doesn't exist. If it already exists, skip silently.

```bash
mkdir -p {PROJECT}/data/prices
mkdir -p {PROJECT}/data/sources
```

Write `{PROJECT}/data/README.md` only if the file doesn't exist:

```markdown
# Otterwise Data

## prices/ (필수)
가격 데이터를 넣어주세요. 포맷은 자유입니다 (CSV, Parquet, JSON 등).
종가(close)와 익일 시가(open) 계산이 가능한 일봉 데이터가 필요합니다.

## sources/ (선택)
전략 재료 데이터를 넣어주세요. 뉴스, 공시, 수급, 재무, 대안데이터 등.
포맷 제한 없음 — Claude가 읽고 해석합니다.
```

Report:
- Folders exist: `PASS  Data folders ready (data/prices/, data/sources/)`
- Folders created: `DONE  Data folders created (data/prices/, data/sources/)`
- Check contents: if `data/prices/` is empty, `WARN  data/prices/ is empty — add price data before running research`

## Checks

### 1. Environment

```
[ ] Node.js >= 20       → node --version
[ ] npx available       → which npx
```

### 2. Plugin Configuration

All paths below are relative to `{PLUGIN}`.

```
[ ] plugin.json valid        → parse {PLUGIN}/.claude-plugin/plugin.json
[ ] hooks.json valid         → parse {PLUGIN}/hooks/hooks.json, verify scripts exist
[ ] Versions in sync         → compare plugin.json, marketplace.json versions
[ ] Skills registered        → verify each {PLUGIN}/skills/*/SKILL.md has valid frontmatter
```

### 3. Auto-Update

All git operations run inside `{PLUGIN}`.

#### Pre-flight

```bash
cd {PLUGIN}
git rev-parse --is-inside-work-tree
git remote get-url origin   # must be github.com/cantsleep18/otterwise
git status --porcelain       # check clean/dirty
```

If not a git repo or wrong remote, WARN and skip update.

#### Fetch & Compare

```bash
cd {PLUGIN}
git fetch origin main --quiet
git rev-list HEAD..origin/main --count
```

If count > 0, updates are available. Show commit list and proceed automatically.

#### Cache Sync Check

Even if no remote updates, verify the runtime cache matches the plugin source. The cache at `{CACHE}` can become stale if a previous update failed to rebuild it.

```bash
# Compare a key file between {PLUGIN} and {CACHE}
# If {CACHE} doesn't exist OR any source file differs, clear and let Claude Code rebuild
if [ ! -d "{CACHE}" ] || ! diff -q {PLUGIN}/hooks/hooks.json {CACHE}/otterwise/*/hooks/hooks.json >/dev/null 2>&1; then
  rm -rf {CACHE}
  echo "DONE  Cache cleared (stale)"
fi
```

If cache was cleared, report `DONE  Cache cleared (stale)` and tell user to restart session.

#### Execute Update (automatic — no confirmation)

```bash
cd {PLUGIN}

# 1. Record rollback point
PRE_UPDATE_SHA=$(git rev-parse HEAD)
OLD_VERSION=$(cat .claude-plugin/plugin.json | grep version | head -1)

# 2. Stash if dirty
git stash push -m "ow-setup: auto-stash" (only if dirty)

# 3. Pull
git pull origin main --ff-only

# 4. Security post-check
bash scripts/secure-update.sh post-update

# 5. Read new version
NEW_VERSION=$(cat .claude-plugin/plugin.json | grep version | head -1)

# 6. Clear runtime cache so Claude Code reloads from {PLUGIN} on next session
rm -rf ~/.claude/plugins/cache/otterwise/

# 7. Run migration on PROJECT data (if .otterwise/ exists in CWD)
if [ -d "{PROJECT}/.otterwise" ]; then
  bash scripts/migrate.sh
fi

# 8. Pop stash
git stash pop (only if stashed)
```

On failure: `cd {PLUGIN} && git reset --hard $PRE_UPDATE_SHA`, pop stash.

### 4. Post-Update Verification

Only runs if an update was applied.

1. Re-run Environment and Configuration checks
2. Verify `NEW_VERSION` > `OLD_VERSION`
3. Report: `Updated from {OLD_VERSION} to {NEW_VERSION}. Cache cleared.`
4. **Tell user: "Restart your Claude Code session to load the new version."**

## Output Format

### Banner

```
 ___  _   _                      _
/ _ \| |_| |_ ___ _ ____      _(_)___  ___
| | | | __| __/ _ \ '__\ \ /\ / / / __|/ _ \
| |_| | |_| ||  __/ |   \ V  V /| \__ \  __/
\___/ \__|\__\___|_|    \_/\_/ |_|___/\___|

Setup & Diagnostics  v{version}
Project: {PROJECT}
Plugin:  {PLUGIN}
────────────────────────────────────────
```

### Indicators

| Indicator | Meaning |
|-----------|---------|
| `PASS  ` | Requirement met |
| `FAIL  ` | Critical issue |
| `WARN  ` | Non-critical issue |
| `UPDATE` | Remote has new commits |
| `DONE  ` | Action completed |
| `SKIP  ` | Precondition not met |

### Example Output

```
Environment
  PASS  Node.js 22.1.0
  PASS  npx available

Plugin Configuration
  PASS  plugin.json valid
  PASS  hooks.json valid (3 hooks, all scripts verified)
  PASS  All version files in sync (v1.5.0)
  PASS  All skills registered (7 skills)

Updates
  PASS  Git repo clean
  PASS  Origin verified (github.com/cantsleep18/otterwise)
  PASS  Up to date (v1.5.0)

────────────────────────────────────────
Summary: 9 PASS | 0 WARN | 0 FAIL
Status: Ready to use
```

**Update available:**

```
Updates
  PASS  Git repo clean
  PASS  Origin verified (github.com/cantsleep18/otterwise)
  UPDATE  3 commits behind (v1.4.0 → v1.5.0)
    |- abc1234 Add new research capability
    |- def5678 Fix autopilot node selection
  DONE  Pulled 3 commits (ff-only)
  DONE  Security post-check passed
  DONE  Migration complete
  DONE  Cache cleared (~/.claude/plugins/cache/otterwise/)
  PASS  Re-verified: all checks pass on v1.5.0

────────────────────────────────────────
Updated from v1.4.0 to v1.5.0. Cache cleared.
⚠ Restart your Claude Code session to load the new version.
```

## Security

The update mechanism uses `scripts/secure-update.sh`:

- **Source verification**: remote must match canonical repo URL
- **Integrity**: fast-forward only, no force pulls
- **Hook safety**: hooks.json validated against whitelisted scripts
- **File scanning**: new files checked for dangerous patterns
- **Secret detection**: config files scanned for API keys/tokens
- **Rollback**: timestamped backups in `{PLUGIN}/.otterwise/update-backup/` (last 5 retained)

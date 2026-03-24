---
name: ow-setup
description: Setup, diagnose, and update Otterwise
---

# /otterwise:ow-setup

One command to install, diagnose, and update Otterwise. Run checks in order, report each as PASS / FAIL / WARN, print a summary table, and fix failures (with user confirmation).

## Checks

### 1. Environment

```
[ ] Node.js >= 20       → node --version
[ ] npx available       → which npx
```

### 2. Configuration

```
[ ] plugin.json valid        → parse JSON, check skills/hooks paths exist
[ ] hooks.json valid         → parse JSON, check referenced scripts exist
[ ] Versions in sync         → compare plugin.json, marketplace.json (metadata + plugin)
[ ] Skills registered        → verify each skills/*/SKILL.md has valid frontmatter
```

Version check: read `.claude-plugin/plugin.json` `.version`, `.claude-plugin/marketplace.json` `.metadata.version` and `.plugins[0].version`. All must match. Auto-fix: ask user which is correct, write to all.

Skills check: read `.claude-plugin/plugin.json` `.skills`, list subdirectories with SKILL.md, verify YAML frontmatter (name, description).

### 3. Auto-Update

#### Pre-flight

```
[ ] Git repo present       → git rev-parse --is-inside-work-tree
[ ] Origin verified        → bash scripts/secure-update.sh pre-update
[ ] Working tree status    → git status --porcelain (clean/dirty)
```

If not a git repo, skip update section. If security pre-check fails (wrong remote, diverged history), abort.

#### Cache & Version Discovery

Read `.otterwise/update-check.json` — if checked < 1 hour ago, use cached result. Otherwise:

1. `git fetch origin main --quiet` (WARN if offline)
2. Compare local vs remote `.claude-plugin/plugin.json` version (semver)
3. `git rev-list HEAD..origin/main --count`
4. Write result to `.otterwise/update-check.json`

#### Execute Update (after user confirms)

1. Record `PRE_UPDATE_SHA` and `OLD_VERSION` (from `.claude-plugin/plugin.json`)
2. If dirty: `git stash push -m "ow-setup: auto-stash before update"`
3. `git pull origin main --ff-only` (FAIL if diverged)
4. `bash scripts/secure-update.sh post-update` (validates hooks, files, secrets)
5. Read `NEW_VERSION` from `.claude-plugin/plugin.json`
6. `bash scripts/migrate.sh` (schema migration for `.otterwise/` data files)
7. Clear plugin cache: `rm -rf ~/.claude/plugins/cache/otterwise/`
8. Pop stash if created
9. Write updated `.otterwise/update-check.json`

On failure: `git reset --hard $PRE_UPDATE_SHA`, pop stash, leave cache stale for re-check.

### 4. Post-Update Verification (conditional)

Only runs if an update was applied (step 3 above).

1. Re-run all diagnostic checks (Environment, Configuration) against the new version
2. Verify `NEW_VERSION` > `OLD_VERSION` (semver)
3. Report: `"Updated from {OLD_VERSION} to {NEW_VERSION}. Plugin cache cleared."`
4. Tell user: **"Restart your Claude Code session to load the new version."**

#### Plugin Cache

Claude Code caches plugin files at `~/.claude/plugins/cache/otterwise/`. After `git pull` updates the source, this cache is stale. Step 7 above removes it so Claude Code reloads from source on next session start.

#### Migration

If `.otterwise/` exists, `scripts/migrate.sh` handles schema migration for data files (`config.json`, `autopilot.json`, `autopilot-state.json`). Safety rules: additive only, preserve `nodes` array (append-only), backup first, skip if absent. Supports `--dry-run`.

## Output Format

Print inside a markdown code block. Print each section as checks complete.

### Indicators

| Indicator | Meaning |
|-----------|---------|
| `PASS  ` | Requirement met |
| `FAIL  ` | Critical issue |
| `WARN  ` | Non-critical issue |
| `UPDATE` | Remote has new commits |
| `DONE  ` | Action completed |
| `SKIP  ` | Precondition not met |

### Banner

```
 ___  _   _                      _
/ _ \| |_| |_ ___ _ ____      _(_)___  ___
| | | | __| __/ _ \ '__\ \ /\ / / / __|/ _ \
| |_| | |_| ||  __/ |   \ V  V /| \__ \  __/
\___/ \__|\__\___|_|    \_/\_/ |_|___/\___|

Setup & Diagnostics  v{version}
────────────────────────────────────────
```

### Example Output

```
Environment
  PASS  Node.js 22.1.0
  PASS  npx available

Configuration
  PASS  plugin.json valid
  PASS  hooks.json valid
  PASS  All version files in sync (v1.2.0)
  PASS  All skills registered (7 skills)

Updates
  PASS  Git repo clean
  PASS  Origin verified (github.com/cantsleep18/otterwise)
  PASS  Up to date (v1.2.0)

────────────────────────────────────────
Summary: 8 PASS | 0 WARN | 0 FAIL
Status: Ready to use
```

**Update available variant:**

```
Updates
  PASS  Git repo clean
  PASS  Origin verified (github.com/cantsleep18/otterwise)
  UPDATE  3 commits behind (v1.2.0 -> v1.3.0)
    |- abc1234 Add new research capability
    |- def5678 Fix autopilot node selection
```

Then ask: **"Update now?"**

**After successful update:**

```
  DONE  Pulled 3 commits (ff-only)
  DONE  Security post-check passed
  DONE  Migration complete (no changes needed)
  DONE  Plugin cache cleared (~/.claude/plugins/cache/otterwise/)
  PASS  Re-verified: all checks pass on v1.3.0

────────────────────────────────────────
Updated from v1.2.0 to v1.3.0. Plugin cache cleared.
⚠ Restart your Claude Code session to load the new version.
```

**Auto-fix:** show FAIL then DONE on consecutive lines within the same section.

## Security

The update mechanism uses `scripts/secure-update.sh` for hardening:

- **Source verification**: remote origin must match canonical repo URL
- **Integrity**: fast-forward only, no force pulls; pre-update backup with rollback SHA
- **Hook safety**: hooks.json validated against whitelisted scripts; dangerous patterns rejected
- **File scanning**: new files checked for scripts outside `scripts/`, credential-like names, binaries
- **Secret detection**: config files scanned for API keys, tokens, private keys
- **Rollback**: timestamped backups in `.otterwise/update-backup/` (last 5 retained)

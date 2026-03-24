---
name: ow-setup
description: Setup, diagnose, and update Otterwise
---

# /otterwise:ow-setup

One command to install, diagnose, and update Otterwise.

## What It Does

Run through these checks in order. Report each as PASS / FAIL / WARN with a one-line summary. At the end, print a summary table and fix anything that failed (with user confirmation).

### 1. Environment Checks

```
[ ] Node.js >= 20       → run: node --version
[ ] Python >= 3.11      → run: python3 --version
[ ] npx available       → run: which npx
```

### 2. npm Dependencies

```
[ ] node_modules exists → check: servers/python-repl/node_modules/
[ ] packages up to date → run: cd servers/python-repl && npm ls --depth=0
```

If node_modules is missing or outdated:
→ Auto-fix: `cd servers/python-repl && npm install`

### 3. MCP Server Health

```
[ ] index.ts exists          → check: servers/python-repl/src/index.ts
[ ] TypeScript compiles      → run: cd servers/python-repl && npx tsc --noEmit
[ ] Server starts            → run: timeout 5 npx tsx servers/python-repl/src/index.ts (expect stdio MCP handshake)
```

### 4. Python Worker Health

```
[ ] worker.py exists         → check: servers/python-repl/worker/worker.py
[ ] Python stdlib imports OK → run: python3 -c "import socket, threading, json, io, base64, traceback, resource, argparse"
[ ] matplotlib available     → run: python3 -c "import matplotlib" (WARN if missing, not FAIL)
[ ] pandas available         → run: python3 -c "import pandas" (WARN if missing, not FAIL)
```

If matplotlib/pandas missing, suggest:
→ "Run `install_package` tool during research to install on-demand, or manually: `pip install matplotlib pandas`"

### 5. Configuration Validation

```
[ ] .mcp.json valid          → parse JSON, check mcpServers.python-repl exists
[ ] settings.json valid      → parse JSON, check permissions include mcp__python-repl__python_repl
[ ] plugin.json valid        → parse JSON, check agents/skills/hooks paths exist
[ ] hooks.json valid         → parse JSON, check referenced script exists
[ ] Versions in sync         → see Version Consistency Check below
[ ] Skills registered        → see Skills Registration Check below
```

If settings.json is missing the `mcp__python-repl__python_repl` permission:
→ Auto-fix: add it

#### Version Consistency Check

Read the version from each source and compare:

```
1. Read .claude-plugin/plugin.json       → .version
2. Read .claude-plugin/marketplace.json  → .metadata.version AND .plugins[0].version
```

All three values must match. If they do not:
→ FAIL: "Version mismatch: plugin.json=X, marketplace.metadata=Y, marketplace.plugin=Z"
→ Auto-fix: ask user which version is correct, then write it to all three locations

If versions are in sync:
→ PASS: "All version files in sync (vX.Y.Z)"

#### Skills Registration Check

Validate that skills on disk match what's registered in plugin.json:

```
1. Read .claude-plugin/plugin.json → .skills[] array (each has .name and .path)
2. List directories in skills/ that contain a SKILL.md
3. Compare:
   - Every plugin.json skill entry must have a matching skills/{name}/SKILL.md on disk
   - Every skills/*/SKILL.md on disk must have a matching entry in plugin.json
```

If all match:
→ PASS: "All skills registered (N skills)"

If mismatch:
→ FAIL: "Unregistered skill: skills/{name}/SKILL.md not in plugin.json"
→ FAIL: "Missing skill: plugin.json references {name} but skills/{name}/SKILL.md not found"

### 6. Auto-Update

The auto-update is the most involved step. Follow this exact sequence.

#### 6a. Pre-flight

```
[ ] Git repo present          → run: git rev-parse --is-inside-work-tree
[ ] Security: verify origin   → run: bash scripts/secure-update.sh pre-update (verifies remote URL, backs up state)
[ ] Working tree status       → run: git status --porcelain
```

Record the working tree status:
- **clean**: no output from `git status --porcelain`
- **dirty**: has uncommitted changes — note for later (updates still proceed via stash)

If not a git repo, skip the entire update section:
→ WARN: "Not a git repository — update check skipped"

The security pre-check (`scripts/secure-update.sh pre-update`) validates:
1. **Remote origin URL** matches the canonical repository. If mismatch, FAIL and abort.
2. **Commit signatures** on incoming commits (WARN if unsigned, does not block).
3. **Fast-forward feasibility** — ensures local branch has not diverged.
4. **Pre-update backup** of config files and records current HEAD SHA for rollback.

If the security pre-check fails, do not proceed with fetch or pull.

#### 6b. Cache Check

Read `.otterwise/update-check.json` if it exists:

```json
{
  "lastCheck": "2026-03-23T14:30:00Z",
  "localVersion": "1.1.0",
  "remoteVersion": "1.1.0",
  "updateAvailable": false,
  "commitsBehind": 0
}
```

If `lastCheck` is less than 1 hour ago, use cached result and skip to 6e (Display).
Show: "PASS  Using cached update check (Xm ago)"

#### 6c. Version Discovery

```
[ ] Fetch remote             → run: git fetch origin main --quiet
                               If fetch fails (offline/no remote): WARN and skip to 6e with stale cache or "unknown"
[ ] Read local version       → parse .claude-plugin/plugin.json → .version
[ ] Read remote version      → run: git show origin/main:.claude-plugin/plugin.json
                               Parse the JSON output → .version
                               If remote file missing: WARN and skip version compare
[ ] Count commits behind     → run: git rev-list HEAD..origin/main --count
```

#### 6d. Semver Comparison

Compare local version (L) vs remote version (R):

1. Split each into MAJOR.MINOR.PATCH integers
2. Compare left-to-right: if R > L at any position, update is available
3. If L > R, local is ahead (dev/unreleased) — WARN
4. If L == R and commits behind > 0: same version tag but new commits (pre-release changes) — treat as update available
5. If L == R and commits behind == 0: fully up to date

Write result to `.otterwise/update-check.json` (create `.otterwise/` dir if needed):

```json
{
  "lastCheck": "<current ISO 8601 timestamp>",
  "localVersion": "<L>",
  "remoteVersion": "<R>",
  "updateAvailable": true,
  "commitsBehind": 5
}
```

#### 6e. Display Update Status

**Fully up to date:**
→ PASS: "Up to date (vX.Y.Z)"

**Local ahead of remote:**
→ WARN: "Local version (vX.Y.Z) ahead of remote (vA.B.C) — unreleased changes"

**Update available:**
Get commit list: `git log HEAD..origin/main --oneline --no-decorate`
Display using the Update Available variant from the Output Format section, then ask: **"Update now?"**

#### 6f. Execute Update

Only proceed after user confirms. Follow this exact sequence:

**Step 1 — Record pre-update state**

```bash
PRE_UPDATE_SHA=$(git rev-parse HEAD)
```

**Step 2 — Handle dirty working tree**

If working tree is dirty:
```bash
git stash push -m "ow-setup: auto-stash before update"
```
Track that a stash was created for cleanup in Step 7.

**Step 3 — Pull updates (fast-forward only)**

```bash
git pull origin main --ff-only
```

If `--ff-only` fails (diverged history):
→ FAIL: "Cannot fast-forward. Branch has diverged from origin/main."
→ Show: "To resolve: `git rebase origin/main` or `git merge origin/main`"
→ If stash was created, pop it: `git stash pop`
→ Stop the update — do not continue to post-update steps.

**Step 4 — Post-update security validation**

```bash
bash scripts/secure-update.sh post-update
```

Validates: no unauthorized permission escalation in settings.json, no command injection in hooks.json, .mcp.json only launches known server binaries, no suspicious files, no secrets. If security check fails, display findings and suggest rollback.

**Step 5 — Post-update rebuild**

Run the post-update script with the pre-update SHA so it knows what changed:

```bash
OW_PRE_UPDATE_SHA=$PRE_UPDATE_SHA bash scripts/post-update.sh
```

The script detects what changed between the two commits and rebuilds only what is needed:
- `servers/python-repl/package.json` or `package-lock.json` changed → `npm install`
- `servers/python-repl/src/*.ts` changed → esbuild rebuild via `node scripts/build.mjs`
- `tsconfig.json` or `scripts/build.mjs` changed → esbuild rebuild
- Verifies `servers/python-repl/dist/mcp-server.cjs` exists after any rebuild

If the script exits non-zero, go to 6g (Rollback).

**Step 6 — Verify update**

```bash
NEW_VERSION=$(parse .claude-plugin/plugin.json → .version)
ls servers/python-repl/dist/mcp-server.cjs
```

Display:
→ PASS: "Updated: vOLD → vNEW"
→ PASS: "Post-update rebuild completed" (if rebuilds ran)
→ PASS: "MCP server artifact verified"

**Step 7 — Restore stashed changes**

If a stash was created in Step 2:
```bash
git stash pop
```

If stash pop fails (conflicts):
→ WARN: "Stash pop had conflicts. Your changes are in `git stash`. Resolve with `git stash show -p | git apply`"
→ Do NOT roll back — the plugin update itself succeeded.

**Step 8 — Update cache**

Write `.otterwise/update-check.json`:
```json
{
  "lastCheck": "<current ISO 8601 timestamp>",
  "localVersion": "<new version>",
  "remoteVersion": "<new version>",
  "updateAvailable": false,
  "commitsBehind": 0
}
```

#### 6g. Rollback on Failure

If post-update rebuild (Step 5) or verification (Step 6) fails:

```bash
FAILED_SHA=$(git rev-parse HEAD)
git reset --hard $PRE_UPDATE_SHA
```

Display:
→ FAIL: "Post-update rebuild failed"
→ WARN: "Rolled back to v{old} (commit {PRE_UPDATE_SHA short})"
→ INFO: "Failed update at commit {FAILED_SHA short}"
→ INFO: "To retry manually: `git pull origin main && cd servers/python-repl && npm install && npm run build`"

If a stash was created, pop it after rollback:
```bash
git stash pop
```

Do NOT update `update-check.json` on failure — leave stale cache so the next run re-checks.

### 7. Post-Update Migration (conditional)

Only run this section if an update was applied in step 6. If no update was pulled:
→ `SKIP  Migration              no update applied`

If `.otterwise/` does not exist:
→ `SKIP  Migration              no active session`

#### 7a. Settings Tool Permissions

After pull, `settings.json` is updated by git. Verify the tool list is complete:

```
[ ] Read settings.json → permissions.allow array
[ ] Compare against expected tool list
[ ] If missing tools: add them and report DONE
```

Expected tools (v1.1.0):
```json
["mcp__python-repl__python_repl"]
```

→ `DONE  settings.json: added {N} new tool permission(s)` (if missing found)
→ `PASS  settings.json: all tools present` (if complete)

#### 7b. User Data Migration (.otterwise/)

User data files are gitignored and untouched by git pull. If the schema changed, migrate them.

**Schema version convention**: Each user data file has a `schemaVersion` integer field. If absent, treat as version 1.

**Migration procedure** for each file:

1. Read the file and parse JSON. If not valid JSON: remove the corrupt file, report WARN
2. Read `schemaVersion` (default to 1 if absent)
3. Look up expected version from the migration table below
4. If current == expected: no migration needed
5. If current < expected:
   a. **Backup**: copy to `{filename}.backup-v{current}` (e.g., `config.json.backup-v1`)
   b. Apply each migration step from current to expected (in order)
   c. Write the migrated file
   d. Verify the migrated file is valid JSON
   e. If migration fails at any step: restore from backup, report FAIL
6. If current > expected: WARN "Schema version ahead of plugin — possible downgrade"

**Files to check**:

```
[ ] .otterwise/config.json          → research session config
[ ] .otterwise/autopilot.json       → autopilot session config (rounds, settings)
[ ] .otterwise/autopilot-state.json → runtime control signal (command, updatedAt, reason)
```

#### Schema Migration Table

```
config.json:
  v1 → v2: add "schemaVersion": 2, add "pluginVersion": "{current_version}"

autopilot.json:
  v1 → v2: add "schemaVersion": 2, add "pluginVersion": "{current_version}"

autopilot-state.json:
  v1 → v2: add "schemaVersion": 2, add "pluginVersion": "{current_version}"
```

Each version bump that changes cache schema MUST add an entry to this table.

#### Migration Safety Rules

- **Additive only**: never delete user data fields — only add or rename
- **Preserve rounds**: the `rounds` array in autopilot state is append-only, immutable
- **Backup first**: always copy to `{file}.backup-v{old}` before any modification
- **Restore on failure**: if migration fails, restore from backup and report FAIL
- **Skip if absent**: if `.otterwise/` or a specific file doesn't exist, SKIP (not FAIL)

#### 7c. Build Artifact Cleanup

```
[ ] Check servers/python-repl/dist/ for stale files (e.g., legacy index.js, index.d.ts)
[ ] Remove stale artifacts that are not part of current build output
```

#### 7d. MCP Server Rebuild

```
[ ] Rebuild: cd servers/python-repl && npm run build
[ ] Verify dist/mcp-server.cjs exists and is non-empty
```

#### Migration Output

Display results using the indicators from the Output Format section:
- Success: `DONE  Migration complete (N changes applied)`
- Skipped: `SKIP  Migration skipped (no update)`
- Failed: `FAIL  Migration failed (see errors above)`

The migration can also be run standalone via `bash scripts/migrate.sh` (supports `--dry-run`)

### 8. Tests

```
[ ] Tests pass               → run: cd servers/python-repl && npx vitest --run
```

Report: X/Y tests passing.

## Output Format

Print the output inside a **markdown code block** so it renders cleanly in the terminal. Print each section immediately after its checks complete -- do not buffer all output until the end.

### Indicators

Use these **exact** fixed-width text indicators (6 characters, right-padded). Each check line is formatted as: two-space indent, indicator, two spaces, description.

| Indicator | Meaning | When Used |
|-----------|---------|-----------|
| `PASS  ` | Check passed | Requirement met |
| `FAIL  ` | Check failed | Critical requirement missing |
| `WARN  ` | Non-critical issue | Optional dep missing, dirty worktree, offline |
| `UPDATE` | Update available | Remote has new commits |
| `DONE  ` | Action completed | Auto-fix applied, update installed |
| `SKIP  ` | Check skipped | Precondition not met (e.g., no .otterwise/ for migration) |

### Banner

Print this first, before running any checks. Read the version from `.claude-plugin/plugin.json` (field `version`). If not found, use `dev`.

```
 ___  _   _                      _
/ _ \| |_| |_ ___ _ ____      _(_)___  ___
| | | | __| __/ _ \ '__\ \ /\ / / / __|/ _ \
| |_| | |_| ||  __/ |   \ V  V /| \__ \  __/
\___/ \__|\__\___|_|    \_/\_/ |_|___/\___|

Setup & Diagnostics  v{version}
────────────────────────────────────────
```

### Section Output

Print one section per check group. Section name on its own line, then indented check results:

```
Environment
  PASS  Node.js 22.1.0
  PASS  Python 3.12.3
  PASS  npx available

Dependencies
  PASS  node_modules installed
  PASS  packages up to date

MCP Server
  PASS  index.ts exists
  PASS  TypeScript compiles
  PASS  Server process starts

Python Worker
  PASS  worker.py exists
  PASS  stdlib imports OK
  WARN  matplotlib not installed (optional)
  WARN  pandas not installed (optional)

Configuration
  PASS  .mcp.json valid
  PASS  settings.json valid (python_repl tool)
  PASS  plugin.json valid
  PASS  hooks.json valid
  PASS  All version files in sync (v1.1.0)
  PASS  All skills registered (7 skills)
```

### Updates Section

**Up to date:**

```
Updates
  PASS  Git repo clean
  PASS  Origin verified (github.com/cantsleep18/otterwise)
  PASS  Up to date (v1.1.0)
```

**Update available:**

```
Updates
  PASS  Git repo clean
  PASS  Origin verified (github.com/cantsleep18/otterwise)
  UPDATE  3 commits behind (v1.1.0 -> v1.2.0)
    |- abc1234 Add new visualization tool
    |- def5678 Fix kernel timeout handling
    |- 890abcd Update dependencies
```

Then ask the user: **"Update now?"** If confirmed, run the update (see Step 6) and show the result:

```
  DONE  Updated to v1.2.0 (3 commits pulled)
  DONE  Security validation passed
  DONE  Dependencies refreshed (npm install)
  DONE  MCP server rebuilt
```

**Fetch failed (offline):**

```
  WARN  Could not check for updates (offline?)
```

**Local ahead of remote:**

```
  WARN  Local version (v1.2.0) ahead of remote (v1.1.0) — unreleased changes
```

**Dirty worktree:**

```
  WARN  Git repo has uncommitted changes (stash or commit first)
```

### Security Section (conditional)

Only shown after an update is applied. Displays the post-update security validation results:

```
Security
  PASS  Permissions within whitelist
  PASS  Hooks use whitelisted scripts only
  PASS  MCP config launches known server binary
  PASS  No secrets in tracked files
```

If a security check fails:

```
Security
  FAIL  Unauthorized permission added to settings.json
  PASS  Hooks use whitelisted scripts only
  PASS  MCP config launches known server binary
  WARN  Suspicious file added: scripts/unknown.sh
```

### Migration Section (conditional)

Only shown after an update that triggers migration. If no update was applied or no migration needed, omit this section entirely.

```
Migration
  DONE  settings.json: added new tool permissions
  DONE  .otterwise/config.json: migrated schema v1 -> v2
  SKIP  .otterwise/autopilot.json: no active session
```

### Tests Section

```
Tests
  PASS  78/78 tests passing
```

### Auto-fix Behavior

When a FAIL is detected and an auto-fix is available, run the fix immediately and show both the FAIL and result on consecutive lines within the same section:

```
Dependencies
  FAIL  node_modules missing
  DONE  Installed (npm install completed)
```

If the fix itself fails:

```
Dependencies
  FAIL  node_modules missing
  FAIL  npm install failed (see error above)
```

### Summary Line

After all sections, print a separator and the summary:

```
────────────────────────────────────────
Summary: {pass} PASS | {warn} WARN | {fail} FAIL | {update} UPDATE
```

Include the UPDATE count only if an update was available or applied during this run. Omit it when zero.

### Status Line

Print **one** final status line:

- **All pass (0 fail, 0 warn):** `Status: Ready to use`
- **Warnings only (0 fail, warn > 0):** `Status: Functional ({warn} optional items noted above)`
- **Failures remain after auto-fix:** `Status: {fail} issue(s) need manual attention`

## Security Considerations

The update mechanism includes several hardening measures implemented in `scripts/secure-update.sh`:

### Update Source Verification
- The git remote origin URL is verified against the canonical repository before any fetch or pull operation
- Only `https://github.com/cantsleep18/otterwise.git` and the SSH equivalent are accepted
- This prevents updates from forked, mirrored, or tampered remotes

### Update Integrity
- Updates are restricted to `git pull --ff-only` — no force pulls, no rebasing
- Diverged history is treated as a security failure, not auto-resolved
- Pre-update backups of all config files are created with the current HEAD SHA for rollback
- Commit signatures on incoming commits are checked (warn-only, for visibility)

### Config Merge Safety
- `settings.json` permissions are validated against a whitelist after update — any permission not in the whitelist is flagged as privilege escalation
- `hooks.json` commands are validated to reference only whitelisted scripts — arbitrary command execution patterns (curl, wget, eval, bash -c, etc.) are rejected
- `.mcp.json` is validated to launch only the known `node` binary with expected entry point arguments
- Unexpected additional MCP servers are flagged

### File Integrity
- New files added by the update are scanned for: shell scripts outside `scripts/`, credential-like filenames (.env, secret, token), and binary files
- Tracked config files are scanned for common secret patterns (API keys, bearer tokens, private keys)

### Rollback
- Every update creates a timestamped backup in `.otterwise/update-backup/`
- Backup includes all config files and the pre-update HEAD SHA
- If post-update validation fails, the rollback SHA is displayed for manual recovery
- Last 5 backups are retained; older ones are pruned automatically

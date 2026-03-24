# Otterwise Auto-Update & ow-setup Architecture

Version: 1.1.0 | Date: 2026-03-23

---

## 1. System Overview

Otterwise is a Claude Code plugin (OMC pattern) distributed via git. The plugin consists of:

- **MCP Server**: TypeScript, esbuild-bundled to `dist/mcp-server.cjs` (Node 20+)
- **Python Worker**: `servers/python-repl/worker/worker.py` (Python 3.11+)
- **Skills**: Markdown specs in `skills/` that Claude follows as instructions
- **Hooks**: Post-tool-use validators in `hooks/hooks.json`
- **Cache**: `.otterwise/` directory with research data (gitignored, user-local)
- **Config files**: `.mcp.json`, `settings.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

The `ow-setup` skill is a SKILL.md that Claude executes — it is NOT a script. All "terminal output" is Claude's markdown output rendered in the terminal.

---

## 2. Auto-Update Mechanism

### 2.1 Version Model

Versions are tracked in two authoritative locations:
- `.claude-plugin/plugin.json` field `"version"` (semver, e.g. `"1.1.0"`)
- `.claude-plugin/marketplace.json` field `"metadata.version"` (must match)

The git remote `origin/main` is the update source. Version comparison uses git commits, not semver parsing — if `HEAD` is behind `origin/main`, an update is available.

### 2.2 Version Check Flow

```
Step 1: git fetch origin main --quiet
Step 2: LOCAL_HEAD  = git rev-parse HEAD
Step 3: REMOTE_HEAD = git rev-parse origin/main
Step 4: if LOCAL_HEAD == REMOTE_HEAD → up to date
Step 5: BEHIND_COUNT = git rev-list HEAD..origin/main --count
Step 6: COMMITS = git log HEAD..origin/main --oneline --no-decorate
Step 7: LOCAL_VERSION  = read .claude-plugin/plugin.json → version
Step 8: REMOTE_VERSION = git show origin/main:.claude-plugin/plugin.json | parse → version
```

Output to user:
- If up to date: `PASS  Up to date (v1.1.0)`
- If behind: `UPDATE  {N} commits behind (v{local} → v{remote})`
- If fetch fails (offline): `WARN  Could not check for updates (offline?)`

### 2.3 Update Execution Flow

When the user confirms the update:

```
Phase 1: Pre-update snapshot
  - Record current version from plugin.json
  - Record current config schema fingerprints (see §3)
  - Check git status --porcelain for uncommitted changes
    - If dirty: WARN and ask user to stash or commit first
    - If clean: proceed

Phase 2: Pull
  - git pull origin main --ff-only
  - If ff-only fails (diverged history):
      FAIL "Cannot fast-forward. Please resolve manually."
      (Do NOT force-pull or rebase automatically)

Phase 3: Post-update steps (in order)
  a. Dependency refresh:
     - Check if servers/python-repl/package.json changed:
       git diff HEAD~{N}..HEAD --name-only | grep package.json
     - If changed: cd servers/python-repl && npm install
  b. Rebuild MCP server:
     - cd servers/python-repl && npm run build
     - Verify dist/mcp-server.cjs exists and is non-empty
  c. Config migration (see §3)
  d. Read new version from plugin.json

Phase 4: Verification
  - Confirm new version matches expected remote version
  - Run quick smoke: node dist/mcp-server.cjs --version (or just check file exists)
  - Report result to user
```

### 2.4 Update Status Indicators

The ow-setup skill reports update status using these indicators:

| Status | Indicator | Meaning |
|--------|-----------|---------|
| Up to date | `PASS` | HEAD == origin/main |
| Update available | `UPDATE` | HEAD behind origin/main, shows commit count + version change |
| Update applied | `DONE` | Successfully pulled and rebuilt |
| Fetch failed | `WARN` | Network error, cannot check |
| Pull failed | `FAIL` | Fast-forward failed, manual intervention needed |
| Dirty worktree | `WARN` | Uncommitted changes block update |

---

## 3. Cache & Config Migration

### 3.1 What Needs Migration

Config files that may change schema across versions:

| File | Location | Scope |
|------|----------|-------|
| `settings.json` | repo root | Tool permissions list |
| `.mcp.json` | repo root | MCP server command/args |
| `hooks/hooks.json` | repo root | Hook event names and matchers |
| `.claude-plugin/plugin.json` | .claude-plugin/ | Skills list, metadata |
| `.claude-plugin/marketplace.json` | .claude-plugin/ | Marketplace metadata |
| `.otterwise/config.json` | .otterwise/ | Research session config (user data) |
| `.otterwise/autopilot.json` | .otterwise/ | Autopilot session config (user data) |

### 3.2 Migration Strategy

Migration is **declarative diff-based**, not script-based. After a git pull, ow-setup compares what the new version expects against what the user has.

#### 3.2.1 Tracked Config Files (settings.json, .mcp.json, hooks.json)

These files are tracked in git. After `git pull`, they are automatically updated. The only migration needed is if the user has local modifications that conflict.

**Approach**: If git pull succeeds (fast-forward), these are already correct. No migration needed.

#### 3.2.2 Plugin Config Files (plugin.json, marketplace.json)

Same as above — tracked in git, updated by pull.

#### 3.2.3 User Data Files (.otterwise/)

These are gitignored and never touched by git pull. Migration is needed when the *schema* of these files changes across versions.

**Approach — Schema Version Header**:

Add a `schemaVersion` field to `.otterwise/config.json` and `.otterwise/autopilot.json`:

```json
{
  "schemaVersion": 1,
  ...
}
```

After update, ow-setup checks:
1. Read `.otterwise/config.json` if it exists
2. Compare `schemaVersion` against expected version for current plugin version
3. If mismatch: apply migration (add new fields with defaults, rename fields, etc.)
4. Same for `autopilot.json`

**Migration rules** are documented inline in the ow-setup SKILL.md as a migration table:

```
Schema Migration Table:
  config.json:
    v1 → v2: add "schemaVersion": 2, add "pluginVersion": "x.x.x"
  autopilot.json:
    v1 → v2: add "schemaVersion": 2, add "pluginVersion": "x.x.x"
```

Each version bump that changes cache schema MUST add an entry to this table.

#### 3.2.4 Migration Safety Rules

- Never delete user data fields — only add or rename
- Always preserve the `rounds` array (append-only, immutable)
- Back up the original file before migrating: copy to `{filename}.backup-v{old}`
- If migration fails, restore from backup and report FAIL
- If `.otterwise/` doesn't exist, skip migration entirely (no active session)

### 3.3 settings.json Tool Permissions

The most common migration is adding new MCP tools to `settings.json`. After update:

1. Read `settings.json` → current `permissions.allow` array
2. Read the expected tool list from the new version's documentation (hardcoded in SKILL.md)
3. Compute diff: `missing = expected - current`
4. If missing tools exist: add them, report as auto-fix

Current expected tools (v1.2.0):
```json
[
  "mcp__python-repl__python_repl"
]
```

---

## 4. ow-setup Terminal UI Design

### 4.1 Design Principles

Since ow-setup is a SKILL.md (not a script), the "UI" is markdown that Claude outputs. Design for:

- **Scannable**: Status at a glance via aligned indicators
- **Consistent**: Every check follows the same `INDICATOR  Description` pattern
- **Compact**: One line per check, no verbose explanations unless there's a failure
- **Structured**: Clear section headers, summary table at the end
- **Monospace-friendly**: Renders well in Claude Code's terminal (CommonMark, monospace font)

### 4.2 Output Structure

```
 ___  _   _                      _
/ _ \| |_| |_ ___ _ ____      _(_)___  ___
| | | | __| __/ _ \ '__\ \ /\ / / / __|/ _ \
| |_| | |_| ||  __/ |   \ V  V /| \__ \  __/
\___/ \__|\__\___|_|    \_/\_/ |_|___/\___|

Setup & Diagnostics  v1.1.0
────────────────────────────────────────

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
  PASS  settings.json valid (1 tool: python_repl)
  PASS  plugin.json valid
  PASS  hooks.json valid

Updates
  PASS  Git repo clean
  UPDATE  3 commits behind (v1.1.0 -> v1.2.0)
    |- abc1234 Add new visualization tool
    |- def5678 Fix kernel timeout handling
    |- 890abcd Update dependencies
    Update now? (will run: git pull, npm install, rebuild)

Tests
  PASS  78/78 tests passing

────────────────────────────────────────
Summary: 15 PASS | 2 WARN | 0 FAIL | 1 UPDATE

Status: Ready to use
```

### 4.3 Indicator Definitions

Each check line uses a fixed-width indicator followed by two spaces and a description:

| Indicator | Meaning | When Used |
|-----------|---------|-----------|
| `PASS` | Check passed | Requirement met |
| `FAIL` | Check failed, needs fix | Critical requirement missing |
| `WARN` | Non-critical issue | Optional dependency missing, dirty worktree |
| `UPDATE` | Update available | Remote has new commits |
| `DONE` | Action completed | Auto-fix applied, update installed |
| `SKIP` | Check skipped | Precondition not met (e.g., no .otterwise/ for migration) |

### 4.4 Section Order

1. **Banner** — ASCII art logo + version + separator line
2. **Environment** — Node, Python, npx
3. **Dependencies** — node_modules, package versions
4. **MCP Server** — Source exists, compiles, starts
5. **Python Worker** — Source exists, imports, optional packages
6. **Configuration** — All config files valid
7. **Updates** — Git status, remote check, update prompt
8. **Migration** (conditional) — Only shown if update was applied and migration needed
9. **Tests** — Vitest results
10. **Summary line** — Counts by indicator type
11. **Status line** — Overall verdict

### 4.5 Auto-fix Behavior

When a FAIL is detected and auto-fix is possible:

```
Dependencies
  FAIL  node_modules missing
  DONE  Installed (npm install completed)
```

The skill runs the fix immediately and re-checks, showing both the FAIL and the DONE on consecutive lines. If the fix fails, show FAIL on both.

### 4.6 Update Section Detail

When an update is available, the Updates section expands to show:

```
Updates
  PASS  Git repo clean
  UPDATE  3 commits behind (v1.1.0 -> v1.2.0)
    |- abc1234 Add new visualization tool
    |- def5678 Fix kernel timeout handling
    |- 890abcd Update dependencies
```

Claude then asks the user: "Update now?" and if confirmed:

```
Updates
  PASS  Git repo clean
  DONE  Updated to v1.2.0 (3 commits pulled)
  DONE  Dependencies refreshed (npm install)
  DONE  MCP server rebuilt
```

### 4.7 Migration Section (Conditional)

Only shown after an update that requires migration:

```
Migration
  DONE  settings.json: added 2 new tool permissions
  DONE  .otterwise/config.json: migrated schema v1 -> v2
  SKIP  .otterwise/autopilot.json: no active session
```

---

## 5. Post-Update Rebuild Pipeline

### 5.1 Build Steps

After git pull, execute in order:

```
1. npm install          (if package.json changed)
   cd servers/python-repl && npm install

2. esbuild bundle       (always, after pull)
   cd servers/python-repl && npm run build
   → produces dist/mcp-server.cjs

3. Verify build output
   Check dist/mcp-server.cjs exists and is non-empty
```

### 5.2 Build Failure Handling

If npm install fails:
- Report FAIL with error output
- Do NOT proceed to build step
- Suggest: "Try deleting node_modules and running npm install manually"

If esbuild fails:
- Report FAIL with error output
- The old dist/mcp-server.cjs remains (git pull updated source, but bundle is stale)
- Suggest: "Run `cd servers/python-repl && npm run build` manually"

---

## 6. Marketplace Readiness

### 6.1 Required Files

For Claude marketplace compatibility, the plugin must have:

```
.claude-plugin/
  plugin.json          # Plugin manifest (skills, metadata)
  marketplace.json     # Marketplace listing metadata
.mcp.json              # MCP server configuration
settings.json          # Default permissions
hooks/hooks.json       # Post-tool-use hooks
```

### 6.2 Version Sync

All version references must stay in sync:
- `.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `metadata.version` AND `plugins[0].version`

ow-setup validates this and reports FAIL if they diverge.

### 6.3 Skills Registration

All skills in `skills/` must be registered in `plugin.json`. ow-setup validates:
- Every entry in `plugin.json.skills[]` has a corresponding `skills/{name}/SKILL.md`
- Every `skills/*/SKILL.md` has a corresponding entry in `plugin.json.skills[]`

---

## 7. Security Considerations

### 7.1 Update Safety

- Updates use `git pull --ff-only` — no force pulls, no rebasing
- Dirty worktree blocks update (user must commit/stash first)
- No automatic execution of arbitrary post-update scripts
- Build step only runs known commands (npm install, npm run build)

### 7.2 Config Migration Safety

- Backup before migrate
- Never delete user data
- Migration is additive only (add fields, never remove)
- If migration fails, restore backup

### 7.3 Network Failures

- `git fetch` failure is a WARN, not a FAIL — plugin still works offline
- No retry loops — single attempt, report result
- No external API calls beyond git remote

---

## 8. Component Ownership Map

| Component | File(s) | Owner |
|-----------|---------|-------|
| Version check logic | `skills/ow-setup/SKILL.md` §6 | ow-setup skill |
| Update execution | `skills/ow-setup/SKILL.md` §6 | ow-setup skill |
| Config migration | `skills/ow-setup/SKILL.md` §5 + new §8 | ow-setup skill |
| Post-update rebuild | `skills/ow-setup/SKILL.md` §6 | ow-setup skill |
| Terminal UI format | `skills/ow-setup/SKILL.md` Output Format | ow-setup skill |
| Build pipeline | `servers/python-repl/scripts/build.mjs` | esbuild config |
| MCP server | `servers/python-repl/src/index.ts` | TypeScript source |
| Plugin manifest | `.claude-plugin/plugin.json` | Plugin registry |
| Marketplace config | `.claude-plugin/marketplace.json` | Marketplace listing |

---

## 9. Implementation Plan

### Phase 1: Update ow-setup SKILL.md
1. Replace the Output Format section with the new terminal UI design (§4)
2. Expand Step 6 (Update Check) with the full version check flow (§2.2)
3. Add update execution flow after Step 6 (§2.3)
4. Add Step 8: Migration (§3) — conditional, only after update
5. Add migration table for schema versioning (§3.2.3)
6. Update Step 5 (Configuration) to validate version sync (§6.2) and skills registration (§6.3)

### Phase 2: Add schema versioning to cache files
1. Document the `schemaVersion` field convention
2. Add migration table to SKILL.md

### Phase 3: Marketplace validation
1. Add version sync check to Step 5
2. Add skills registration check to Step 5

All changes go into `skills/ow-setup/SKILL.md` — the skill is the implementation.

---

## 10. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `skills/ow-setup/SKILL.md` | Major update | New terminal UI, expanded update flow, migration support |
| `.claude-plugin/plugin.json` | No change | Already correct |
| `.claude-plugin/marketplace.json` | No change | Already correct |
| `settings.json` | No change | Already correct |
| `.mcp.json` | No change | Already correct |

The entire auto-update + migration + UI redesign is implemented by updating the SKILL.md specification. No new scripts or code files are needed — Claude follows the skill spec at runtime.

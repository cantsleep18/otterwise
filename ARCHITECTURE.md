# Otterwise Architecture

Autonomous compound research platform for Claude Code marketplace.

## Overview

Otterwise is a plugin that spawns agent teams to conduct autonomous research on datasets. It runs as a Claude Code extension with support for seamless auto-updates through git-based versioning.

## Directory Structure

```
otterwise/
├── .claude-plugin/              # Plugin manifest (marketplace spec)
│   ├── plugin.json              # Skill definitions (canonical version source)
│   └── marketplace.json         # Marketplace metadata (synced from plugin.json)
├── skills/                      # User-facing capabilities
│   ├── research/                # Start new research session
│   ├── continue/                # Expand existing session
│   ├── status/                  # Show session state
│   ├── autopilot/               # Run autonomous research
│   ├── autopilot-pause/         # Pause/resume autopilot
│   ├── autopilot-abort/         # Stop autopilot
│   ├── ow-setup/                # Setup, diagnose, update plugin
│   └── dashboard/               # Launch visualization dashboard
├── servers/                     # MCP servers
│   └── python-repl/             # Bundled Python execution server
├── hooks/                       # Event handlers
│   └── hooks.json               # PostToolUse validation hooks
├── scripts/                     # Utilities (called from ow-setup)
│   ├── secure-update.sh         # Security checks for updates
│   ├── migrate.sh               # Schema migration for user data
│   ├── version-sync.sh          # Version consistency checker
│   ├── check-version-sync.sh    # CI script to verify versions
│   ├── validate-summary.sh      # Hook: validate task summaries
│   └── validate-autopilot-state.sh  # Hook: validate autopilot state
├── dashboard/                   # Research graph visualization UI
├── tests/                       # Integration tests
├── settings.json                # Tool permissions (empty, no MCP tools)
├── .mcp.json                    # MCP server config (empty, server bundled)
├── CLAUDE.md                    # Project instructions (this repo)
├── ARCHITECTURE.md              # This file
├── README.md                    # User guide
└── CHANGELOG.md                 # Version history
```

## Plugin Installation

### Fresh Install

User runs: `claude extension add otterwise`

Claude Code:
1. Downloads plugin from marketplace (official registry or GitHub release)
2. Extracts to `~/.claude/plugins/cache/otterwise/otterwise/{version}/`
3. Parses `.claude-plugin/plugin.json` to discover skills
4. Creates `~/.claude/plugins/data/otterwise-otterwise/` for user state
5. Loads settings.json (permissions)
6. Registers hooks from hooks.json
7. Makes skills available in command palette

### Directory Locations (After Install)

**Plugin code (read-only in session):**
```
~/.claude/plugins/cache/otterwise/otterwise/1.3.0/
├── .claude-plugin/
├── skills/
├── servers/python-repl/
├── scripts/
└── ...
```

**User data (persists across updates):**
```
~/.claude/plugins/data/otterwise-otterwise/
└── .otterwise/                 # May be symlinked to project's .otterwise
    ├── config.json             # Research session graph config
    ├── autopilot.json          # Autopilot session state
    ├── autopilot-state.json    # Control signal (pause/abort/play)
    └── update-check.json       # Cached version info (1-hour TTL)
```

## Plugin Lifecycle

### Normal Operation

1. User invokes skill: `/otterwise:research`
2. Claude Code loads `.claude-plugin/plugin.json` from cache
3. Finds skill path: `skills/research`
4. Executes skill (shell/Python script with access to ${CLAUDE_PLUGIN_ROOT})
5. Skill accesses user data in `~/.claude/plugins/data/otterwise-otterwise/`
6. On tool use (TaskUpdate, Write), hooks trigger validation scripts

### PostToolUse Hooks

```json
{
  "matcher": "TaskUpdate",
  "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate-summary.sh $TOOL_INPUT"
}
```

Hooks run after specific tools to validate state without modifying tool behavior.

### Version Files (Source of Truth)

`.claude-plugin/plugin.json` is the canonical version source:
- Read by Claude Code to discover skills
- Used by ow-setup during update detection
- Synced to `marketplace.json` by `version-sync.sh`

```json
{
  "name": "otterwise",
  "version": "1.3.0",
  "skills": [ ... ]
}
```

## Auto-Update Flow

### Detection (ow-setup skill)

1. Verify git repo present at plugin install location (usually cloned from GitHub)
2. Load `.otterwise/update-check.json` (cached, 1-hour TTL)
3. If cache fresh, show cached result
4. If stale, run:
   - `git fetch origin main`
   - Compare local `.claude-plugin/plugin.json` version vs remote
   - `git rev-list HEAD..origin/main --count` (commits behind)
   - Cache result with timestamp

### Pre-Update Checks (scripts/secure-update.sh pre-update)

Before pulling, validate:
- Remote origin matches canonical repo (github.com/cantsleep18/otterwise)
- History is fast-forward-able (no divergence)
- Backup current config to `.otterwise/update-backup/{timestamp}`

Abort if security checks fail.

### Update Execution

1. `git pull origin main --ff-only` (only accept fast-forward)
2. `bash scripts/secure-update.sh post-update` (validate pulled files)
3. `bash scripts/migrate.sh` (upgrade user data schemas)
4. Clear plugin cache: `rm -rf ~/.claude/plugins/cache/otterwise/`
5. User must restart Claude Code to load new version

### Post-Update Checks (scripts/secure-update.sh post-update)

After pulling, validate:
- No unexpected files added (only .sh files in scripts/)
- No unauthorized permissions in settings.json
- No dangerous hooks patterns
- No secrets leaked (.env files, API keys, tokens)

Rollback if validation fails.

### Migration (scripts/migrate.sh)

After git pull, reconcile config changes:
- Merge settings.json (preserve user customizations, validate permissions)
- Merge hooks.json (ensure all required matchers present)
- Validate schema version of user data files (config.json, autopilot.json, autopilot-state.json)
- Upgrade schema if needed (v1 → v2, etc.)
- Back up old schemas before upgrading
- Skip if files don't exist

### Rollback

If any phase fails after git pull:
```bash
git reset --hard $PRE_UPDATE_SHA    # Discard pulled commits
rm -rf ~/.claude/plugins/cache/otterwise/  # Remove any cache marker
# Restore from backup if needed
```

User can retry update later.

## Data Persistence

User session data lives in `~/.claude/plugins/data/otterwise-otterwise/` and survives plugin updates because it's stored separately from the cache.

### config.json (Research Session Graph)

Schema v2:
```json
{
  "schemaVersion": 2,
  "pluginVersion": "1.3.0",
  "sessionId": "...",
  "nodes": [
    { "id": "node1", "type": "dataset", "title": "...", ... }
  ],
  "edges": [ ... ]
}
```

- Additive schema: new fields added, old preserved
- `nodes` array is append-only: never delete nodes, only add
- `schemaVersion` incremented when structure changes
- `pluginVersion` records which plugin version created/updated the file

### autopilot.json (Autopilot Session)

Schema v2: autopilot configuration, node selections, loop settings.

### autopilot-state.json (Runtime Control)

Schema v2: current command (play/pause/abort), updatedAt timestamp, reason.

### update-check.json (Version Cache)

Not a user data file — transient cache cleared on update:
```json
{
  "checked": 1774361915235,           # Timestamp (ms)
  "localVersion": "1.2.0",
  "remoteVersion": "1.3.0",
  "commitsBehind": 3,
  "commits": [
    { "sha": "abc1234", "message": "Fix node selection" }
  ]
}
```

TTL: 1 hour. If `now - checked > 3600000`, re-check.

## Security Model

### Pre-Update: Source Verification

```bash
# Must match canonical repo
EXPECTED_REMOTE="https://github.com/cantsleep18/otterwise.git"
EXPECTED_REMOTE_SSH="git@github.com:cantsleep18/otterwise.git"
```

### Integrity: Fast-Forward Only

```bash
git pull origin main --ff-only    # Abort if not FF-mergeable
```

Prevents force pulls and history rewrites.

### Hook Safety: Whitelist

Hooks allowed to reference only:
- `scripts/validate-summary.sh`
- `scripts/validate-autopilot-state.sh`

Any other command patterns rejected (curl, eval, bash -c, etc.).

### File Scanning: No Scripts Outside scripts/

New files added by update checked:
- Shell scripts must be in `scripts/` directory only
- No .env, .secret, credential files
- No binaries

### Secret Detection

Config files scanned for patterns:
- API keys: `AKIA*`, `sk-*`
- Tokens: `ghp_*`, `bearer *`
- Private keys: `PRIVATE KEY`, `private_key`

### Rollback: Timestamped Backups

```
.otterwise/update-backup/20260324T231800Z/
├── .claude-plugin/plugin.json
├── .claude-plugin/marketplace.json
├── .mcp.json
├── hooks/hooks.json
├── settings.json
└── HEAD_SHA
```

Keeps last 5 backups; oldest pruned when 6th created.

## Version Consistency

Three version fields must always match:

1. `.claude-plugin/plugin.json` `.version` (canonical)
2. `.claude-plugin/marketplace.json` `.metadata.version`
3. `.claude-plugin/marketplace.json` `.plugins[0].version`

Script to sync:
```bash
bash scripts/version-sync.sh 1.3.0
```

ow-setup checks all three and auto-fixes if mismatch detected.

## Skill Interface

Each skill is a directory with:

```
skills/{name}/
├── SKILL.md           # Frontmatter + description (required)
└── [implementation]   # exec, run, or code
```

### SKILL.md Format

```markdown
---
name: research
description: Start a new Otterwise research session on a dataset
---

[Implementation details...]
```

Frontmatter (YAML) is validated by ow-setup:
- `name` field required
- `description` field required
- Must be valid YAML

### Environment Variables Available

- `${CLAUDE_PLUGIN_ROOT}` — Plugin root directory (e.g., ~/.claude/plugins/cache/otterwise/otterwise/1.3.0)
- `${CLAUDE_SESSION_ID}` — Current session ID
- Standard shell variables (USER, PWD, etc.)

## MCP Server Integration

### python-repl Server

Located in `servers/python-repl/`, provides Python code execution.

**Config (.mcp.json):**
```json
{
  "mcpServers": {
    "python-repl": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/python-repl/dist/mcp-server.cjs"]
    }
  }
}
```

**Distribution:**
- Source: TypeScript in `servers/python-repl/src/`
- Built: `npm run build` creates bundled `dist/mcp-server.cjs`
- Single CJS file bundled via esbuild (zero npm install at runtime)
- Python worker uses only stdlib (no pip install)

### Tool Permissions (settings.json)

```json
{
  "permissions": {
    "allow": []  // Empty: no MCP tools exposed to Claude Code
  }
}
```

REPL removed after v1.2.0; Claude Code runs Python via skill execution, not MCP.

## Build & Release

### Build

```bash
cd servers/python-repl
npm install
node scripts/build.mjs    # Creates dist/mcp-server.cjs
```

### Version Bump

```bash
./scripts/version-sync.sh 1.4.0
git add .claude-plugin/
git commit -m "Bump version to 1.4.0"
git push origin main
```

### Publish to Marketplace

1. Push git tag: `git tag v1.4.0 && git push origin v1.4.0`
2. Submit to Anthropic marketplace (process TBD)

## Testing

### Integration Tests

```bash
npm test -- --run
```

Tests validate:
- Skill discovery from plugin.json
- Hook registration
- Update flow simulation
- Migration logic
- Version consistency

### Manual Testing

1. Install from marketplace: `claude extension add otterwise`
2. Run diagnostic: `/otterwise:ow-setup`
3. Clone repo and test auto-update: `git clone https://github.com/cantsleep18/otterwise.git && /otterwise:ow-setup`

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Skill definitions, canonical version |
| `.claude-plugin/marketplace.json` | Marketplace metadata |
| `scripts/secure-update.sh` | Update security validation |
| `scripts/migrate.sh` | User data schema migration |
| `scripts/version-sync.sh` | Version consistency |
| `hooks/hooks.json` | PostToolUse event handlers |
| `settings.json` | MCP tool permissions |
| `.mcp.json` | MCP server config |
| `skills/ow-setup/SKILL.md` | Update detection & execution |

## Development Guidelines

- **Always update all three version fields together** (plugin.json, marketplace.json metadata & plugins)
- **Never delete user data** (append-only semantics for nodes array)
- **Always backup before migrating schema** (migrate.sh does this automatically)
- **Fast-forward only pulls** (no force-rebase during updates)
- **Whitelist hook commands** (no arbitrary execution)
- **Test in marketplace context** (install via extension add, not git clone)

## Future Improvements

- Marketplace auto-update without manual git clone (once marketplace plugin updates work)
- Compressed plugin size (remove node_modules from cache)
- Incremental sync (download only changed files, not entire version)
- User preference for update timing (auto, manual, ask)

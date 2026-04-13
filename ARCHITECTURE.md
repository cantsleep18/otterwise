# Otterwise Architecture

종가베팅 strategy research platform for Claude Code marketplace.

## Overview

Otterwise is a plugin that spawns agent teams to conduct autonomous 종가베팅 research. It runs as a Claude Code extension with support for seamless auto-updates through git-based versioning. The core loop is OLJC (Observe, Look, Judge, Crystallize) -- an infinite cycle that discovers market events, backtests overnight returns (buy at close, sell at next open), and crystallizes findings into strategy documents when the numbers pass quantitative gates.

## Directory Structure

```
otterwise/
├── .claude-plugin/              # Plugin manifest (marketplace spec)
│   ├── plugin.json              # Skill definitions (canonical version source)
│   └── marketplace.json         # Marketplace metadata (synced from plugin.json)
├── skills/                      # User-facing capabilities
│   ├── research/                # Start new research session (single OLJC cycle)
│   ├── continue/                # Expand existing session (graph expansion)
│   ├── status/                  # Show strategy graph with PF/win-rate
│   ├── autopilot/               # Run autonomous OLJC loop (infinite)
│   ├── autopilot-pause/         # Pause/resume autopilot
│   ├── autopilot-abort/         # Stop autopilot
│   └── ow-setup/                # Setup, diagnose, update plugin
├── hooks/                       # Event handlers
│   └── hooks.json               # PostToolUse validation hooks
├── scripts/                     # Utilities (called from ow-setup)
│   ├── secure-update.sh         # Security checks for updates
│   ├── migrate.sh               # Schema migration for user data (includes v1.4→v1.5)
│   ├── version-sync.sh          # Version consistency checker
│   ├── check-version-sync.sh    # CI script to verify versions
│   ├── validate-strategy.sh     # Hook: validate strategy .md format (backtest fields)
│   ├── warn-strategy-evidence.sh # Hook: warn on missing overnight-return evidence
│   └── validate-state.sh        # Hook: validate state file integrity
├── tests/                       # Integration tests
├── settings.json                # Tool permissions (empty, no MCP tools)
├── .mcp.json                    # MCP server config (empty, REPL removed)
├── CLAUDE.md                    # Project instructions (this repo)
├── ARCHITECTURE.md              # This file
├── README.md                    # User guide
└── CHANGELOG.md                 # Version history
```

## Plugin Installation

### Fresh Install

User runs: `claude extension add cantsleep18/otterwise`

Claude Code:
1. Downloads plugin from marketplace (official registry or GitHub release)
2. Extracts to `~/.claude/plugins/cache/cantsleep18-otterwise/{version}/`
3. Parses `.claude-plugin/plugin.json` to discover skills
4. Creates `~/.claude/plugins/data/otterwise-otterwise/` for user state
5. Loads settings.json (permissions)
6. Registers hooks from hooks.json
7. Makes skills available in command palette

### Directory Locations (After Install)

**Plugin code (read-only in session):**
```
~/.claude/plugins/cache/cantsleep18-otterwise/
├── .claude-plugin/
├── skills/
├── hooks/
├── scripts/
└── ...
```

**User data (persists across updates):**
```
~/.claude/plugins/data/otterwise-otterwise/
└── .otterwise/
    ├── config.json             # Research session config (dataset, fee, goals)
    ├── autopilot.json          # Autopilot session state (strategies + backtest summaries)
    ├── autopilot-state.json    # Control signal (pause/abort/play)
    ├── update-check.json       # Cached version info (1-hour TTL)
    ├── strategies/             # OLJC output -- Obsidian vault (.md files with wikilinks)
    │   └── {YYYYMMDD_HHMM}_{8hex}_{name}.md  # Strategy documents with backtest
    ├── artifacts/              # Per-cycle intermediate outputs
    │   └── {id}_{name}/
    │       ├── 01_discovery.md   # OBSERVE: event + 종가베팅 가설
    │       ├── 02_evidence.md    # LOOK: event table + overnight returns + aggregates
    │       └── 03_evaluation.md  # JUDGE: quantitative gates + WRITE/SKIP
    └── archive/                # Archived strategies from previous versions
        └── v1.4/               # v1.4 strategies (incompatible format)
```

## OLJC Loop

Autopilot runs an infinite OLJC cycle. Each iteration spawns agent teams via the Teams API:

```
OBSERVE → LOOK → JUDGE → CRYSTALLIZE → ROUTE → OBSERVE ...
                                          ↑
                                 autopilot-state.json (pause/abort)
```

| Phase | What happens | Teams API |
|-------|-------------|-----------|
| OBSERVE | Read data, discover events that might work for 종가베팅 | 1 researcher |
| LOOK | Mark event dates, calculate overnight returns (close→next open), aggregate metrics | K researchers (parallel) |
| JUDGE | Quantitative gates: PF > 1.5, positive after fees, sufficient trades → WRITE or SKIP | None (team lead) |
| CRYSTALLIZE | Write strategy document with backtest results | 1 researcher |
| ROUTE | Adaptive router picks next research mode and expansion type | None (team lead) |

Output: `.otterwise/strategies/{YYYYMMDD_HHMM}_{8hex}_{name}.md` -- Obsidian-compatible files with wikilinks, tags, and Dataview frontmatter. Each strategy is a graph node; `[[wikilinks]]` form edges.

### Fee Model

- Stock: 0.24% round-trip (거래세 0.20% + 수수료) -- configurable in `config.json` `fee.stock_pct`
- ETF: 0.04% round-trip -- configurable in `config.json` `fee.etf_pct`
- Gross return: `(next_open - close) / close`
- Net return: `gross - fee_pct/100`

### JUDGE Gates

All must pass for WRITE:
1. `profit_factor > 1.5`
2. `avg_return_pct > 0` (positive after fees)
3. Sufficient trades (>=10 preferred, team lead judgment for rare events)

### Strategy Types

| Type | Description |
|------|-------------|
| `seed` | New observation, independent strategy |
| `derive` | Variation of an existing strategy |
| `explore` | Inspired by existing findings, different domain |
| `combine` | Merges insights from multiple strategies |

## Data Configuration

### config.json

```json
{
  "dataset": {
    "prices": "/absolute/path/to/prices/",
    "sources": "/absolute/path/to/sources/"
  },
  "goals": "종가베팅 전략 발굴",
  "investmentMode": true,
  "fee": {
    "stock_pct": 0.24,
    "etf_pct": 0.04
  },
  "sectors": {
    "반도체": ["005930", "000660"]
  }
}
```

No data format enforcement -- Claude reads whatever format is in the prices/sources directories.

## Plugin Lifecycle

### Normal Operation

1. User invokes skill: `/otterwise:research`
2. Claude Code loads `.claude-plugin/plugin.json` from cache
3. Finds skill path: `skills/research`
4. Executes skill
5. Skill accesses user data in `~/.claude/plugins/data/otterwise-otterwise/`
6. On tool use (Write), hooks trigger validation scripts

### PostToolUse Hooks

```json
{
  "matcher": "Write",
  "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate-strategy.sh"
}
```

Hooks run after specific tools to validate state without modifying tool behavior.

### Version Files (Source of Truth)

`.claude-plugin/plugin.json` is the canonical version source:
- Read by Claude Code to discover skills
- Used by ow-setup during update detection
- Synced to `marketplace.json` by `version-sync.sh`

## Auto-Update Flow

### Detection (ow-setup skill)

1. Verify git repo present at plugin install location
2. Load `.otterwise/update-check.json` (cached, 1-hour TTL)
3. If stale, `git fetch origin main` and compare versions
4. Cache result with timestamp

### Update Execution

1. Pre-update security checks (`scripts/secure-update.sh pre-update`)
2. `git pull origin main --ff-only` (fast-forward only)
3. Post-update validation (`scripts/secure-update.sh post-update`)
4. Migration (`scripts/migrate.sh` -- includes v1.4→v1.5)
5. Clear plugin cache
6. User must restart Claude Code to load new version

### v1.4 → v1.5 Migration

- Old strategies archived to `.otterwise/archive/v1.4/` (not deleted)
- config.json migrated: flat `dataset` string → `{ prices, sources }` object, `fee` block added
- autopilot.json strategies cleared (format incompatible)
- Old artifacts deleted

## Security Model

- Source verification: remote origin must match canonical repo
- Fast-forward only pulls (no force-rebase)
- Hook command whitelist (only scripts/ directory)
- File scanning: no scripts outside scripts/, no secrets
- Timestamped backups before each update (last 5 kept)

## Version Consistency

Three version fields must always match:

1. `.claude-plugin/plugin.json` `.version` (canonical)
2. `.claude-plugin/marketplace.json` `.metadata.version`
3. `.claude-plugin/marketplace.json` `.plugins[0].version`

Script to sync: `bash scripts/version-sync.sh 1.5.0`

## Testing

```bash
npm test -- --run
```

Tests validate skill discovery, hook registration, update flow, migration logic, and version consistency.

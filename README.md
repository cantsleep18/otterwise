<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Extension-blueviolet?style=for-the-badge" alt="Claude Code Extension" />
  <img src="https://img.shields.io/badge/version-1.3.0-blue?style=for-the-badge" alt="Version 1.3.0" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

# Otterwise

> **Autonomous compound research platform for Claude Code**

Like an otter using tools to crack open shellfish, Otterwise autonomously cracks open your datasets -- spawning research teams and building an ever-expanding graph of discoveries.

**Zero setup. Just plug in and research.**

---

## Install

### From Marketplace

```bash
claude extension add otterwise
```

### From GitHub (Self-Updating)

For auto-update support via git, clone the repository and run setup:

```bash
git clone https://github.com/cantsleep18/otterwise.git
cd otterwise
/otterwise:ow-setup
```

### First-Time Setup

After installing, run the setup diagnostic to confirm everything is ready:

```bash
/otterwise:ow-setup
```

This checks your environment (Node.js, Python), validates config files, and reports any issues.

### Installation Locations

**Marketplace install:** Plugin code lives in `~/.claude/plugins/cache/otterwise/`. To enable auto-updates, clone the repo:
```bash
git clone https://github.com/cantsleep18/otterwise.git
cd otterwise
/otterwise:ow-setup
```

**Git install:** Plugin code is in your cloned directory. Auto-updates work automatically.

### Updating

Otterwise updates itself. Run `/otterwise:ow-setup` at any time -- it detects new versions, pulls changes, migrates your config and cache, and verifies the result. Your `.otterwise/` research data is always preserved.

See [Auto-Update](#auto-update) for details on the update lifecycle.

For more information about plugin architecture and how updates work, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Highlights

| | |
|---|---|
| **Autonomous Research** | Give it a dataset and goals; it designs and executes multi-agent analysis |
| **Graph-Based Expansion** | Research grows as a DAG, not linearly -- each node branches into new directions |
| **Agent Teams** | Parallel analysis by dynamically created teammate agents |
| **Auto Pilot** | Infinite autonomous graph expansion -- runs until you abort |
| **Dashboard** | Real-time force-graph visualization of the research DAG |
| **Auto-Update** | Seamless self-updating with cache migration and version checking via `ow-setup` |

---

## Quick Start

```bash
# 1. Install from marketplace
claude extension add cantsleep18/otterwise

# 2. Verify setup
/otterwise:ow-setup

# 3. Start researching (in any project)
/otterwise:research
```

You'll be prompted for:
- **Dataset** -- path to CSV, Excel, Parquet, etc.
- **Goals** -- research questions (optional; defaults to general profiling)

Otterwise creates a `.otterwise/` directory, spawns a research lead agent, and kicks off parallel analysis.

---

## How It Works

```
/otterwise:research
        |
        v
  Research Lead Agent
        |  reads config + prior reports
        |  plans 3-5 parallel objectives
        v
  Agent Team (dynamic)
        |  each teammate:
        |    |-- analyzes data
        |    '-- writes summary.md
        v
  Research Lead
        |  synthesizes -> report.md (YAML frontmatter DAG)
        |  identifies branches for expansion
        v
  .otterwise/
    config.json
    20260320_143022_abc_profiling/
      report.md          <- DAG node
      teammate-1/
        summary.md
```

Each `report.md` has YAML frontmatter (`id`, `parentIds`, `status`, `findingsCount`) defining the research DAG. `/otterwise:continue` reads all reports and expands the graph.

---

## Commands

| Command | Description |
|---------|-------------|
| `/otterwise:research` | Start a new research session on a dataset |
| `/otterwise:continue` | Expand the research graph into new directions |
| `/otterwise:status` | Display the research graph as a tree |
| `/otterwise:autopilot` | Run infinite autonomous research on a dataset |
| `/otterwise:autopilot-pause` | Pause or resume a running autopilot session (toggles) |
| `/otterwise:autopilot-abort` | Abort the autopilot loop |
| `/otterwise:dashboard` | Launch or stop the research graph visualization |
| `/otterwise:ow-setup` | Setup, diagnose, and update Otterwise |

```
Research Graph:
+-- completed  basic-profiling (5 findings)
|   +-- completed  correlation-deep-dive (4 findings)
|   |   \-- in-progress  time-series-analysis
|   \-- completed  distribution-analysis (3 findings)
|       \-- pending  segmentation
\-- (no more nodes)
```

---

## Auto Pilot

Autopilot runs an infinite research expansion loop. It continuously adds nodes to the research DAG -- exploring new directions, deepening findings, and combining insights across branches. The loop never self-terminates; only user abort stops it.

Re-running `/otterwise:autopilot` on an existing `.otterwise/` directory resumes from the current state.

### Quick Start
```bash
/otterwise:autopilot /path/to/data.csv "Optional research goals"
```

### Controls
- **Pause/Resume**: `/otterwise:autopilot-pause` -- toggles pause state
- **Abort**: `/otterwise:autopilot-abort` -- stops the loop
- **Status**: `/otterwise:status` -- shows node count, DAG depth, and expansion direction
- **Dashboard**: `/otterwise:dashboard` -- launch the graph visualization

---

## Dashboard

Visualize the research DAG as an interactive force-directed graph.

### Quick Start
```bash
/otterwise:dashboard
```

Launches a Vite dev server at `http://localhost:5173` with a React app that renders your research graph using `react-force-graph-2d`. Nodes are color-coded by status and edges represent parent-child relationships (including multi-parent cross-branch nodes).

Running the command again stops the dashboard. You can also use `/otterwise:dashboard start` or `/otterwise:dashboard stop` explicitly.

---

## Auto-Update

Otterwise updates itself through `/otterwise:ow-setup`. When a new version is available, ow-setup detects it, pulls the update, migrates config and cache, and verifies everything -- all in one step.

**Requires:** Git repo present (cloned from GitHub). Marketplace-only installs won't auto-update until you clone the repo.

### Update Lifecycle

```
/otterwise:ow-setup
        |
        v
  1. DETECT — git fetch origin main, compare HEAD
        |       Shows commit count + version diff
        |       Caches result (1-hour TTL to avoid frequent fetches)
        v
  2. PRE-CHECKS — verify remote origin, fast-forward capable
        |          backup current config to .otterwise/update-backup/
        |          Abort if security checks fail
        v
  3. PULL — git pull --ff-only (user confirms first)
        |       Fails safely if worktree is dirty or history diverged
        |       Rolls back automatically on failure
        v
  4. POST-CHECKS — validate no dangerous files, secrets, or hooks
        |
        v
  5. MIGRATE — upgrade user data schemas (.otterwise/)
        |        Tracked config (settings.json, hooks.json, .mcp.json) updated by git
        |        User data backed up before migration (v1 → v2, etc.)
        v
  6. CACHE — clear plugin cache so Claude Code reloads from disk
        |        ~/.claude/plugins/cache/otterwise/ removed
        |        User must restart Claude Code session to load new version
        v
  7. VERIFY — version consistency across plugin.json + marketplace.json
        |        Re-run full diagnostics on new version
        v
  Done — report summary
```

### What Gets Updated

| Category | Files | Behavior |
|----------|-------|----------|
| **Tracked config** | `settings.json`, `.mcp.json`, `hooks/hooks.json`, `.claude-plugin/*.json` | Updated by `git pull` |
| **User data schemas** | `.otterwise/config.json`, `.otterwise/autopilot.json`, `.otterwise/autopilot-state.json` | Schema migration (additive only, backup first) |
| **Research data** | `.otterwise/*/report.md`, all node files | Never touched -- always preserved |
| **Plugin cache** | `~/.claude/plugins/cache/otterwise/` | Cleared; Claude Code reloads from disk on next session |

### Safety & Rollback

- **Pre-update backup**: Current config stored in `.otterwise/update-backup/{timestamp}/`
- **Fast-forward only**: No force-pull, prevents history rewrites
- **Atomic security checks**: Pre- and post-pull validation; rolls back on failure
- **Keep last 5 backups**: Old backups auto-pruned to avoid disk bloat

If an update fails, ow-setup automatically rolls back to the pre-update state. You can then retry the update after fixing any issues.

### Manual Cache Clear

If you need to force a clean state, delete the plugin cache:

```bash
rm -rf ~/.claude/plugins/cache/otterwise/
```

Then restart Claude Code and run `/otterwise:ow-setup` again.

---

## Troubleshooting

### "Git repo not found" message after install
You installed from the marketplace. To enable auto-updates:
```bash
git clone https://github.com/cantsleep18/otterwise.git
cd otterwise
/otterwise:ow-setup
```

### Update fails with "diverged history"
Your local branch has commits not in origin/main. Review changes:
```bash
git log --oneline origin/main..HEAD
```
Then decide: keep local commits (skip update) or rebase/reset to origin/main and retry.

### "Origin does not match expected repository"
Your git remote points to a fork, not the canonical repo. Verify:
```bash
git remote get-url origin
```
Should be: `https://github.com/cantsleep18/otterwise.git`

Update the remote if needed:
```bash
git remote set-url origin https://github.com/cantsleep18/otterwise.git
git fetch origin
/otterwise:ow-setup
```

### Plugin not picking up new version after update
Claude Code caches the plugin. Restart your Claude Code session:
1. Close Claude Code
2. Reopen Claude Code
3. Run a skill to trigger reload

For more details on how caching and updates work, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 20+

---

## Project Structure

```
otterwise/
  .claude-plugin/
    plugin.json            Plugin manifest
    marketplace.json       Marketplace metadata
  hooks/
    hooks.json             Quality validation hook
  skills/
    research/              /otterwise:research
    continue/              /otterwise:continue
    status/                /otterwise:status
    autopilot/             /otterwise:autopilot
    ow-setup/              /otterwise:ow-setup
    autopilot-pause/       /otterwise:autopilot-pause (toggles pause/resume)
    autopilot-abort/       /otterwise:autopilot-abort
    dashboard/             /otterwise:dashboard
  scripts/                 Validation and publishing scripts
  dashboard/               Research dashboard UI (Vite + React + react-force-graph-2d)
  tests/                   Integration and fixture tests
  settings.json            Claude Code permissions
```

---

## Configuration

Permissions are granted via `settings.json`:

```json
{
  "permissions": {
    "allow": []
  }
}
```

Research sessions store state in `.otterwise/config.json`:

```json
{
  "dataset": "/path/to/data.csv",
  "goals": ["Identify churn drivers", "Find seasonal patterns"],
  "created": "2026-03-20T10:00:00Z"
}
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and PR guidelines.

## License

[MIT](LICENSE)

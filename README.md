<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Extension-blueviolet?style=for-the-badge" alt="Claude Code Extension" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

# Otterwise

> **Autonomous compound research platform for Claude Code**

Like an otter using tools to crack open shellfish, Otterwise autonomously cracks open your datasets -- spawning research teams and building an ever-expanding graph of discoveries.

**Zero setup. Just plug in and research.**

---

## Highlights

| | |
|---|---|
| **Autonomous Research** | Give it a dataset and goals; it designs and executes multi-agent analysis |
| **Graph-Based Expansion** | Research grows as a DAG, not linearly -- each node branches into new directions |
| **Agent Teams** | Parallel analysis by dynamically created teammate agents |
| **Auto Pilot** | Autonomous graph expansion with intelligent direction selection |
| **Auto-Update** | Seamless self-updating with cache migration and version checking via `ow-setup` |

---

## Quick Start

```bash
# 1. Install as Claude Code extension
claude extension add /path/to/otterwise

# 2. Start researching (in any project)
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

Each `report.md` has YAML frontmatter (`id`, `parent`, `related`, `status`) defining the research DAG. `/otterwise:continue` reads all reports and expands the graph.

---

## Commands

| Command | Description |
|---------|-------------|
| `/otterwise:research` | Start a new research session on a dataset |
| `/otterwise:continue` | Expand the research graph into new directions |
| `/otterwise:status` | Display the research graph as a tree |
| `/otterwise:autopilot` | Run autonomous graph-based research on a dataset |
| `/otterwise:autopilot-pause` | Pause or resume a running autopilot session (toggles) |
| `/otterwise:autopilot-abort` | Abort autopilot and generate partial results |
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

Autopilot automates the research graph expansion cycle, expanding nodes autonomously without manual intervention.

### Quick Start
```bash
/otterwise:autopilot
```

You'll be prompted for:
- **Dataset** -- path to your data file
- **Goals** -- research questions (optional)

Autopilot creates an `.otterwise/autopilot.json` config and runs autonomous graph expansion.

### Configuration

Create `.otterwise/autopilot.json` to customize behavior:

```json
{
  "maxIterations": 5,
  "maxConcurrentTeammates": 3,
  "explorationStrategy": "balanced",
  "stopping": {
    "minFindingsPerNode": 2,
    "maxDeadEndRatio": 0.6
  },
  "scope": {
    "depthLimit": 4
  }
}
```

### Controls
- **Pause/Resume**: `/otterwise:autopilot-pause` -- toggles pause state; completes current node before pausing
- **Abort**: `/otterwise:autopilot-abort` -- stops immediately, generates partial report
- **Status**: `/otterwise:status` -- shows autopilot progress and research graph

---

## Auto-Update

Otterwise can update itself seamlessly through the `ow-setup` command. When a new version is available, `ow-setup` detects it, downloads the update, migrates your cache and config files, and verifies everything works -- all in one step.

### How It Works

```bash
/otterwise:ow-setup
```

The setup command runs a full diagnostic check and, if updates are available:

1. **Detects** new versions by checking the remote repository
2. **Downloads** the update (git pull from origin/main)
3. **Migrates** cache and config files to the new format (preserving your research sessions)
4. **Verifies** version consistency across plugin.json, marketplace.json, and package.json
5. **Re-runs** diagnostics to confirm everything is healthy

Your existing `.otterwise/` research data is preserved across updates. Config files are automatically migrated to any new schema.

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
  scripts/                 Validation and publishing scripts
  dashboard/               Research dashboard UI
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

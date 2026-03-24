<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Extension-blueviolet?style=for-the-badge" alt="Claude Code Extension" />
  <img src="https://img.shields.io/badge/Python-stdlib_only-green?style=for-the-badge&logo=python" alt="Zero pip install" />
  <img src="https://img.shields.io/badge/Tests-78_passing-brightgreen?style=for-the-badge" alt="78 tests passing" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

# Otterwise

> **Autonomous compound research platform for Claude Code**

Like an otter using tools to crack open shellfish, Otterwise autonomously cracks open your datasets -- spawning research teams, producing Jupyter notebooks, and building an ever-expanding graph of discoveries.

**Zero setup. Zero pip install. Just plug in and research.**

---

## Highlights

| | |
|---|---|
| **Autonomous Research** | Give it a dataset and goals; it designs and executes multi-agent analysis |
| **Graph-Based Expansion** | Research grows as a DAG, not linearly -- each node branches into new directions |
| **Jupyter Notebooks** | Every analysis produces reproducible `.ipynb` notebooks with inline figures |
| **Agent Teams** | Parallel analysis by dynamically created teammate agents |
| **Auto Pilot** | Multi-round autonomous research with intelligent direction selection |
| **Auto-Update** | Seamless self-updating with cache migration and version checking via `ow-setup` |
| **6 MCP Tools** | execute, notebook, state, install, interrupt, reset |
| **Zero Dependencies** | Python worker uses only stdlib -- no `pip install` needed |

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

## Architecture

```
                    ┌─────────────────────────────────┐
                    │         Claude Code CLI          │
                    └──────────┬──────────────────────┘
                               │ stdio (MCP protocol)
                    ┌──────────▼──────────────────────┐
                    │    TypeScript MCP Server         │
                    │    ├── 6 MCP tools               │
                    │    ├── Jupyter notebook manager   │
                    │    ├── Session lock + paths       │
                    │    └── Socket client (JSON-RPC)   │
                    └──────────┬──────────────────────┘
                               │ Unix domain socket
                               │ (JSON-RPC 2.0)
                    ┌──────────▼──────────────────────┐
                    │    Python Worker (stdlib only)    │
                    │    ├── exec() persistent namespace│
                    │    ├── matplotlib figure capture  │
                    │    ├── SIGTERM graceful shutdown   │
                    │    └── Parent PID monitoring       │
                    └─────────────────────────────────┘
```

**Key design choices:**
- **No IPython, no pip** -- worker uses `exec()` with Python stdlib only
- **Unix sockets** -- secure IPC with file permissions, not stdin/stdout
- **JSON-RPC 2.0** -- standard protocol with proper error codes
- **Session locking** -- prevents concurrent execution conflicts
- **Auto-respawn** -- worker crashes are recovered transparently

---

## How It Works

```
/otterwise:research
        │
        ▼
  Research Lead Agent
        │  reads config + prior reports
        │  plans 3-5 parallel objectives
        ▼
  Agent Team (dynamic)
        │  each teammate:
        │    ├── creates Jupyter notebook
        │    ├── executes Python analysis cell-by-cell
        │    └── writes summary.md
        ▼
  Research Lead
        │  synthesizes → report.md (YAML frontmatter DAG)
        │  identifies branches for expansion
        ▼
  .otterwise/
    config.json
    20260320_143022_abc_profiling/
      report.md          ← DAG node
      teammate-1/
        notebook.ipynb
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
| `/otterwise:autopilot` | Run autonomous multi-round research on a dataset |
| `/otterwise:autopilot-pause` | Pause or resume a running auto pilot session (toggles) |
| `/otterwise:autopilot-abort` | Abort auto pilot and generate partial results |
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

Auto pilot automates the research → continue cycle, running multiple rounds of analysis without manual intervention.

### Quick Start
```bash
/otterwise:autopilot
```

You'll be prompted for:
- **Dataset** -- path to your data file
- **Goals** -- research questions (optional)

Auto pilot creates an `.otterwise/autopilot.json` config and runs up to 5 rounds of autonomous research.

### Configuration

Create `.otterwise/autopilot.json` to customize behavior:

```json
{
  "maxIterations": 5,
  "maxConcurrentTeammates": 3,
  "explorationStrategy": "balanced",
  "stopping": {
    "minFindingsPerRound": 2,
    "maxDeadEndRatio": 0.6
  },
  "scope": {
    "depthLimit": 4
  }
}
```

### Controls
- **Pause/Resume**: `/otterwise:autopilot-pause` -- toggles pause state; completes current round before pausing
- **Abort**: `/otterwise:autopilot-abort` -- stops immediately, generates partial report
- **Status**: `/otterwise:status` -- shows auto pilot progress and research graph

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
5. **Re-installs** npm dependencies if package.json changed
6. **Re-runs** diagnostics to confirm everything is healthy

Your existing `.otterwise/` research data is preserved across updates. Config files are automatically migrated to any new schema.

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `execute_python` | Run code in persistent namespace; appends cell + output to notebook |
| `start_notebook` | Create `.ipynb` and load dataset as `df` |
| `get_kernel_state` | Return variable names, types, shapes, memory usage |
| `install_package` | Install whitelisted data-science package (pandas, numpy, scipy, etc.) |
| `interrupt_execution` | Send SIGINT to stop running code |
| `reset_kernel` | Clear the Python namespace |

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 20+
- Python 3.11+

**That's it.** No `pip install`. No virtual environment. The worker runs on Python stdlib alone. Data-science packages (pandas, numpy, matplotlib, etc.) are installed on-demand via the `install_package` tool.

---

## Project Structure

```
otterwise/
  .claude-plugin/
    plugin.json            Plugin manifest
    marketplace.json       Marketplace metadata
  agents/
    research-lead.md       DAG-aware research orchestrator
  hooks/
    hooks.json             Quality validation hook
  servers/
    python-repl/
      src/
        index.ts           MCP server entry (stdio transport, 6 tools)
        bridge/
          python-bridge.ts Socket-based bridge with auto-respawn
          socket-client.ts JSON-RPC 2.0 client over Unix sockets
          session-lock.ts  File-based concurrency lock
          paths.ts         Cross-platform socket path management
          types.ts         JSON-RPC 2.0 type definitions
        notebook/
          format.ts        Jupyter .ipynb read/write with cache
          types.ts         Notebook type definitions
        tools/
          execute.ts       execute_python implementation
          notebook.ts      start_notebook implementation
          state.ts         get_kernel_state implementation
          install.ts       install_package implementation
          interrupt.ts     interrupt_execution implementation
          reset.ts         reset_kernel implementation
      worker/
        worker.py          Python exec() worker (socket server)
      package.json
  skills/
    research/              /otterwise:research
    continue/              /otterwise:continue
    status/                /otterwise:status
    autopilot/             /otterwise:autopilot
    ow-setup/              /otterwise:ow-setup
    autopilot-pause/       /otterwise:autopilot-pause (toggles pause/resume)
    autopilot-abort/       /otterwise:autopilot-abort
  settings.json            Claude Code permissions
```

---

## Configuration

Permissions are granted via `settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__python-repl__python_repl"
    ]
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

# Otterwise

> Autonomous compound research platform for Claude Code

Like an otter using tools to crack open shellfish, Otterwise autonomously cracks open your datasets -- spawning research teams, producing Jupyter notebooks, and building an ever-expanding graph of discoveries.

## Features

- **Autonomous Research** -- Give it a dataset and goals; it designs and executes multi-agent analysis
- **Graph-Based Expansion** -- Research grows as a DAG, not linearly. Each node branches into new directions
- **Jupyter Notebooks** -- Every analysis produces reproducible `.ipynb` notebooks with inline figures
- **Interactive Dashboard** -- Real-time force-graph visualization of your research graph
- **Agent Teams** -- Parallel analysis by dynamically created teammate agents
- **Quality Hooks** -- Automated validation ensures every teammate produces a well-structured summary

## Quick Start

1. Install Otterwise as a Claude Code extension:

   ```bash
   claude extension add /path/to/otterwise
   ```

2. Point it at a dataset and start researching:

   ```
   /otterwise:research
   ```

   You will be prompted for:
   - Path to a dataset file (CSV, Excel, Parquet, etc.)
   - Research goals or questions (optional -- defaults to general profiling)

3. Otterwise creates a `.otterwise/` directory, spawns a research lead agent, and kicks off parallel analysis.

## Architecture

```
Claude Code ──stdio──▶ TypeScript MCP Server ──child_process──▶ Python Worker
                       (Node.js)                                 (IPython)
                       ├── 4 MCP tools                           ├── persistent kernel
                       ├── notebook JSON                         ├── matplotlib capture
                       └── JSON-line IPC                         └── variable introspection
```

The MCP server is written in TypeScript and communicates with Claude Code over stdio. It spawns a Python child process running an IPython kernel for code execution, managing communication via JSON-line IPC.

## How It Works

```
User
 |
 |  /otterwise:research
 v
Research Lead Agent
 |
 |  reads config + previous reports
 |  plans 3-5 parallel objectives
 v
Agent Team (dynamic teammates)
 |  each teammate:
 |    - creates a Jupyter notebook via MCP server
 |    - executes cell-by-cell Python analysis
 |    - writes summary.md
 v
Research Lead
 |  synthesizes findings into report.md
 |  identifies branches for future expansion
 v
.otterwise/
  config.json
  YYYYMMDD_HHMMSS_hash_name/
    report.md           <-- graph node (YAML frontmatter with parent/related IDs)
    teammate-1/
      notebook.ipynb
      summary.md
    teammate-2/
      ...
```

Each `report.md` contains YAML frontmatter with `id`, `parent`, `related`, and `status` fields that define the research DAG. Running `/otterwise:continue` reads all existing reports and expands the graph into new directions.

## Usage

Otterwise registers three slash commands in Claude Code:

| Command | Description |
|---------|-------------|
| `/otterwise:research` | Start a new autonomous research session on a dataset |
| `/otterwise:continue` | Expand the research graph with new analysis directions |
| `/otterwise:status` | Display the current research graph as a tree |

### `/otterwise:research`

Creates `.otterwise/config.json` with dataset path and goals, invokes the research lead, and produces the first set of notebooks and reports. This becomes the root node of the research DAG.

### `/otterwise:continue`

Reads all existing reports, identifies promising leads and gaps, and spawns a new round of analysis. Optionally specify a focus direction or a specific node to expand from.

### `/otterwise:status`

Displays a tree view of the research graph:

```
Research Graph:
+-- completed  basic-profiling (5 findings)
|   +-- completed  correlation-deep-dive (4 findings)
|   |   \-- in-progress  time-series-analysis
|   \-- completed  distribution-analysis (3 findings)
|       \-- pending  segmentation
\-- (no more nodes)
```

## Dashboard

The interactive dashboard provides a force-graph visualization of your research and lets you browse reports and notebooks.

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173 to view the dashboard. It polls the `.otterwise/` directory for report changes every 5 seconds.

<!-- Screenshot placeholder: dashboard overview -->

**Tech stack:** React 18, Vite, Tailwind CSS v4, react-force-graph-2d, gray-matter for frontmatter parsing.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 20+ (for the MCP server and dashboard)
- Python 3.11+ with pip (for the IPython worker)

### Python Dependencies

The Python worker requires: `ipython`, `matplotlib`

Analysis packages installed on demand via the `install_package` tool:
pandas, numpy, scipy, statsmodels, scikit-learn, seaborn

## Configuration

Otterwise is configured via `settings.json` at the project root, which grants permissions for the MCP server tools:

```json
{
  "permissions": {
    "allow": [
      "mcp__python-repl__execute_python",
      "mcp__python-repl__start_notebook",
      "mcp__python-repl__get_kernel_state",
      "mcp__python-repl__install_package"
    ]
  }
}
```

Research session configuration is stored in `.otterwise/config.json`, created automatically by `/otterwise:research`:

```json
{
  "dataset": "/absolute/path/to/data.csv",
  "goals": ["Identify key drivers of churn", "Find seasonal patterns"],
  "created": "2026-03-20T10:00:00Z"
}
```

## Project Structure

```
otterwise/
  agents/
    research-lead.md     Research lead agent (DAG-aware research orchestrator)
  dashboard/             React + Vite interactive dashboard
    src/
      components/        ResearchGraph, Sidebar, ReportPanel, NotebookPreview
      lib/               Report parsing and graph building
      types.ts           Shared TypeScript types
  hooks/
    hooks.json           Quality validation hook for teammate summaries
  servers/
    python-repl/         TypeScript MCP server (Node.js)
      src/
        index.ts         Server entry point (stdio transport)
        bridge/          Python child-process IPC layer
        notebook/        Jupyter notebook JSON formatting
        tools/           MCP tool implementations
      package.json
    requirements.txt     Python worker dependencies (ipython, matplotlib)
  skills/
    research/            /otterwise:research skill
    continue/            /otterwise:continue skill
    status/              /otterwise:status skill
  settings.json          Claude Code permission configuration
```

### MCP Server Tools

The TypeScript MCP server (`servers/python-repl/`) exposes four tools over stdio:

| Tool | Description |
|------|-------------|
| `execute_python` | Run code in a persistent IPython kernel; appends cell and output to a notebook |
| `start_notebook` | Create a new `.ipynb` file and initialize the kernel with dataset loaded as `df` |
| `get_kernel_state` | Return current kernel variables with types, shapes, and dtypes |
| `install_package` | Install a whitelisted data-science package via pip |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and PR guidelines.

## License

[MIT](LICENSE)

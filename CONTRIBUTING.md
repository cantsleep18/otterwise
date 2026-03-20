# Contributing to Otterwise

Thanks for your interest in contributing! This guide covers development setup, testing, and the PR process.

## Development Setup

### Prerequisites

- Node.js 20+ (REQUIRED -- runs the MCP server and dashboard)
- Python 3.10+ (REQUIRED for analysis)
- Claude Code CLI

### Install Dependencies

```bash
# TypeScript MCP server
cd servers
npm install
npm run build

# Dashboard
cd dashboard
npm install
```

## Running Locally

### Dashboard

```bash
cd dashboard
npm run dev
```

Opens on http://localhost:5173. The Vite dev server includes a plugin that serves `/api/reports`, `/api/files/`, and `/api/notebooks` endpoints by scanning the `.otterwise/` directory.

To build for production:

```bash
cd dashboard
npm run build
npm run preview
```

### MCP Server

The TypeScript MCP server runs over stdio and is started automatically by Claude Code via `node servers/dist/index.js`. It spawns a Python JSON-RPC worker for IPython execution.

To build the server:

```bash
cd servers
npm run build
```

To verify the server starts correctly:

```bash
node servers/dist/index.js --health-check
```

### Running a Research Session

Install Otterwise as a Claude Code extension, then run `/otterwise:research` in a Claude Code session. This creates the `.otterwise/` directory and orchestrates the full research pipeline.

## Testing

### MCP Server

Build the TypeScript server and verify the four MCP tools:

- `start_notebook` creates a valid `.ipynb` file with setup cell and kernel output
- `execute_python` appends cells and captures stdout, stderr, and base64-encoded figures
- `get_kernel_state` returns correct variable metadata (type, shape, dtypes)
- `install_package` accepts whitelisted packages and rejects everything else

### Dashboard

```bash
cd dashboard
npm run build    # TypeScript type-checking + Vite build
```

Verify the dashboard renders the research graph correctly by placing sample `report.md` files in a `.otterwise/` directory two levels above the dashboard folder.

### Quality Hooks

The `validate-teammate-summary` hook in `hooks/hooks.json` runs automatically when a teammate marks their task as completed. It checks that `summary.md` exists and follows the expected format. If you modify the summary format, update the validation script in `scripts/` accordingly.

## Code Style

### TypeScript (Server + Dashboard)

- Strict mode enabled (`strict: true` in tsconfig.json)
- No unused locals or parameters (enforced by compiler)
- No `any` type abuse -- use proper interfaces
- ES2022 target with NodeNext module resolution (server)
- Use path aliases (`@/` maps to `src/`) in dashboard
- Tailwind CSS v4 for styling in dashboard
- Functional React components with hooks

### Python (Bridge Worker)

- Type hints on all function signatures
- Use `from __future__ import annotations` for modern annotation syntax
- Format with Black or Ruff
- Keep the whitelisted packages list in `WHITELISTED_PACKAGES` up to date
- No MCP dependency -- the worker uses plain asyncio + socket JSON-RPC

### Shell (Scripts)

- Use `set -euo pipefail` at the top of all bash scripts

## Submitting Changes

### Branch Naming

Use descriptive branch names with a prefix:

- `feat/` -- new features
- `fix/` -- bug fixes
- `docs/` -- documentation changes
- `refactor/` -- code restructuring

Examples: `feat/add-parquet-support`, `fix/notebook-output-encoding`

### Commit Messages

Write clear, imperative commit messages:

```
Add Parquet dataset support to start_notebook

The MCP server now detects file extensions and uses the appropriate
pandas reader (read_csv, read_parquet, read_excel) when loading data.
```

### PR Checklist

- [ ] TypeScript server compiles without errors (`cd servers && npm run build`)
- [ ] Dashboard compiles without errors (`cd dashboard && npm run build`)
- [ ] Python type hints added for new functions
- [ ] MCP server starts and responds to tool calls (`node servers/dist/index.js --health-check`)
- [ ] Dashboard renders correctly with sample data
- [ ] Summary validation hook passes if summary format was changed
- [ ] No hardcoded paths or credentials

## Reporting Issues

Open an issue on GitHub with:

- A clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node.js version, Python version, Claude Code version)

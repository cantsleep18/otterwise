# Contributing to Otterwise

Thanks for your interest in contributing! This guide covers development setup, testing, and the PR process.

## Development Setup

### Prerequisites

- Node.js 20+
- Python 3.11+ (for the Python worker)
- Claude Code CLI

### Install Dependencies

```bash
# MCP server (TypeScript)
cd servers/python-repl
npm install

# Python worker dependencies
pip install -r servers/requirements.txt

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

The MCP server is a TypeScript process that spawns a Python worker for code execution. It runs over stdio and is started automatically by Claude Code. To test manually:

```bash
cd servers/python-repl
npx tsx src/index.ts
```

### Running a Research Session

Install Otterwise as a Claude Code extension, then run `/otterwise:research` in a Claude Code session. This creates the `.otterwise/` directory and orchestrates the full research pipeline.

## Testing

### MCP Server

Test the four MCP tools by starting the TypeScript server and sending JSON-RPC requests. Verify:

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

### TypeScript (Dashboard)

- Strict mode enabled (`strict: true` in tsconfig.json)
- No unused locals or parameters (enforced by compiler)
- Use path aliases (`@/` maps to `src/`)
- Tailwind CSS v4 for styling
- Functional React components with hooks

### Python (Worker)

- Type hints on all function signatures
- Use `from __future__ import annotations` for modern annotation syntax
- Format with Black or Ruff
- Keep the whitelisted packages list in `WHITELISTED_PACKAGES` up to date

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

- [ ] Dashboard TypeScript compiles without errors (`cd dashboard && npm run build`)
- [ ] MCP server TypeScript compiles without errors (`cd servers/python-repl && npx tsc --noEmit`)
- [ ] MCP server starts and responds to tool calls
- [ ] Dashboard renders correctly with sample data
- [ ] Summary validation hook passes if summary format was changed
- [ ] No hardcoded paths or credentials

## Reporting Issues

Open an issue on GitHub with:

- A clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node.js version, Python version, Claude Code version)

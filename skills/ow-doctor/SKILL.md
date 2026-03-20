---
name: ow-doctor
description: Diagnose, install, and update the Otterwise environment
---

# /otterwise:ow-doctor

One command to set up, diagnose, and update Otterwise.

## What It Does

Run a full health check and auto-fix everything:

1. **Node.js** — Check Node.js 20+ is available (REQUIRED)
2. **Python** — Check Python 3.10+ is available (REQUIRED for analysis)
3. **TypeScript server** — Build the TS MCP server
4. **uv** — Detect uv (preferred) or fall back to pip
5. **Virtual environment** — Create isolated venv at `${CLAUDE_PLUGIN_DATA}/.venv` if missing
6. **Python dependencies** — Install or update: ipython, nbformat, pandas, numpy, scipy, statsmodels, scikit-learn, matplotlib, seaborn
7. **Health check** — Verify the built server starts correctly
8. **Plugin version** — Show current version and check if a newer version is available on GitHub

## Workflow

Execute the following steps in order using Bash. Adapt commands based on the platform (Linux/macOS/Windows).

### Step 1: Check Node.js

```bash
node --version 2>/dev/null
```

If Node.js is not installed or version < 20, show an error and stop. Node.js 20+ is REQUIRED.

### Step 2: Check Python

```bash
python3 --version 2>/dev/null || python --version 2>/dev/null
```

If Python < 3.10, warn the user and stop.
Determine the python command that works: prefer `python3`, fall back to `python`.

### Step 3: Build TypeScript server

```bash
cd <plugin-root>/servers && npm install && npm run build
```

If the build fails, show the error output and stop. The server must build successfully.

### Step 4: Determine package installer

```bash
uv --version 2>/dev/null
```

If uv is available, use `uv pip` commands. Otherwise, use `pip` (via the detected python).
Tell the user which installer is being used.

### Step 5: Create or verify venv

The venv location depends on context:
- **Plugin installed via marketplace**: `${CLAUDE_PLUGIN_DATA}/.venv`
- **Manual/dev mode** (CLAUDE_PLUGIN_DATA not set): `<plugin-root>/.venv`

```bash
VENV_DIR="${CLAUDE_PLUGIN_DATA:-.}/.venv"

if [ ! -d "$VENV_DIR" ]; then
    # Create venv
    if command -v uv &>/dev/null; then
        uv venv "$VENV_DIR"
    else
        $PYTHON -m venv "$VENV_DIR"
    fi
fi
```

Report: "Created new environment" or "Existing environment found".

### Step 6: Install / update Python dependencies

```bash
VENV_PIP="$VENV_DIR/bin/pip"
REQS="<plugin-root>/servers/requirements.txt"

if command -v uv &>/dev/null; then
    uv pip install -r "$REQS" --python "$VENV_DIR/bin/python"
else
    "$VENV_PIP" install -r "$REQS"
fi
```

### Step 7: Verify installation

```bash
"$VENV_DIR/bin/python" -c "
import pandas, numpy, scipy, statsmodels, sklearn, matplotlib, seaborn, IPython, nbformat
print('All Python dependencies OK')
"
```

List each package with its installed version.

### Step 8: Verify MCP server (health check)

```bash
node <plugin-root>/servers/dist/index.js --health-check
```

This verifies the built TypeScript server can start and respond correctly.

### Step 9: Version and update check

Read the current version from `<plugin-root>/.claude-plugin/plugin.json`.

Check GitHub for latest version:
```bash
curl -s https://api.github.com/repos/cantsleep18/otterwise/releases/latest 2>/dev/null
```

If a newer version exists, tell the user:
- Plugin install: `/plugin update otterwise`
- Manual install: `git pull`

### Output Format

Print a diagnostic report:

```
Otterwise Doctor v0.1.0
========================

[OK] Node.js 20.11.0
[OK] Python 3.11.5
[OK] TypeScript server: built successfully
[OK] Package installer: uv 0.6.0
[OK] Virtual environment: ~/.claude/plugins/data/otterwise/.venv
[OK] Python dependencies (9/9 installed)
     pandas 2.2.0 | numpy 1.26.0 | scipy 1.12.0
     statsmodels 0.14.1 | scikit-learn 1.4.0
     matplotlib 3.8.0 | seaborn 0.13.0
     ipython 8.20.0 | nbformat 5.9.0
[OK] MCP server: health check passed
[OK] Plugin version: 0.1.0 (latest)

Status: Ready to use!
```

If anything fails, show `[FIX]` with what was auto-fixed, or `[ERR]` with instructions:

```
[FIX] Virtual environment: created new at ~/.claude/plugins/data/otterwise/.venv
[FIX] Python dependencies: installed 9 packages via uv (3.2s)
[FIX] TypeScript server: rebuilt successfully
[ERR] Node.js: not found. Please install Node.js 20+ from https://nodejs.org
[ERR] Python: version 3.8 detected, need 3.10+. Please upgrade Python.
```

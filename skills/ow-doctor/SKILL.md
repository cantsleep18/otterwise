---
name: ow-doctor
description: Diagnose, install, and update the Otterwise environment
---

# /otterwise:ow-doctor

One command to set up, diagnose, and update Otterwise.

## What It Does

Run a full health check and auto-fix everything:

1. **Python** — Check Python 3.10+ is available
2. **uv** — Detect uv (preferred) or fall back to pip
3. **Virtual environment** — Create isolated venv at `${CLAUDE_PLUGIN_DATA}/.venv` if missing
4. **Dependencies** — Install or update: pandas, numpy, scipy, statsmodels, scikit-learn, matplotlib, seaborn, mcp, ipython, nbformat
5. **Version check** — Compare installed dependency versions against requirements.txt
6. **MCP server** — Verify python_repl.py can be imported without errors
7. **Plugin version** — Show current version and check if a newer version is available on GitHub

## Workflow

Execute the following steps in order using Bash. Adapt commands based on the platform (Linux/macOS/Windows).

### Step 1: Check Python

```bash
python3 --version 2>/dev/null || python --version 2>/dev/null
```

If Python < 3.10, warn the user and stop.
Determine the python command that works: prefer `python3`, fall back to `python`.

### Step 2: Determine package installer

```bash
uv --version 2>/dev/null
```

If uv is available, use `uv pip` commands. Otherwise, use `pip` (via the detected python).
Tell the user which installer is being used.

### Step 3: Create or verify venv

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

### Step 4: Install / update dependencies

```bash
VENV_PIP="$VENV_DIR/bin/pip"
REQS="<plugin-root>/servers/requirements.txt"

if command -v uv &>/dev/null; then
    uv pip install -r "$REQS" --python "$VENV_DIR/bin/python"
else
    "$VENV_PIP" install -r "$REQS"
fi
```

### Step 5: Verify installation

```bash
"$VENV_DIR/bin/python" -c "
import pandas, numpy, scipy, statsmodels, sklearn, matplotlib, seaborn, mcp, IPython, nbformat
print('All dependencies OK')
"
```

List each package with its installed version.

### Step 6: Verify MCP server

```bash
"$VENV_DIR/bin/python" -c "
import ast
ast.parse(open('<plugin-root>/servers/python_repl.py').read())
print('MCP server syntax OK')
"
```

### Step 7: Version and update check

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

[OK] Python 3.11.5
[OK] Package installer: uv 0.6.0
[OK] Virtual environment: ~/.claude/plugins/data/otterwise/.venv
[OK] Dependencies (10/10 installed)
     pandas 2.2.0 | numpy 1.26.0 | scipy 1.12.0
     statsmodels 0.14.1 | scikit-learn 1.4.0
     matplotlib 3.8.0 | seaborn 0.13.0
     mcp 1.2.0 | ipython 8.20.0 | nbformat 5.9.0
[OK] MCP server: syntax valid
[OK] Plugin version: 0.1.0 (latest)

Status: Ready to use!
```

If anything fails, show `[FIX]` with what was auto-fixed, or `[ERR]` with instructions:

```
[FIX] Virtual environment: created new at ~/.claude/plugins/data/otterwise/.venv
[FIX] Dependencies: installed 10 packages via uv (3.2s)
[ERR] Python: version 3.8 detected, need 3.10+. Please upgrade Python.
```

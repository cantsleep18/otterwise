---
name: ow-setup
description: Setup, diagnose, and update Otterwise
---

# /otterwise:ow-setup

One command to install, diagnose, and update Otterwise.

## What It Does

Run through these checks in order. Report each as PASS / FAIL / WARN with a one-line summary. At the end, print a summary table and fix anything that failed (with user confirmation).

### 1. Environment Checks

```
[ ] Node.js >= 20       → run: node --version
[ ] Python >= 3.11      → run: python3 --version
[ ] npx available       → run: which npx
```

### 2. npm Dependencies

```
[ ] node_modules exists → check: servers/python-repl/node_modules/
[ ] packages up to date → run: cd servers/python-repl && npm ls --depth=0
```

If node_modules is missing or outdated:
→ Auto-fix: `cd servers/python-repl && npm install`

### 3. MCP Server Health

```
[ ] index.ts exists          → check: servers/python-repl/src/index.ts
[ ] TypeScript compiles      → run: cd servers/python-repl && npx tsc --noEmit
[ ] Server starts            → run: timeout 5 npx tsx servers/python-repl/src/index.ts (expect stdio MCP handshake)
```

### 4. Python Worker Health

```
[ ] worker.py exists         → check: servers/python-repl/worker/worker.py
[ ] Python stdlib imports OK → run: python3 -c "import socket, threading, json, io, base64, traceback, resource, argparse"
[ ] matplotlib available     → run: python3 -c "import matplotlib" (WARN if missing, not FAIL)
[ ] pandas available         → run: python3 -c "import pandas" (WARN if missing, not FAIL)
```

If matplotlib/pandas missing, suggest:
→ "Run `install_package` tool during research to install on-demand, or manually: `pip install matplotlib pandas`"

### 5. Configuration Validation

```
[ ] .mcp.json valid          → parse JSON, check mcpServers.python-repl exists
[ ] settings.json valid      → parse JSON, check permissions include all 6 tools
[ ] plugin.json valid        → parse JSON, check agents/skills/hooks paths exist
[ ] hooks.json valid         → parse JSON, check referenced script exists
```

If settings.json is missing permissions for new tools (interrupt_execution, reset_kernel):
→ Auto-fix: add them

### 6. Update Check

```
[ ] Git repo clean           → run: git status --porcelain
[ ] Check remote for updates → run: git fetch origin main && git log HEAD..origin/main --oneline
```

If updates available:
→ Show commit list, ask user: "Update now? (git pull)"
→ If yes: `git pull origin main`
→ After pull: re-run npm install if package.json changed

### 7. Tests

```
[ ] Tests pass               → run: cd servers/python-repl && npx vitest --run
```

Report: X/Y tests passing.

## Output Format

```
Otterwise Setup & Diagnostics
==============================

Environment
  PASS  Node.js 22.1.0
  PASS  Python 3.12.3
  PASS  npx available

Dependencies
  PASS  node_modules installed
  PASS  packages up to date

MCP Server
  PASS  index.ts exists
  PASS  TypeScript compiles
  PASS  Server starts

Python Worker
  PASS  worker.py exists
  PASS  stdlib imports OK
  WARN  matplotlib not installed (optional)
  WARN  pandas not installed (optional)

Configuration
  PASS  .mcp.json valid
  PASS  settings.json valid (6 tools)
  PASS  plugin.json valid
  PASS  hooks.json valid

Updates
  PASS  Git repo clean
  PASS  Up to date with origin/main

Tests
  PASS  78/78 tests passing

==============================
Result: 15 PASS | 2 WARN | 0 FAIL
Status: Ready to use!
```

If there are FAILs, offer to auto-fix what's possible, then re-check.

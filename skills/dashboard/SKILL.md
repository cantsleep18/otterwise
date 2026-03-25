---
name: dashboard
description: Launch or stop the research graph visualization dashboard
---

# /otterwise:dashboard

Launch or stop the research graph visualization dashboard. Supports explicit `start`/`stop` arguments or toggles automatically.

Usage: `/otterwise:dashboard` (toggle), `/otterwise:dashboard start`, `/otterwise:dashboard stop`

## Prerequisites

1. `.otterwise/` directory must exist (a research session must have been started).
2. Dashboard dependencies must be installed. If `{PLUGIN_ROOT}/dashboard/node_modules` does not exist, run `cd {PLUGIN_ROOT}/dashboard && npm install` before starting.

`{PLUGIN_ROOT}` is the directory containing this skill (the Otterwise plugin root).

## Workflow

### Determine Action

- If the user passed `start` or `stop`, use that.
- Otherwise **toggle**: check if `.otterwise/dashboard.pid` exists and the PID is alive. If running, stop; if not, start.

### Start

1. Verify `.otterwise/` exists. If not, display:
   ```
   No research session found. Run /otterwise:research first.
   ```
2. If `.otterwise/dashboard.pid` exists and the process is alive, display:
   ```
   Dashboard is already running at http://localhost:5173
   ```
3. Ensure `{PLUGIN_ROOT}/dashboard/node_modules` exists. If missing, run:
   ```bash
   cd {PLUGIN_ROOT}/dashboard && npm install
   ```
4. Launch the dev server in the background with `OTTERWISE_DIR` pointing to the **user's project** `.otterwise/` directory (NOT the plugin cache):
   ```bash
   cd {PLUGIN_ROOT}/dashboard && OTTERWISE_DIR={CWD}/.otterwise npx vite --port 5173
   ```
   `{CWD}` is the user's current working directory (the project root where `.otterwise/` lives).
   Use `Bash(run_in_background: true)` so the server runs detached.
5. Write the background process PID to `.otterwise/dashboard.pid`.
6. Display:
   ```
   Dashboard running at http://localhost:5173
   ```

### Stop

1. Read `.otterwise/dashboard.pid`. If the file does not exist, display:
   ```
   Dashboard is not running.
   ```
2. Kill the process using the PID.
3. Remove `.otterwise/dashboard.pid`.
4. Display:
   ```
   Dashboard stopped.
   ```

## Important Rules

- Always use `run_in_background: true` when launching Vite so the Claude session is not blocked.
- The PID file is the single source of truth for whether the dashboard is running.
- Before trusting a stale PID file, verify the process is actually alive (e.g., `kill -0 $PID`).
- Never start a second instance if one is already running.
- The dashboard reads data from `.otterwise/nodes/` — it is read-only and does not modify research state.

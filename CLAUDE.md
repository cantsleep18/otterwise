# Otterwise

Autonomous compound research platform for Claude Code.

## Project Structure

- `servers/python-repl/` — MCP server (TypeScript, esbuild bundled to `dist/mcp-server.cjs`)
- `skills/` — Skill definitions (research, continue, status, ow-setup, autopilot, autopilot-pause, autopilot-abort)
- `hooks/` — PostToolUse hooks for validation
- `scripts/` — Shell scripts for validation, migration, and publishing
- `dashboard/` — Research dashboard UI
- `tests/` — Integration and fixture tests

## Build

```bash
cd servers/python-repl && node scripts/build.mjs
```

## Test

```bash
cd servers/python-repl && npm test -- --run
```

## Key Conventions

- Python worker uses only stdlib (zero pip install)
- MCP server is bundled as a single CJS file via esbuild
- Safety guards in `scripts/validate-autopilot-state.sh` enforce resource limits
- Version must stay consistent across `plugin.json`, `marketplace.json`, and `package.json`

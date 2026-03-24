# Otterwise

Autonomous compound research platform for Claude Code.

## Project Structure

- `skills/` — Skill definitions (research, continue, status, ow-setup, autopilot, autopilot-pause, autopilot-abort)
- `hooks/` — PostToolUse hooks for validation
- `scripts/` — Shell scripts for validation, migration, and publishing
- `dashboard/` — Research dashboard UI
- `tests/` — Integration and fixture tests

## Key Conventions

- Research is organized as a node-based graph structure (not sequential rounds)
- Safety guards in `scripts/validate-autopilot-state.sh` enforce resource limits
- Version must stay consistent across `plugin.json`, `marketplace.json`, and `package.json`

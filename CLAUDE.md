# Otterwise

Autonomous compound research platform for Claude Code.

## Project Structure

- `skills/` — Skill definitions (research, continue, status, ow-setup, autopilot, autopilot-pause, autopilot-abort, dashboard)
- `hooks/` — PostToolUse hooks for validation
- `scripts/` — Shell scripts for validation, migration, and publishing
- `dashboard/` — Research dashboard UI
- `tests/` — Integration and fixture tests

## Key Conventions

- Research is organized as a node-based graph structure (not sequential rounds)
- Autopilot runs an infinite EVALUATE/EXPAND loop — no maxNodes limit, no FINALIZE phase; only user abort stops it
- Safety guards in `scripts/validate-autopilot-state.sh` validate state file integrity
- Version (currently 1.3.0) must stay consistent across `plugin.json` and `marketplace.json`
- Marketplace install: `claude extension add cantsleep18/otterwise`
- Plugin cache: `~/.claude/plugins/cache/cantsleep18-otterwise/` — delete and re-add to force clean install
- Auto-update: `/otterwise:ow-setup` detects new versions, pulls, migrates config/cache, verifies

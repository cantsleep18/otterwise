# Otterwise

종가베팅 strategy research platform for Claude Code.

## Project Structure

- `skills/` — Skill definitions (research, continue, autopilot, status, ow-setup, autopilot-pause, autopilot-abort)
- `hooks/` — PostToolUse hooks for validation
- `scripts/` — Shell scripts for validation, migration, and publishing
- `tests/` — Integration and fixture tests

## Key Conventions

- All research skills (research, continue, autopilot) use the OLJC methodology (OBSERVE → LOOK → JUDGE → CRYSTALLIZE)
- 종가베팅 = buy at close, sell at next day's open. Every strategy includes a rough backtest.
- LOOK phase: mark event dates → calculate overnight returns → aggregate metrics. Claude does the math directly.
- JUDGE gates: profit_factor > 1.5, positive after fees, sufficient trades
- Fee model: stock 0.24% round-trip, ETF 0.04% round-trip
- No backtest engine/template — Claude reads data and calculates directly each time
- No data format enforcement — Claude reads whatever the user provides
- Autopilot runs an infinite OLJC loop with ROUTE phase — no maxNodes limit, no FINALIZE phase; only user abort stops it
- Research output goes to `.otterwise/strategies/` (Obsidian vault with wikilinks)
- Per-cycle intermediate outputs go to `.otterwise/artifacts/{id}_{name}/` with numbered phase prefixes (01_discovery, 02_evidence, 03_evaluation)
- Strategy filenames include date+hash prefix for sorting: `{YYYYMMDD_HHMM}_{8hex}_{name}.md`
- ID format: `YYYYMMDD_HHMM_{8hex}` (includes time for uniqueness)
- Safety guards in `scripts/validate-state.sh` validate state file integrity
- Version (currently 1.5.0) must stay consistent across `plugin.json` and `marketplace.json`
- Marketplace install: `claude extension add cantsleep18/otterwise`
- Plugin cache: `~/.claude/plugins/cache/cantsleep18-otterwise/` — delete and re-add to force clean install
- Auto-update: `/otterwise:ow-setup` detects new versions, pulls, migrates config/cache, verifies

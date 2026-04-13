# Changelog

All notable changes to Otterwise will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.5.0] - 2026-04-13

### Changed
- Pivoted to 종가베팅 (overnight-return) strategy research — buy at close, sell at next open
- LOOK phase now performs mechanical backtest: mark event dates, calculate overnight returns, aggregate metrics
- JUDGE phase uses quantitative gates (profit_factor > 1.5, positive after fees, sufficient trades) instead of qualitative criteria
- Strategy body format: `## 가격 관찰` → `## 이벤트 발생일 및 종가베팅 결과`, added `## 집계`, removed `## 전략 아이디어`
- Strategy frontmatter: added `backtest:` block (tickers, period, trades, winners, losers, win_rate_pct, avg_return_pct, profit_factor, max_consecutive_losses, fee_applied_pct), removed `dataUsed` and `observationPeriod`
- Fee model integrated: stock 0.24% round-trip, ETF 0.04% round-trip (configurable in config.json)
- config.json schema: `dataset` changed from flat string to `{ prices, sources }` object, added `fee` block
- Validation scripts updated for new strategy format and backtest fields

### Removed
- v1.4 strategies discarded (archived to `.otterwise/archive/v1.4/` on migration)
- Case sections (`### 사례 N:`) and `> [!data]-` callouts removed from strategy body
- `## 전략 아이디어` section removed — the phenomenon IS the strategy

## [1.4.0] - 2026-03-30

### Changed
- Unified research and continue skills to use OLJC methodology (OBSERVE → LOOK → JUDGE → CRYSTALLIZE), matching autopilot
- Research and continue now output to `.otterwise/strategies/` instead of `.otterwise/nodes/`
- Renamed `validate-autopilot-state.sh` to `validate-state.sh` for skill-agnostic naming
- Continue blocks when autopilot is actively running (prevents race conditions)
- Restructured artifacts: per-cycle folders in `.otterwise/artifacts/{id}_{name}/` with numbered phase prefixes (01_discovery.md, 02_evidence.md, 03_evaluation.md)
- Strategy filenames now include date+hash prefix for sorting (`{YYYYMMDD_HHMM}_{8hex}_{name}.md`)
- Removed `discarded/` directory — SKIP decisions recorded in 03_evaluation.md
- ID format updated to include time: `YYYYMMDD_HHMM_{8hex}`

### Added
- Test validators for research and continue SKILL.md files
- Strategy example fixture for testing

## [1.3.0] - 2026-03-24

### Changed
- Rewrote autopilot as investment-focused OLJC loop (OBSERVE → LOOK → JUDGE → CRYSTALLIZE)
- Replaced node-based research graph with strategy graph using Obsidian-compatible wikilinks
- Adaptive router with 10 research modes and 4 expansion types (seed/derive/explore/combine)

### Added
- Strategy validation hook (`validate-strategy.sh`)
- Evidence warning hook (`warn-strategy-evidence.sh`)
- Investment strategy document format with Korean sections

## [1.2.0] - 2026-03-23

### Added

- Auto-update mechanism for seamless plugin updates via `/otterwise:ow-setup`
- Clean terminal UI for `ow-setup` with structured PASS/FAIL/WARN diagnostics
- Cache and config file migration on update (preserves research sessions across versions)
- Version consistency checking across plugin.json, marketplace.json, and package.json
- Auto pilot mode (`/otterwise:autopilot`) for autonomous multi-round research
- Pause/resume/abort controls for auto pilot sessions
- Enhanced `/otterwise:status` with auto pilot progress display
- Auto pilot configuration via `.otterwise/autopilot.json`
- Decision engine with 5-factor scoring for research direction selection
- 9-criteria stopping condition framework

### Changed

- Migrated MCP server from Python (FastMCP) to TypeScript (MCP SDK) with Python child_process worker
- Replaced IPython kernel with plain Python `exec()` worker (zero pip install required)
- Migrated IPC from stdin/stdout JSON-lines to Unix domain sockets with JSON-RPC 2.0
- Added session locking and security hardening for the Python worker

### Added

- `interrupt_execution` tool to cancel long-running Python execution
- `reset_kernel` tool to clear the Python namespace

## [0.1.0] - 2026-03-20

### Added

- Python REPL MCP server with 4 tools: `execute_python`, `start_notebook`, `get_kernel_state`, `install_package`
- Persistent IPython kernel with matplotlib figure capture and notebook cell appending
- Whitelisted package installation (pandas, numpy, scipy, statsmodels, scikit-learn, matplotlib, seaborn)
- Research lead agent with DAG-based research graph expansion
- Dynamic agent team creation for parallel multi-objective analysis
- `/otterwise:research` skill to start a new research session
- `/otterwise:continue` skill to expand the research graph from existing findings
- `/otterwise:status` skill to display the research graph as a tree
- Interactive React dashboard with force-graph visualization (react-force-graph-2d)
- Dashboard sidebar with node list, report panel with markdown rendering, and notebook preview
- Vite dev server plugin serving reports, files, and notebooks from `.otterwise/` directory
- Report parsing with gray-matter YAML frontmatter extraction
- Quality validation hook (`validate-teammate-summary`) for teammate outputs
- Teammate summary format with structured findings, confidence levels, and follow-up suggestions
- Resumable investigation sessions with persistent `.otterwise/` state

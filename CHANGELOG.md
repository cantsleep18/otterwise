# Changelog

All notable changes to Otterwise will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-03-20

### Changed

- Research methodology: Exploration Board with findings, threads, synthesis
- Agents loop continuously producing findings (not one-shot)
- Head orchestrates cross-pollination via threads

### Removed

- Dashboard (React + force-graph)

## [0.1.0] - 2026-03-20

### Added

- TypeScript MCP server with 4 tools: `execute_python`, `start_notebook`, `get_kernel_state`, `install_package`
- JSON-RPC bridge architecture: Node.js server manages Python worker process over Unix socket
- Persistent IPython kernel with matplotlib figure capture and notebook cell appending
- Session locking and platform-aware utilities
- Whitelisted package installation (pandas, numpy, scipy, statsmodels, scikit-learn, matplotlib, seaborn)
- Research lead agent with DAG-based research graph expansion
- Dynamic agent team creation for parallel multi-objective analysis
- `/otterwise:research` skill to start a new research session
- `/otterwise:continue` skill to expand the research graph from existing findings
- `/otterwise:status` skill to display the research graph as a tree
- Quality validation hook (`validate-finding`) for finding outputs
- Finding format with YAML frontmatter, confidence levels, and possible threads
- Resumable investigation sessions with persistent `.otterwise/` state

# Changelog

All notable changes to Otterwise will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

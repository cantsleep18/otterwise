# Contributing to Otterwise

Thanks for your interest in contributing! This guide covers development setup, testing, and the PR process.

## Development Setup

### Prerequisites

- Node.js 20+
- Claude Code CLI

## Running Locally

Install Otterwise as a Claude Code extension, then run `/otterwise:research` in a Claude Code session. This creates the `.otterwise/` directory and runs the OLJC research loop.

For autonomous mode, use `/otterwise:autopilot` — this runs an infinite OBSERVE/LOOK/JUDGE/CRYSTALLIZE cycle, producing strategy documents in `.otterwise/strategies/` and per-cycle intermediate outputs in `.otterwise/artifacts/`.

## Testing

### Quality Hooks

Hooks in `hooks/hooks.json` run automatically on tool use:
- `validate-strategy.sh` — validates strategy `.md` format on Write
- `warn-strategy-evidence.sh` — warns on missing data evidence
- `validate-state.sh` — validates state file integrity

## Code Style

### Shell (Scripts)

- Use `set -euo pipefail` at the top of all bash scripts

## Submitting Changes

### Branch Naming

Use descriptive branch names with a prefix:

- `feat/` -- new features
- `fix/` -- bug fixes
- `docs/` -- documentation changes
- `refactor/` -- code restructuring

Examples: `feat/add-parquet-support`, `fix/notebook-output-encoding`

### Commit Messages

Write clear, imperative commit messages:

```
Add Parquet dataset support to research skill

The research skill now detects file extensions and uses the appropriate
analysis strategy when loading data.
```

### PR Checklist

- [ ] Strategy validation hooks pass (`validate-strategy.sh`)
- [ ] Version consistency across plugin.json and marketplace.json
- [ ] No hardcoded paths or credentials

## Reporting Issues

Open an issue on GitHub with:

- A clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node.js version, Claude Code version)

<div align="center">

```
        __         __
       /  \.-"""-./  \
       \    -   -    /
        |   o   o   |
        \  ._---_.  /
        /  /     \  \     O t t e r w i s e
       /  /       \  \
      {  |    _    |  }    autonomous research that never stops
       \  \  \_/  /  /
        \  '-...-'  /
         '-..___..-'
```

# Otterwise

**Give it data. It builds a universe of insights.**

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet.svg)](https://github.com/cantsleep18/otterwise)
[![TypeScript](https://img.shields.io/badge/MCP_Server-TypeScript-blue.svg)](#)
[![Python](https://img.shields.io/badge/Analysis-Python_3.10+-yellow.svg)](#)

</div>

---

## What is this?

You give Otterwise a CSV. It spawns a team of AI researchers. They analyze your data **in parallel loops** — each one producing findings, reading each other's discoveries, and digging deeper. The research lead watches everything, connecting the dots between findings into **threads**. When the dust settles, you get a synthesis report with the key discoveries and open questions that seed the next round.

```
You:  /otterwise:research sales_data.csv "why is revenue dropping?"

      ... agents loop, findings accumulate, threads form ...

Otterwise:
  Thread 1: Top 5% of customers (all corporate, West region) drive 38% of revenue
            → Corporate retention is the #1 lever
  Thread 2: Individual spending dropped 23% after March price increase
            → Price elasticity is much higher than assumed
  Thread 3: Electronics dominate Q4 but crater in Q1
            → Seasonal inventory strategy needed

  Open Questions:
  → What predicts corporate customer churn?
  → Is the price effect uniform across regions?
  → How does category mix shift by customer segment?

You:  /otterwise:continue "dig into corporate churn"
      ... another round, deeper insights ...
```

**It doesn't stop.** Each exploration opens new questions. Each question leads to new findings. The research graph grows like a living organism.

---

## How It Works

### The Exploration Board

```
                    ┌──────────────────────────────────┐
                    │         Exploration Board         │
                    │                                   │
                    │  [finding]──thread──[finding]      │
                    │      |                  |          │
                    │   thread            thread         │
                    │      |                  |          │
                    │  [finding]          [finding]      │
                    │      |                             │
                    │   thread──────────[finding]        │
                    │                                   │
                    └──────────────────────────────────┘
                              ▲            ▲
                    ┌─────────┘            └─────────┐
                    │                                │
              Agent Alpha                      Agent Beta
              (looping)                        (looping)
                    │                                │
              ┌─────┴─────┐                  ┌──────┴─────┐
              │  analyze   │                 │  analyze    │
              │  discover  │                 │  discover   │
              │  write     │                 │  read board │
              │  read board│                 │  cross-ref  │
              │  repeat... │                 │  repeat...  │
              └────────────┘                 └─────────────┘
```

1. **Explorer agents** loop continuously — analyze, write findings, read each other's findings, go deeper
2. **Research lead** watches the board — discovers threads between findings, tells agents to cross-check
3. When insights stop flowing, the lead writes a **synthesis** — the story of what was found
4. Open questions from the synthesis become seeds for the next `/otterwise:continue`

### The Research Graph

```
exploration-001 (initial profiling)
 ├── 5 findings, 3 threads
 ├── exploration-002 (customer segments)
 │    ├── 4 findings, 2 threads (1 cross-exploration)
 │    └── exploration-004 (churn prediction) ← in progress
 └── exploration-003 (regional analysis)
      └── 3 findings, 2 threads
```

Each exploration links to its parent. Findings can thread across explorations. The graph grows in any direction.

---

## Install

### Plugin (recommended)

```bash
# In Claude Code:
/plugin marketplace add cantsleep18/otterwise
/plugin install otterwise
/otterwise:ow-doctor     # one command: builds server, creates venv, installs deps
```

Your Python is never touched. Everything lives in an isolated venv.

### Manual

```bash
git clone https://github.com/cantsleep18/otterwise
cd otterwise
claude --plugin-dir .
/otterwise:ow-doctor
```

---

## Use

```bash
# Start exploring
/otterwise:research path/to/data.csv

# Go deeper
/otterwise:continue
/otterwise:continue "focus on customer churn"

# Check the graph
/otterwise:status
```

```
Otterwise Exploration Graph
├── ● initial-profiling (5 findings, 3 threads)
│   ├── ● customer-segments (4 findings, 2 threads)
│   │   └── ○ churn-prediction (in-progress)
│   └── ● regional-analysis (3 findings, 2 threads)

Total: 3 explorations | 12 findings | 7 threads | 5 open questions
```

---

## What Gets Produced

```
.otterwise/
├── config.json
├── exploration-001_a7f3_initial-profiling/
│   ├── findings/
│   │   ├── finding-alpha-001.md      ← "Top 5% = 38% of revenue"
│   │   ├── finding-alpha-002.md      ← "Age correlates with spending"
│   │   ├── finding-beta-001.md       ← "West region dominates"
│   │   └── finding-gamma-001.md      ← "Credit card = 2.3x spending"
│   ├── threads.json                  ← connections between findings
│   ├── alpha/notebook.ipynb          ← reproducible Jupyter notebook
│   ├── beta/notebook.ipynb
│   ├── gamma/notebook.ipynb
│   └── synthesis.md                  ← the story + open questions
```

**Findings** are atomic discoveries with evidence, confidence scores, and suggested connections.
**Threads** are verified connections between findings — the "aha" moments.
**Synthesis** is the narrative that ties it all together.

---

## Architecture

```
Claude Code ──stdio──▶ TypeScript MCP Server ──Unix Socket──▶ Python Worker
                       (Node.js)                              (IPython + pandas)
                       ├── 4 tools                            ├── persistent kernel
                       ├── bridge manager                     ├── notebook generation
                       ├── session lock                       ├── matplotlib capture
                       └── JSON-RPC client                    └── 60s timeout/cell
```

The MCP server is TypeScript. Python is only used for the actual data crunching — via a JSON-RPC bridge to a long-running IPython kernel.

---

## Requirements

- **Claude Code** CLI
- **Node.js 20+** — runs the MCP server
- **Python 3.10+** — runs the analysis kernel

`/otterwise:ow-doctor` handles everything else.

---

## Demo

The `demo/` folder has sample data ready to explore:

```bash
# Clone and try immediately
git clone https://github.com/cantsleep18/otterwise
cd otterwise && ls demo/.otterwise/
# → exploration-001 with 5 findings, 3 threads, synthesis
# → exploration-002 with 3 findings, 2 threads, cross-exploration thread
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Data formats are defined in [docs/schema.md](docs/schema.md).

## License

[MIT](LICENSE) — do whatever you want with it.

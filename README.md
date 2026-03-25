<p align="center">
  <br />
  <code>&nbsp;otterwise&nbsp;</code>
  <br />
  <br />
  <strong>Autonomous compound research for Claude Code</strong>
  <br />
  <sub>spawn agent teams &middot; build discovery graphs &middot; visualize in real-time</sub>
  <br />
  <br />
  <a href="#install"><img src="https://img.shields.io/badge/install-one_command-000?style=flat-square" /></a>
  <img src="https://img.shields.io/badge/v1.3.0-000?style=flat-square&labelColor=000&color=111" />
  <img src="https://img.shields.io/badge/license-MIT-000?style=flat-square&labelColor=000&color=111" />
</p>

---

## What it does

Give it a dataset. It spawns parallel research teams, builds a **DAG of discoveries**, and keeps expanding until you stop it.

```
dataset.csv ──> /otterwise:autopilot
                     │
                     ├── Node 0  seed profiling
                     │     ├── Node 1  value screening
                     │     │     └── Node 3  cross-branch synthesis
                     │     ├── Node 2  sector analysis
                     │     └── Node 4  healthcare deep-dive
                     │           └── Node 5  final portfolio ◄── combines 1,2,3,4
                     │
                     └── ... (infinite expansion until abort)
```

Each node = a team of agents. Each agent writes findings. The lead synthesizes into `report.md`. Nodes link via `parentIds` forming a research graph.

---

## Install

```bash
/plugin marketplace add cantsleep18/otterwise
/plugin install otterwise@cantsleep18-otterwise
```

Then verify:
```bash
/otterwise:ow-setup
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `/otterwise:research` | One-shot research on a dataset |
| `/otterwise:continue` | Expand the graph into new directions |
| `/otterwise:autopilot` | Infinite autonomous expansion loop |
| `/otterwise:autopilot-pause` | Pause / resume autopilot |
| `/otterwise:autopilot-abort` | Stop the loop |
| `/otterwise:status` | Print the research DAG |
| `/otterwise:dashboard` | Launch graph visualization at `localhost:5173` |
| `/otterwise:ow-setup` | Diagnose + auto-update |

---

## Autopilot

```bash
/otterwise:autopilot /path/to/data.csv "Find undervalued stocks"
```

Runs an **infinite EVALUATE → EXPAND loop**:

1. **EVALUATE** — reads all nodes, picks the most promising direction
2. **EXPAND** — spawns 3 researcher agents in parallel, synthesizes findings
3. **Repeat** — forever, until you run `/otterwise:autopilot-abort`

Features:
- 30-minute timeout per node (continues with partial results)
- Circuit breaker (skips nodes that fail 3x)
- Pause/resume without losing state
- Data-driven: agents must cite sources via WebSearch/WebFetch

---

## Dashboard

```bash
/otterwise:dashboard
```

Opens `http://localhost:5173` — a dark-themed force graph visualization.

- Nodes = research discoveries (blue dots)
- Edges = parent-child relationships
- Click a node → full report renders on the right
- 5-second auto-refresh (watches `.otterwise/nodes/`)

---

## How research data is stored

```
.otterwise/
├── config.json                          # dataset + goals
├── autopilot.json                       # DAG metadata
├── autopilot-state.json                 # running / pause / abort
└── nodes/
    ├── 20260325_143015_a1b2c3d4_시드프로파일링/
    │   ├── report.md                    # synthesized findings (YAML frontmatter)
    │   ├── researcher-1/summary.md
    │   ├── researcher-2/summary.md
    │   └── researcher-3/summary.md
    └── 20260325_150421_c3d4e5f6_딥다이브/
        ├── report.md
        └── ...
```

`report.md` frontmatter defines the graph:

```yaml
---
id: "20260325_143015_a1b2c3d4_시드프로파일링"
name: "시드-프로파일링"
parentIds: []
status: "completed"
findings_count: 12
---
```

---

## Auto-update

```bash
/otterwise:ow-setup
```

Detects new versions → pulls → clears cache → migrates data → done.

- Fast-forward only (no force pulls)
- Pre/post security checks
- Research data never touched
- Rolls back on failure

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 20+

## License

MIT

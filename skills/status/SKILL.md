---
name: status
description: Show the current state of Otterwise research
---

# /otterwise:status

Display the current research graph status, including autopilot state when active.

## Workflow

1. Scan `.otterwise/nodes/*/report.md` for all node reports.
2. Parse YAML frontmatter from each report to reconstruct the DAG.
3. Build and display the graph visualization (see below).
4. Show summary stats.
5. If `.otterwise/autopilot.json` exists, display the **Autopilot Status** section.
6. If no research exists, mention `/otterwise:research` to start.

---

## Graph Visualization

Build a tree from the DAG (nodes with `parents: []` are roots). Display using indented tree format:

```
Research Graph:
├── ● basic-profiling (5 findings)
│   ├── ● correlation-deep-dive (4 findings)
│   │   └── ○ time-series-analysis (expanding...)
│   └── ● distribution-analysis (3 findings)
│       └── ◌ segmentation
├── ✗ outlier-scan (dead-end)
└── ● quality-audit (2 findings)
    └── ● missing-data + correlation-deep-dive (3 findings)  <- cross-branch
```

Legend: `●` completed `○` in-progress `◌` pending `✗` dead-end

### Cross-branch nodes

Nodes with multiple parents represent cross-branch combinations. Show them under their first parent with a `<- cross-branch` annotation and list all parent names joined with ` + `.

### Node label format

- Completed: `● {name} ({findingsCount} findings)`
- In-progress: `○ {name} (expanding...)`
- Pending: `◌ {name}`
- Dead-end: `✗ {name} (dead-end)`

---

## Summary Stats

After the graph, display:

```
Summary:
  Total nodes:    7
  Completed:      5
  In-progress:    1
  Pending:        1
  Dead-ends:      0
  Total findings: 17
  DAG depth:      3
  Dataset:        path/to/data.csv
```

- **DAG depth**: longest path from any root to any leaf.
- **Dataset**: read from `.otterwise/config.json`.

---

## Autopilot Status Section

Displayed **only** when `.otterwise/autopilot.json` exists. Appears after summary stats.

Read `.otterwise/autopilot.json` for session data (nodes, status, config). Read `.otterwise/autopilot-state.json` for the live control state if it exists.

### Running (`status` is `"running"`, `autopilot-state.json` command is `"running"` or missing)

```
Autopilot:
  Status:     RUNNING
  Nodes:      {totalNodes}
  Findings:   {totalFindings} total
  Expanding:  {last in-progress node name}
  Direction:  {current expansion direction from latest node's goals}
  DAG depth:  {current DAG depth}
  Elapsed:    {elapsed since createdAt}

  Expansion History:
    1. ● basic-profiling (5 findings)
    2. ● correlation-deep-dive (4 findings)
    3. ○ time-series-analysis (expanding...)
```

- List nodes in creation order.
- For completed nodes: show `●` with findings count.
- For the current in-progress node: show `○` with `(expanding...)`.
- **Direction**: read from the latest node's frontmatter `goals` field; shows what the autopilot is currently investigating.

### Paused (`autopilot-state.json` command is `"pause"`)

```
Autopilot:
  Status:     PAUSED
  Nodes:      {totalNodes}
  Findings:   {totalFindings} total
  Paused at:  {updatedAt from autopilot-state.json}
  Elapsed:    {elapsed since createdAt}

  Expansion History:
    1. ● basic-profiling (5 findings)
    2. ● correlation-deep-dive (4 findings)
    ...
```

- Autopilot will resume from where it left off when unpaused.

### Aborting (`autopilot-state.json` command is `"abort"`)

```
Autopilot:
  Status:     ABORTING (will stop after current node)
  Nodes:      {totalNodes}
  Findings:   {totalFindings} total (partial)

  Expansion History:
    1. ● basic-profiling (5 findings)
    ...
```

### Aborted (`status` is `"aborted"`)

```
Autopilot:
  Status:     ABORTED
  Nodes:      {totalNodes}
  Findings:   {totalFindings} total

  Expansion History:
    1. ● basic-profiling (5 findings)
    ...
```

- Research data remains in `.otterwise/` and can be continued by running `/otterwise:autopilot` again.

---

## Data Sources

**`.otterwise/nodes/{node-id}/report.md`** -- DAG source of truth via YAML frontmatter:
- `id`, `name`, `parents` (array of parent IDs), `status`, `findingsCount`, `goals`, `dataset`

**`.otterwise/config.json`** -- dataset path, goals (immutable after init)

**`.otterwise/autopilot.json`** -- autopilot session state:
- `status` (`"running"` | `"aborted"`), `totalFindings`, `createdAt`
- `nodes[]`: each with `id`, `parentIds`, `status`, `findingsCount`, `startedAt`, `completedAt`

**`.otterwise/autopilot-state.json`** -- live control signal (may not exist):
- `command`: `"running"` | `"pause"` | `"abort"`
- `updatedAt`, `reason`

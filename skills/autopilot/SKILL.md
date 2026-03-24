---
name: autopilot
description: Run autonomous research that grows a DAG of investigation nodes until convergence
---

# /otterwise:autopilot

Run a fully autonomous research loop that continuously expands a directed acyclic graph (DAG). Each iteration adds a node — exploring a new direction, deepening a promising finding, or combining insights across branches. The loop runs until the graph converges, hits its safety cap, or the user aborts. You (the main Claude session) ARE the research lead — do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:autopilot /path/to/dataset.csv "Optional research goals"
```

## Workflow

```
INIT ──> EVALUATE ──> EXPAND ──> EVALUATE ──> ... ──> FINALIZE
 │          │            │          │                      │
 │       check stop   TeamCreate   │                  write report
 │       conditions   TaskCreate   │
 │       select       Agent x K   │
 │       candidate    TeamDelete  │
 │                                │
 Node 0              Node 1+     loop back
```

## Phase 1: INIT

1. Parse user input: dataset path, optional goals, optional config overrides.
2. Create `.otterwise/` directory. Write `config.json` (dataset, goals) and `autopilot.json`:
   ```json
   { "maxNodes": 15, "status": "running", "nodes": [] }
   ```
3. Write `autopilot-state.json` with `command: "running"`.
4. Explore the dataset inline: read structure, fields, types, size.
5. Design 3-5 objective sets for the seed node (profiling, distributions, correlations, quality, outliers).
6. Execute using the Teams API lifecycle (see below).
7. Synthesize findings into `.otterwise/nodes/{node-id}/report.md` with frontmatter.
8. Append node metadata to `autopilot.json`. Proceed to EVALUATE.

## Phase 2: EVALUATE

1. Read `autopilot-state.json`. If `command === "abort"`, jump to FINALIZE.
2. Check stopping conditions:
   - `nodes.length >= maxNodes` (default 15) --> FINALIZE, reason: "max-nodes"
   - No viable expansion candidates --> FINALIZE, reason: "exhausted"
   - Convergence: last 2+ nodes added fewer than 2 new findings each --> FINALIZE, reason: "converged"
   - `command === "abort"` --> FINALIZE, reason: "user-abort"
3. Glob all `.otterwise/nodes/*/report.md`. Parse YAML frontmatter to build the DAG.
4. Extract expansion candidates from all reports:
   - Open questions and suggested follow-ups
   - Cross-branch combinations: pairs of branches whose findings suggest a testable hypothesis
   - Dead-end pivots: failed approaches that hint at alternative directions
5. Select the single most promising candidate based on:
   - Richness of parent findings worth deepening
   - Unexplored potential (not already covered by other branches)
   - Alignment with user's research goals
   - Cross-branch synergy: combining branches that would yield insights neither could find alone
6. If no candidate is meaningfully better than existing knowledge, stop (reason: "exhausted").
7. Proceed to EXPAND with the selected candidate.

## Phase 3: EXPAND

1. Design 3-5 objective sets for the selected candidate.
   - Single-parent: deepen parent findings, address its open questions.
   - Multi-parent: combine insights from multiple parents, test interaction hypothesis.
2. Execute using the Teams API lifecycle (see below).
3. Synthesize findings into `.otterwise/nodes/{node-id}/report.md` with frontmatter including `parentIds`.
4. Append node metadata to `autopilot.json`.
5. Return to EVALUATE.

## Phase 4: FINALIZE

1. Read all `.otterwise/nodes/*/report.md` files. Build the complete DAG.
2. Group findings by theme across all branches.
3. Identify cross-branch insights: patterns that only emerged from combining branches.
4. Write `.otterwise/autopilot-report.md` containing:
   - Quick facts: total nodes, findings count, stopping reason
   - Investigation narrative: how the research evolved, key branching decisions, turning points
   - Research graph: Mermaid flowchart of the DAG (`-->` for single-parent, `-.->` for cross-branch)
   - Key findings grouped by theme (cite node IDs)
   - Cross-branch insights
   - Open questions for future investigation
   - Statistics table
5. Update `autopilot.json`: status "completed", stoppingReason, completedAt.
6. Update `autopilot-state.json`: command "completed".
7. Report to user: path to report, total nodes, total findings, stopping reason.

## Teams API Lifecycle (Per Node)

```
1. TeamCreate    name: "autopilot-{YYYYMMDD-HHMMSS}-{node-id}"
2. TaskCreate    x K tasks (one per researcher, K = 3 default)
3. Agent         x K (ALL in one message for parallel execution)
                   subagent_type: "general-purpose"
                   mode: "bypassPermissions"
                   run_in_background: true
4. TaskList      poll until all tasks show "completed"
5. Read          .otterwise/nodes/{node-id}/researcher-{1..K}/summary.md
6. SendMessage   shutdown_request to each researcher
7. TeamDelete    clean up the node's team
```

## Researcher Prompt Template

Each researcher spawned via Agent receives:

```
You are "researcher-{K}" on team "{team-name}". Task ID: #{task-id}.

**Objectives**: {bullet-point objectives}
**Dataset**: {absolute-dataset-path}
**Output directory**: .otterwise/nodes/{node-id}/researcher-{K}/

**Parent context** (expansion nodes only):
{parent report key findings, open questions, dead ends}
{For multi-parent: all parent reports + synthesis hypothesis to test}

**When done**: Write summary.md to output dir. TaskUpdate(taskId, status: "completed"). SendMessage findings to team-lead.
**Teammates**: {names} -- coordinate via SendMessage if findings are relevant to their work.
```

## Summary Format

Each researcher writes `summary.md`:

```markdown
## Objective
{assigned objectives}
## Approach
{2-3 sentences}
## Key Findings
{3-5 results with specific numbers/evidence}
## Confidence
{High|Medium|Low} -- {justification}
## Dead Ends
{what didn't work}
## Suggested Follow-ups
{1-3 unexplored directions}
```

## Cross-Branch Combination

Multi-parent nodes combine insights from different branches. Look for:
- **Cause + effect**: Branch A found a mechanism, Branch B observed an outcome -- test the link.
- **Shared dependency**: Two branches reference the same entity -- investigate the connection.
- **Contradiction**: Branch A claims X, Branch B implies not-X -- resolve the conflict.

Multi-parent frontmatter: `parentIds: ["id-1", "id-2"]`. The researcher prompt must include findings from all parents and frame the specific hypothesis.

## State Management

### Files

| File | Purpose |
|------|---------|
| `config.json` | Dataset path, goals (immutable after INIT) |
| `autopilot.json` | maxNodes, status, nodes[] (append-only) |
| `autopilot-state.json` | User control: "running" / "abort" / "completed" |
| `nodes/{id}/report.md` | DAG node with YAML frontmatter |
| `nodes/{id}/researcher-{K}/summary.md` | Individual researcher output |
| `autopilot-report.md` | Final synthesis report |

### Report Frontmatter (DAG Source of Truth)

```yaml
---
id: "YYYYMMDD_HHMMSS_XXXX"
name: "descriptive-kebab-case"
parentIds: []                        # empty for seed node
# parentIds: ["id-1"]               # single-parent expansion
# parentIds: ["id-1", "id-2"]      # cross-branch combination
dataset: "path/to/data.csv"
status: "completed"
findingsCount: 5
---
```

The DAG is reconstructed entirely from these frontmatter blocks each iteration.

### autopilot.json Schema

```json
{
  "maxNodes": 15,
  "status": "running",
  "nodes": [
    {
      "id": "YYYYMMDD_HHMMSS_XXXX",
      "parentIds": [],
      "status": "completed",
      "findingsCount": 5,
      "name": "descriptive-kebab-case"
    }
  ]
}
```

### Directory Structure

```
.otterwise/
  config.json
  autopilot.json
  autopilot-state.json
  nodes/
    {node-id}/
      report.md
      researcher-{K}/summary.md
  autopilot-report.md
```

## Stopping & Error Handling

**4 stopping conditions** (checked at start of each EVALUATE):
1. Max nodes reached (`nodes.length >= maxNodes`, default 15)
2. No viable expansion candidates (graph naturally exhausted)
3. Convergence (last 2+ nodes each produced fewer than 2 new findings)
4. User abort (`autopilot-state.json` command is "abort")

**Abort**: `/autopilot-abort` writes `command: "abort"` to `autopilot-state.json`. Next EVALUATE jumps to FINALIZE. To resume: re-run `/autopilot` (recovers from last complete node).

**Recovery**: Glob `nodes/*/report.md`, rebuild DAG. Delete incomplete node folders (no report.md). Resume from EVALUATE.

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, FINALIZE with reason "error". |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | FINALIZE immediately with reason "error". |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the autopilot loop.
- One team per node, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing between nodes -- serialize outputs to disk.
- The DAG is the source of truth. Rebuild it from report frontmatter each iteration.
- Node IDs use timestamps for natural ordering: `YYYYMMDD_HHMMSS_XXXX`.

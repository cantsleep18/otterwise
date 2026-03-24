---
name: autopilot
description: Run autonomous research that grows a DAG of investigation nodes indefinitely
---

# /otterwise:autopilot

Run a fully autonomous research loop that continuously expands a directed acyclic graph (DAG). Each iteration adds a node -- exploring a new direction, deepening a promising finding, or combining insights across branches. The loop runs forever until the user aborts. You (the main Claude session) ARE the research lead -- do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:autopilot /path/to/dataset.csv "Optional research goals"
```

Re-running on an existing `.otterwise/` directory resumes from the current state.

## Workflow

```
           ┌──────────────────────────────────┐
           v                                  │
INIT ──> EVALUATE ──> EXPAND ──> EVALUATE ──> EXPAND ──> ...
 or                     │
RESUME                  │
 │                   TeamCreate
 │                   TaskCreate
 │                   Agent x K
 │                   TeamDelete
 │
 Node 0 (seed)       Node 1+
```

## Phase 1: INIT (no existing nodes)

1. Parse user input: dataset path, optional goals.
2. Create `.otterwise/` directory. Write `config.json` (dataset, goals) and `autopilot.json`:
   ```json
   { "status": "running", "nodes": [] }
   ```
3. Write `autopilot-state.json` with `command: "running"`.
4. Explore the dataset inline: read structure, fields, types, size.
5. Design 3-5 objective sets for the seed node (profiling, distributions, correlations, quality, outliers).
6. Execute using the Teams API lifecycle (see below).
7. Synthesize findings into `.otterwise/nodes/{node-id}/report.md` with frontmatter.
8. Append node metadata to `autopilot.json`. Proceed to EVALUATE.

## Phase 1 (alt): RESUME (existing nodes found)

1. Glob `.otterwise/nodes/*/report.md`. Parse YAML frontmatter to rebuild the DAG.
2. Delete incomplete node folders (those without `report.md`).
3. Sync `autopilot.json` nodes array with what exists on disk.
4. Set `autopilot-state.json` command to `"running"`.
5. Proceed to EVALUATE.

## Phase 2: EVALUATE

1. Read `autopilot-state.json`. If `command === "abort"`, set `autopilot.json` status to `"aborted"` and stop.
2. Glob all `.otterwise/nodes/*/report.md`. Parse YAML frontmatter to rebuild the DAG.
3. Extract expansion candidates from all reports:
   - Open questions and suggested follow-ups
   - Cross-branch combinations: pairs of branches whose findings suggest a testable hypothesis
   - Dead-end pivots: failed approaches that hint at alternative directions
4. Select the single most promising candidate based on:
   - Richness of parent findings worth deepening
   - Unexplored potential (not already covered by other branches)
   - Alignment with user's research goals
   - Cross-branch synergy: combining branches that yield insights neither could find alone
5. **If no obvious candidates remain**: do NOT stop. Instead, synthesize new candidates:
   - Mix insights from unrelated branches to form novel hypotheses
   - Combine data from the most distant nodes in the DAG
   - Revisit dead ends with new context gained from later nodes
   - Try completely new analytical angles on the raw dataset
   - Challenge or invert prior assumptions
6. Proceed to EXPAND with the selected candidate.

## Phase 3: EXPAND

1. Design 3-5 objective sets for the selected candidate.
   - Single-parent: deepen parent findings, address its open questions.
   - Multi-parent: combine insights from multiple parents, test interaction hypothesis.
2. Execute using the Teams API lifecycle (see below).
3. Synthesize findings into `.otterwise/nodes/{node-id}/report.md` with frontmatter including `parentIds`.
4. Append node metadata to `autopilot.json`.
5. Return to EVALUATE.

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

## Generating Candidates When the Graph Seems Exhausted

The research never hits a dead end. When standard candidates (follow-ups, open questions) run dry:

1. **Cross-pollinate**: Pick the two most distant branches in the DAG and hypothesize a connection.
2. **Invert assumptions**: Take a high-confidence finding and design a node that tries to disprove it.
3. **Zoom out**: Step back from details and ask what macro-level patterns the dataset might reveal.
4. **Zoom in**: Pick an overlooked column or subpopulation and profile it deeply.
5. **Method shift**: If prior nodes used correlations, try clustering. If they used statistics, try visualization-oriented analysis.
6. **Temporal/segment splits**: Partition the data differently (time windows, percentiles, categories) and re-analyze.

## State Management

### Files

| File | Purpose |
|------|---------|
| `config.json` | Dataset path, goals (immutable after INIT) |
| `autopilot.json` | Status, nodes[] (append-only) |
| `autopilot-state.json` | User control: "running" / "abort" |
| `nodes/{id}/report.md` | DAG node with YAML frontmatter |
| `nodes/{id}/researcher-{K}/summary.md` | Individual researcher output |

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

Status is `"running"` or `"aborted"`. No other values.

### autopilot-state.json Schema

```json
{ "command": "running" }
```

Only two valid commands: `"running"` and `"abort"`.

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
```

## Error Handling

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, log error, skip this node, return to EVALUATE. |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | Set status to "aborted" in autopilot.json and stop. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the autopilot loop.
- One team per node, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing between nodes -- serialize outputs to disk.
- The DAG is the source of truth. Rebuild it from report frontmatter each iteration.
- Node IDs use timestamps for natural ordering: `YYYYMMDD_HHMMSS_XXXX`.
- The loop never self-terminates. Only user abort stops it.
- Re-running `/autopilot` on an existing `.otterwise/` directory is the resume mechanism.

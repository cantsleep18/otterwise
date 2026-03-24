---
name: autopilot
description: Run autonomous multi-round research with graph-based expansion and cross-branch insight combination
---

# /otterwise:autopilot

Run a fully autonomous multi-round research loop that grows a research DAG. Start with initial research, then repeatedly select the most promising direction to expand until stopping conditions are met. You (the main Claude session) ARE the research lead — do NOT delegate leadership to a sub-agent.

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
 │       select       Agent x K    │
 │       candidate    TaskList     │
 │                    TeamDelete   │
 Round 1              Round 2+     loop back
```

## Phase 1: INIT

1. Parse user input: dataset path, optional goals, optional config overrides.
2. Create `.otterwise/` directory. Write `config.json` (dataset, goals) and `autopilot.json` (maxRounds, status: "running", rounds: []).
3. Write `autopilot-state.json` with `command: "running"`.
4. Explore the dataset inline: read structure, fields, types, size.
5. Design 3-5 objective sets for Round 1 (profiling, distributions, correlations, quality, outliers).
6. Execute Round 1 using the Teams API lifecycle (see below).
7. Synthesize findings into `.otterwise/round-1/report.md` with frontmatter.
8. Proceed to EVALUATE.

## Phase 2: EVALUATE

1. Read `autopilot-state.json`. If `command === "abort"`, jump to FINALIZE.
2. Check stopping conditions (only these 3):
   - `rounds.length >= maxRounds` (default 5) --> FINALIZE, reason: "max-rounds"
   - No viable expansion candidates --> FINALIZE, reason: "exhausted"
   - `command === "abort"` --> FINALIZE, reason: "user-abort"
3. Glob all `.otterwise/round-*/report.md`. Parse YAML frontmatter to build the DAG.
4. Extract expansion candidates from all reports:
   - Open questions and suggested follow-ups
   - Cross-branch combinations: pairs of branches whose findings suggest a testable hypothesis
   - Dead-end pivots: failed approaches that hint at alternative directions
5. Select the single most promising candidate based on:
   - Richness of parent findings worth deepening
   - Unexplored potential (not already covered by other branches)
   - Alignment with user's research goals
   - Impact on final report quality
6. For cross-branch candidates: prefer them when combining branches would yield insights neither branch could find alone.
7. If no candidate feels meaningfully better than existing knowledge, stop (reason: "exhausted").
8. Proceed to EXPAND with the selected candidate.

## Phase 3: EXPAND

1. Design 3-5 objective sets for the selected candidate.
   - Single-parent: deepen parent findings, address its open questions.
   - Multi-parent: combine insights from both parents, test interaction hypothesis.
2. Execute the round using the Teams API lifecycle (see below).
3. Synthesize findings into `.otterwise/round-{N}/report.md` with frontmatter including `parents` (one ID for single-parent, array for multi-parent).
4. Append round metadata to `autopilot.json`.
5. Return to EVALUATE.

## Phase 4: FINALIZE

1. Read all `.otterwise/round-*/report.md` files. Build the complete DAG.
2. Group findings by theme across all branches.
3. Identify cross-branch insights: patterns that only emerged from combining branches.
4. Write `.otterwise/autopilot-report.md` containing:
   - Quick facts: rounds, findings count, stopping reason
   - Investigation narrative: how the research evolved, key branching decisions, turning points
   - Research graph: Mermaid flowchart of the DAG (`-->` for single-parent, `-.->` for cross-branch)
   - Key findings grouped by theme (cite round IDs)
   - Cross-branch insights
   - Open questions for future investigation
   - Statistics table
5. Update `autopilot.json`: status "completed", stoppingReason, completedAt.
6. Update `autopilot-state.json`: command "completed".
7. Report to user: path to report, total rounds, total findings, stopping reason.

## Teams API Lifecycle (Per Round)

```
1. TeamCreate    name: "autopilot-{YYYYMMDD-HHMMSS}-round-{N}"
2. TaskCreate    x K tasks (one per researcher, K = 3 default)
3. Agent         x K (ALL in one message for parallel execution)
                   subagent_type: "general-purpose"
                   mode: "bypassPermissions"
                   run_in_background: true
4. TaskList      poll until all tasks show "completed"
5. Read          .otterwise/round-{N}/researcher-{1..K}/summary.md
6. SendMessage   shutdown_request to each researcher
7. TeamDelete    clean up the round's team
```

## Researcher Prompt Template

Each researcher spawned via Agent receives:

```
You are "researcher-{K}" on team "{team-name}". Task ID: #{task-id}.

**Objectives**: {bullet-point objectives}
**Dataset**: {absolute-dataset-path}
**Output directory**: .otterwise/round-{N}/researcher-{K}/

**Parent context** (expansion rounds only):
{parent report key findings, open questions, dead ends}
{For multi-parent: both parent reports + synthesis hypothesis to test}

**Tools**: Use mcp__python-repl__python_repl (start_notebook, execute, get_state).
**When done**: Write summary.md to output dir. TaskUpdate(taskId, status: "completed"). SendMessage findings to team-lead.
**Teammates**: {names} — coordinate via SendMessage if findings are relevant to their work.
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
{High|Medium|Low} — {justification}
## Dead Ends
{what didn't work}
## Suggested Follow-ups
{1-3 unexplored directions}
```

## Cross-Branch Combination

Multi-parent nodes combine insights from different branches. Look for:
- **Cause + effect**: Branch A found a mechanism, Branch B observed an outcome — test the link.
- **Shared dependency**: Two branches reference the same entity — investigate the connection.
- **Contradiction**: Branch A claims X, Branch B implies not-X — resolve the conflict.

Multi-parent frontmatter: `parents: ["id-1", "id-2"]`. The researcher prompt must include findings from all parents and frame the specific hypothesis.

## State Management

### Files

| File | Purpose |
|------|---------|
| `config.json` | Dataset path, goals (immutable after INIT) |
| `autopilot.json` | maxRounds, status, rounds[] (append-only) |
| `autopilot-state.json` | User control: "running" / "abort" / "completed" |
| `round-{N}/report.md` | DAG node with YAML frontmatter |
| `round-{N}/researcher-{K}/summary.md` | Individual researcher output |
| `autopilot-report.md` | Final synthesis report |

### Report Frontmatter (DAG Source of Truth)

```yaml
---
id: "YYYYMMDD_HHMMSS_XXXX"
name: "descriptive-kebab-case"
parents: []                          # empty for Round 1
# parents: ["id-1"]                  # single-parent expansion
# parents: ["id-1", "id-2"]         # cross-branch combination
dataset: "path/to/data.csv"
status: "completed"
findingsCount: 5
---
```

The DAG is reconstructed entirely from these frontmatter blocks each round.

### Directory Structure

```
.otterwise/
├── config.json
├── autopilot.json
├── autopilot-state.json
├── round-{N}/
│   ├── report.md
│   └── researcher-{K}/summary.md
└── autopilot-report.md
```

## Stopping & Error Handling

**3 stopping conditions** (checked at start of each EVALUATE):
1. Max rounds reached (`rounds.length >= maxRounds`, default 5)
2. No viable expansion candidates (graph naturally exhausted)
3. User abort (`autopilot-state.json` command is "abort")

**Abort**: `/autopilot-abort` writes `command: "abort"` to `autopilot-state.json`. Next EVALUATE jumps to FINALIZE. To resume: re-run `/autopilot` (recovers from last complete round).

**Recovery**: Glob `round-*/report.md`, rebuild DAG. Delete incomplete round folders (no report.md). Resume from EVALUATE.

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, FINALIZE with reason "error". |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | FINALIZE immediately with reason "error". |
| MCP server crash | Auto-respawn handles it (built into Claude Code). |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the autopilot loop.
- One team per round, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing between rounds — serialize outputs to disk.
- The DAG is the source of truth. Rebuild it from report frontmatter each round.

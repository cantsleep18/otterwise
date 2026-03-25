---
name: continue
description: Expand an existing Otterwise research DAG with new analysis nodes
---

# /otterwise:continue

Expand the research DAG with new analysis nodes. You (the main Claude session) ARE the research lead — do NOT delegate to a sub-agent.

## Usage
The user can optionally specify:
- A focus direction (e.g., "dig deeper into the correlation findings")
- A specific node to expand from (by name or ID)

## Workflow

### 1. Load Context
1. Verify `.otterwise/` exists and has at least one completed research node
2. Read `.otterwise/config.json` for dataset info

### 2. Check Autopilot State (if active)
If `.otterwise/autopilot-state.json` exists, read it and check the `command` field:
- **`"running"`**: Proceed normally.
- **`"pause"`**: Tell the user the autopilot session is paused. They can resume with `/otterwise:autopilot-pause` before continuing.
- **`"abort"`**: Tell the user the autopilot session has been aborted (terminal state). Manual continue is still allowed — proceed normally.

### 3. Understand the Research DAG
- Use Glob to find all `.otterwise/nodes/**/report.md` files
- Read each report.md — parse the YAML frontmatter:
  - `id`: unique node identifier (YYYYMMDD_HHMMSS_{8hex}_{name})
  - `parentIds`: parent node IDs (empty for root nodes)
  - `related`: sibling/related node IDs
  - `status`: completed, in-progress, dead-end
  - `findings_count`: number of key findings
- Read the full content of each report to understand what was discovered
- Build a mental model of the research DAG — identify leaf nodes, dead ends, and promising branches

### 4. Plan DAG Expansion
Based on the existing DAG, decide where to add new nodes:
- **Deepen**: Expand leaf nodes with promising findings
- **Branch**: Fork from nodes where dead ends suggest adjacent unexplored topics
- **Fill gaps**: Add nodes for important aspects not yet examined
- **Cross-reference**: Combine insights from multiple branches into a synthesis node

If the user provided a focus direction, prioritize that.
If the user specified a node, expand from that node.

### 5. Design Objectives
Create 3-5 sets of objective bullet points, one per teammate. Each set should:
- Be specific and actionable
- Reference specific parent node IDs and their findings
- Be independent enough for parallel execution

### 6. Create Agent Team and Spawn Researchers

IMPORTANT: You are the team lead. Create the team and spawn teammates DIRECTLY.

#### 6a. Create the team
Use **TeamCreate** with a descriptive name:
```
team_name: "research-{YYYYMMDD-HHMMSS}-{short-topic}"
```

#### 6b. Create output directories
Each new node gets its own directory under `.otterwise/nodes/`:
```bash
mkdir -p .otterwise/nodes/{node-id-1} .otterwise/nodes/{node-id-2} ...
```
Generate node IDs using the format `YYYYMMDD_HHMMSS_{8hex}_{name}` where `{8hex}` is an 8-character hex hash and `{name}` is a descriptive kebab-case name (e.g., `20260325_143000_a1b2c3d4_correlation-analysis`).

#### 6c. Create tasks for tracking
Use **TaskCreate** to create one task per teammate.

#### 6d. Spawn ALL teammates in a SINGLE message
Use multiple parallel **Agent** tool calls with:
- `subagent_type`: `"general-purpose"`
- `team_name`: the team name from step 6a
- `name`: `"researcher-N"`
- `mode`: `"bypassPermissions"`
- `run_in_background`: `true`

Each teammate's `prompt` MUST include ALL of the following:
1. **Objectives**: Their assigned objective bullet points
2. **Dataset path**: The full absolute path to the dataset
3. **Task ID**: Their task ID, with instruction to mark it completed via TaskUpdate
4. **Team name**: The actual team name so they can use SendMessage
5. **Teammate list**: Names of all teammates for cross-communication
6. **Analysis approach**: Use built-in capabilities (Bash, Read, Write, etc.) for data analysis. Use **WebSearch** and **WebFetch** to find relevant external context, benchmarks, or domain knowledge.
7. **Source citation rule**: Every key finding must include `[source: URL]` for external sources or `[source: dataset analysis]` for findings derived from the data directly.
8. **Output directory**: Full path to their node directory (`.otterwise/nodes/{node-id}/`)
9. **Summary format**: Write `summary.md` using the format below
10. **Parent findings**: Key context from parent node reports so they build on prior work
11. **Error escalation**: If a critical error occurs (dataset unreadable, tool failure, no results after exhausting approaches), send a message to `team-lead` describing the error before marking the task completed.
12. **Instruction to send findings to team-lead via SendMessage when done**

### 7. Monitor, Collect, Synthesize
- Poll **TaskList** until all teammate tasks complete
- Read each teammate's `summary.md` from their node directory
- Synthesize findings across all new nodes

### 8. Write Report
Create `report.md` in each new node's directory with YAML frontmatter:

```yaml
---
id: "{YYYYMMDD_HHMMSS}_{8-char-hex}_{descriptive-kebab-case-name}"
parentIds:
  - "{parent-node-id}"
related:
  - "{related-node-ids}"
dataset: "{dataset-path}"
status: "completed"
findings_count: {number}
---
```

Report body structure:
- Executive Summary (2-3 paragraphs)
- Key Findings (with evidence and source references)
- Dead Ends & Branch Points
- Open Questions (candidates for further DAG expansion)

### 9. Clean Up
1. Send shutdown requests to all teammates
2. Use **TeamDelete** to remove the team
3. Report results and updated DAG state to the user

## Teammate Summary Format
Each teammate writes `summary.md` in their node directory:

```markdown
# Investigation: [title]

## Objective
[Assigned bullet points]

## Approach
[How objectives were decomposed]

## Key Findings
[3-5 key results with specific numbers]

## Confidence
[High / Medium / Low] — [justification]

## Dead Ends
[What didn't work]

## Suggested Follow-ups
[1-3 directions for further DAG expansion]

## Sources
[List all URLs referenced in findings, one per line]
```

## Important Rules
- You ARE the team lead — never delegate team creation to a sub-agent
- Never duplicate analysis from existing nodes — read all reports first
- Reference parent node findings in teammate prompts so they build on prior work
- All node directories live under `.otterwise/nodes/{node-id}/`
- Parent-child relationships tracked via report.md YAML frontmatter `parentIds`
- ID format: `YYYYMMDD_HHMMSS_{8hex}_{name}` where `{8hex}` is an 8-character hex hash and `{name}` is a descriptive kebab-case name
- Researchers must use **WebSearch/WebFetch** for external context — all key findings require `[source: URL]` or `[source: dataset analysis]`
- If an autopilot session is paused, inform the user before proceeding. If aborted, manual continue is still allowed.

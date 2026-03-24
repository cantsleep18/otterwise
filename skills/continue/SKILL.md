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

### 2. Understand the Research DAG
- Use Glob to find all `.otterwise/nodes/**/report.md` files
- Read each report.md — parse the YAML frontmatter:
  - `id`: unique node identifier (YYYYMMDD_HHMMSS_XXXX)
  - `parentIds`: parent node IDs (empty for root nodes)
  - `related`: sibling/related node IDs
  - `status`: completed, in-progress, dead-end
  - `findings_count`: number of key findings
- Read the full content of each report to understand what was discovered
- Build a mental model of the research DAG — identify leaf nodes, dead ends, and promising branches

### 3. Plan DAG Expansion
Based on the existing DAG, decide where to add new nodes:
- **Deepen**: Expand leaf nodes with promising findings
- **Branch**: Fork from nodes where dead ends suggest adjacent unexplored topics
- **Fill gaps**: Add nodes for important aspects not yet examined
- **Cross-reference**: Combine insights from multiple branches into a synthesis node

If the user provided a focus direction, prioritize that.
If the user specified a node, expand from that node.

### 4. Design Objectives
Create 3-5 sets of objective bullet points, one per teammate. Each set should:
- Be specific and actionable
- Reference specific parent node IDs and their findings
- Be independent enough for parallel execution

### 5. Create Agent Team and Spawn Researchers

IMPORTANT: You are the team lead. Create the team and spawn teammates DIRECTLY.

#### 5a. Create the team
Use **TeamCreate** with a descriptive name:
```
team_name: "research-{YYYYMMDD-HHMMSS}-{short-topic}"
```

#### 5b. Create output directories
Each new node gets its own directory under `.otterwise/nodes/`:
```bash
mkdir -p .otterwise/nodes/{node-id-1} .otterwise/nodes/{node-id-2} ...
```
Generate node IDs using the format `YYYYMMDD_HHMMSS_XXXX` (XXXX = 4-char hex hash).

#### 5c. Create tasks for tracking
Use **TaskCreate** to create one task per teammate.

#### 5d. Spawn ALL teammates in a SINGLE message
Use multiple parallel **Agent** tool calls with:
- `subagent_type`: `"general-purpose"`
- `team_name`: the team name from step 5a
- `name`: `"researcher-N"`
- `mode`: `"bypassPermissions"`
- `run_in_background`: `true`

Each teammate's `prompt` MUST include ALL of the following:
1. **Objectives**: Their assigned objective bullet points
2. **Dataset path**: The full absolute path to the dataset
3. **Task ID**: Their task ID, with instruction to mark it completed via TaskUpdate
4. **Team name**: The actual team name so they can use SendMessage
5. **Teammate list**: Names of all teammates for cross-communication
6. **Analysis approach**: Use built-in capabilities (Bash, Read, Write, etc.) for data analysis
7. **Output directory**: Full path to their node directory (`.otterwise/nodes/{node-id}/`)
8. **Summary format**: Write `summary.md` using the format below
9. **Parent findings**: Key context from parent node reports so they build on prior work
10. **Instruction to send findings to team-lead via SendMessage when done**

### 6. Monitor, Collect, Synthesize
- Poll **TaskList** until all teammate tasks complete
- Read each teammate's `summary.md` from their node directory
- Synthesize findings across all new nodes

### 7. Write Report
Create `report.md` in each new node's directory with YAML frontmatter:

```yaml
---
id: "{YYYYMMDD_HHMMSS}_{4-char-hex-hash}"
name: "{descriptive-kebab-case-name}"
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

### 8. Clean Up
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
```

## Important Rules
- You ARE the team lead — never delegate team creation to a sub-agent
- Never duplicate analysis from existing nodes — read all reports first
- Reference parent node findings in teammate prompts so they build on prior work
- All node directories live under `.otterwise/nodes/{node-id}/`
- Parent-child relationships tracked via report.md YAML frontmatter `parentIds`
- ID format: YYYYMMDD_HHMMSS_XXXX where XXXX is a 4-character hex hash

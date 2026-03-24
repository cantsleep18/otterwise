---
name: research
description: Start a new Otterwise research session on a dataset
---

# /otterwise:research

Start a new autonomous research session. You (the main Claude session) ARE the research lead -- do NOT delegate to a sub-agent.

## Usage
The user should provide:
- Path to a dataset file (CSV, Excel, Parquet, etc.) or directory
- Research goals or questions (optional -- will do general profiling if none given)

## Workflow

### 1. Setup
1. If dataset path not provided, ask the user for it
2. Create `.otterwise/` directory in the project root if it doesn't exist
3. Create or update `.otterwise/config.json`:
   ```json
   {
     "dataset": "<absolute-path-to-dataset>",
     "dataDescription": "<brief description of the data if user provided one>",
     "goals": ["<user-provided-goals-or-default>"],
     "created": "<ISO-timestamp>"
   }
   ```

### 2. Explore the Dataset
- Read the dataset (or sample files if it's a directory) to understand its structure
- Identify key fields, types, and patterns
- Note data size, format, and any quirks

### 3. Understand Research History
- Use Glob to find all `.otterwise/nodes/**/report.md` files
- Read each report.md -- parse the YAML frontmatter:
  - `id`: unique node identifier (YYYYMMDD_HHMMSS_XXXX)
  - `parentIds`: list of parent node IDs (empty for root nodes)
  - `related`: sibling/related node IDs
  - `status`: completed, in-progress, dead-end
  - `findings_count`: number of key findings
- Read the full content of each report to understand what was discovered
- Build a mental model of the research DAG

For the FIRST research session (no previous reports):
- Start with basic profiling, distribution analysis, and key variable relationships

### 4. Design Objectives
Create 3-5 sets of objective bullet points, one per teammate. Each set should:
- Be specific and actionable
- Reference specific columns/features/files when possible
- Include expected output format
- Be independent enough for parallel execution

### 5. Create Agent Team and Spawn Researchers

IMPORTANT: You are the team lead. Create the team and spawn teammates DIRECTLY -- do NOT delegate to another agent.

#### 5a. Create the team
Use **TeamCreate** with a descriptive name:
```
team_name: "research-{YYYYMMDD-HHMMSS}-{short-topic}"
```

#### 5b. Generate a node ID and create output directories
Generate a node ID in the format `YYYYMMDD_HHMMSS_XXXX` (where XXXX is a 4-character hex hash).
```bash
mkdir -p .otterwise/nodes/{node-id}/{teammate-1,teammate-2,...}
```

#### 5c. Create tasks for tracking
Use **TaskCreate** to create one task per teammate. Each task should:
- Have a descriptive subject summarizing the teammate's objectives
- Include the full objective bullet points in the description

#### 5d. Spawn ALL teammates in a SINGLE message
You MUST spawn all teammates in ONE message using multiple parallel **Agent** tool calls. This ensures they run concurrently.

For each teammate, use the Agent tool with these exact parameters:
- `subagent_type`: `"general-purpose"` (NOT "Explore" -- teammates need Write tools)
- `team_name`: the team name from step 5a
- `name`: `"researcher-N"` (e.g., `researcher-1`, `researcher-2`, etc.)
- `mode`: `"bypassPermissions"`
- `run_in_background`: `true`

Each teammate's `prompt` MUST include ALL of the following:
1. **Objectives**: Their assigned objective bullet points from step 4
2. **Dataset path**: The full absolute path to the dataset
3. **Task ID**: Their task ID from step 5c, with instruction to mark it completed via TaskUpdate
4. **Team name**: The actual team name so they can use SendMessage
5. **Teammate list**: Names of all teammates for cross-communication
6. **Analysis approach**: Use built-in capabilities (Read files, Bash for scripting/computation, Grep for searching). No specific tools are prescribed -- researchers should use whatever approach works best for the analysis.
7. **Output directory**: Full path to their output folder (`.otterwise/nodes/{node-id}/teammate-N/`)
8. **Summary format**: Write `summary.md` using the format below
9. **Instruction to send findings to team-lead via SendMessage when done**

### 6. Monitor Progress
Poll **TaskList** periodically until ALL teammate tasks show status `completed`.
- If a task is stuck, send a message to the teammate via SendMessage
- If a teammate reports issues, provide guidance

### 7. Collect and Synthesize Results
After all teammates complete:
- Read each teammate's `summary.md` from their output directory
- Synthesize findings across all teammates
- Identify agreements, conflicts, and gaps

### 8. Write Report
Create `report.md` in the node folder (`.otterwise/nodes/{node-id}/report.md`) with YAML frontmatter:

```yaml
---
id: "{YYYYMMDD_HHMMSS}_{4-char-hex-hash}"
name: "{descriptive-kebab-case-name}"
parentIds: []
related: []
dataset: "{dataset-path}"
status: "completed"
findings_count: {number}
---
```

Report body structure:
- Executive Summary (2-3 paragraphs)
- Key Findings (with evidence and source references)
- Dead Ends & Branch Points
- Open Questions (candidates for child nodes)

### 9. Clean Up
1. Send shutdown requests to all teammates via SendMessage
2. Wait for shutdown confirmations
3. Use **TeamDelete** to remove the team
4. Report results to the user

## Teammate Summary Format
Each teammate writes `summary.md` in their output directory:

```markdown
# Investigation: [title]

## Objective
[Assigned bullet points]

## Approach
[How objectives were decomposed into steps]

## Key Findings
[3-5 key results with specific numbers]

## Confidence
[High / Medium / Low] -- [justification]

## Dead Ends
[What didn't work]

## Suggested Follow-ups
[1-3 directions for future exploration]
```

## Important Rules
- You ARE the team lead -- never delegate team creation to a sub-agent
- All prompts and analysis in English
- Each research node is a folder in `.otterwise/nodes/`
- Parent-child relationships tracked via report.md YAML frontmatter (`parentIds`)
- Never duplicate analysis that's already been done (read previous reports!)
- ID format: YYYYMMDD_HHMMSS_XXXX where XXXX is a 4-character hex hash
- Recommended team size: 3-5 teammates for most datasets

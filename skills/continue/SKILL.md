---
name: continue
description: Continue and expand an existing Otterwise research session
---

# /otterwise:continue

Expand the research graph with new analysis directions. You (the main Claude session) ARE the research lead — do NOT delegate to a sub-agent.

## Usage
The user can optionally specify:
- A focus direction (e.g., "dig deeper into the correlation findings")
- A specific node to expand from (by name or ID)

## Workflow

### 1. Load Context
1. Verify `.otterwise/` exists and has at least one completed research node
2. Read `.otterwise/config.json` for dataset info

### 2. Understand Research History
- Use Glob to find all `.otterwise/**/report.md` files
- Read each report.md — parse the YAML frontmatter:
  - `id`, `parent`, `related`, `status`, `findings_count`
- Read the full content of each report to understand what was discovered
- Build a mental model of the research DAG

### 3. Plan Research Expansion
Based on previous reports, decide where to expand:
- **Deepen**: Promising findings that warrant deeper analysis
- **Branch**: Dead ends that suggest adjacent unexplored topics
- **Fill gaps**: Important aspects of the data not yet examined
- **Cross-reference**: Combine insights from different branches

If the user provided a focus direction, prioritize that.

### 4. Design Objectives
Create 3-5 sets of objective bullet points, one per teammate. Each set should:
- Be specific and actionable
- Build on previous findings (reference specific report IDs)
- Be independent enough for parallel execution

### 5. Create Agent Team and Spawn Researchers

IMPORTANT: You are the team lead. Create the team and spawn teammates DIRECTLY.

#### 5a. Create the team
Use **TeamCreate** with a descriptive name:
```
team_name: "research-{YYYYMMDD-HHMMSS}-{short-topic}"
```

#### 5b. Create output directories
Determine the parent node ID from the existing research graph.
```bash
mkdir -p .otterwise/{session-id}/{teammate-1,teammate-2,...}
```

#### 5c. Create tasks for tracking
Use **TaskCreate** to create one task per teammate.

#### 5d. Spawn ALL teammates in a SINGLE message
Same as `/otterwise:research` — use multiple parallel **Agent** tool calls with:
- `subagent_type`: `"general-purpose"`
- `team_name`: the team name from step 5a
- `name`: `"researcher-N"`
- `mode`: `"bypassPermissions"`
- `run_in_background`: `true`

Include in each teammate's prompt:
1. Objectives, dataset path, task ID, team name, teammate list
2. MCP tool / Python instructions
3. Output directory and summary format
4. **Previous findings**: Key context from parent report so they don't re-do work
5. Instruction to send findings to team-lead via SendMessage

### 6. Monitor, Collect, Synthesize
Same as `/otterwise:research`:
- Poll TaskList until all tasks complete
- Read each teammate's summary.md
- Synthesize findings

### 7. Write Report
Create `report.md` with YAML frontmatter — set `parent` to the parent node ID:

```yaml
---
id: "{YYYYMMDD_HHMMSS}_{4-char-hex-hash}"
name: "{descriptive-kebab-case-name}"
parent: "{parent-node-id}"
related:
  - "{related-node-ids}"
dataset: "{dataset-path}"
status: "completed"
findings_count: {number}
---
```

### 8. Clean Up
1. Send shutdown requests to all teammates
2. Use **TeamDelete** to remove the team
3. Report results and new graph state to the user

## Teammate Summary Format
Same as `/otterwise:research` — each teammate writes `summary.md`:

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
[1-3 directions for future exploration]
```

## Important Rules
- You ARE the team lead — never delegate team creation to a sub-agent
- Never duplicate analysis from previous reports
- Reference parent findings in teammate prompts so they build on prior work
- ID format: YYYYMMDD_HHMMSS_XXXX where XXXX is a 4-character hex hash

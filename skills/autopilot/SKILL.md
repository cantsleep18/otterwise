---
name: autopilot
description: Run autonomous multi-round research on a dataset
---

# /otterwise:autopilot

Run a fully autonomous multi-round research session. You (the main Claude session) ARE the research lead for EVERY round — do NOT delegate to a sub-agent. Between rounds, you evaluate stopping conditions and use the decision engine to select the next research direction.

## Usage

The user should provide:
- Path to a dataset file (CSV, Excel, Parquet, etc.) or directory
- Research goals or questions (optional — will do general profiling if none given)
- Optional config overrides (max rounds, team size, stopping criteria, scope constraints)

---

## Workflow

### 0. Resume Check

Before starting a new session, check for an existing interrupted session:
1. If `.otterwise/autopilot.json` exists and `completedAt` is `null`:
   - Read the `rounds` array to find the last completed round
   - If the last round has `status: "in-progress"`, treat it as failed — start a new round from that point
   - Read `.otterwise/autopilot-state.json`:
     - If `command === "pause"`: session was paused — set command to `"running"` and resume from Step 3 (Loop Control)
     - If `command === "abort"`: session was aborted — jump to Step 6 (Final Synthesis) with `stoppingReason: "user-abort"`
     - If `command === "running"`: session was interrupted mid-execution — resume from Step 3
   - Report to user: "Resuming autopilot session from round N"
2. If no `.otterwise/autopilot.json` exists, or `completedAt` is set, proceed to Step 1 (Setup)

---

### 1. Setup Phase

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
4. Create `.otterwise/autopilot.json` with defaults (merge any user overrides):
   ```json
   {
     "maxIterations": 5,
     "maxConcurrentTeammates": 3,
     "stoppingThreshold": 0.85,
     "researchTimeoutMinutes": 30,
     "explorationStrategy": "balanced",
     "seedPhrase": "autopilot-{YYYYMMDD-HHMMSS}",
     "customStoppingCriteria": [],
     "stopping": {
       "minFindingsPerRound": 2,
       "maxDeadEndRatio": 0.6
     },
     "scope": {
       "focusAreas": null,
       "excludeTopics": null,
       "depthLimit": 4
     },
     "notifications": {
       "progressUpdates": "per-round"
     },
     "createdAt": "<ISO-timestamp>",
     "completedAt": null,
     "stoppingReason": null,
     "totalRounds": 0,
     "totalFindings": 0,
     "rounds": []
   }
   ```
5. Create `.otterwise/autopilot-state.json` for runtime control:
   ```json
   {
     "command": "running",
     "updatedAt": "<ISO-timestamp>",
     "reason": null
   }
   ```

---

### 2. Round 1 — Initial Research

Execute the full `/research` workflow inline. Do NOT call `/research` as a skill.

#### 2a. Explore the Dataset
- Read the dataset (or sample files if it's a directory) to understand its structure
- Identify key fields, types, and patterns
- Note data size, format, and any quirks

#### 2b. Understand Research History
- Use Glob to find all `.otterwise/**/report.md` files
- Read each report.md — parse the YAML frontmatter:
  - `id`: unique node identifier (YYYYMMDD_HHMMSS_XXXX)
  - `parent`: parent node ID (null for root)
  - `related`: sibling/related node IDs
  - `status`: completed, in-progress, dead-end
  - `findings_count`: number of key findings
- Read the full content of each report to understand what was discovered
- Build a mental model of the research DAG

For the FIRST research session (no previous reports):
- Start with basic profiling, distribution analysis, and key variable relationships

#### 2c. Design Objectives
Create 3-5 sets of objective bullet points, one per teammate. Each set should:
- Be specific and actionable
- Reference specific columns/features/files when possible
- Include expected output format
- Be independent enough for parallel execution

Limit teammate count to `maxConcurrentTeammates` from autopilot.json.

#### 2d. Create Agent Team and Spawn Researchers

IMPORTANT: You are the team lead. Create the team and spawn teammates DIRECTLY.

##### Create the team
Use **TeamCreate** with a descriptive name:
```
team_name: "autopilot-{YYYYMMDD-HHMMSS}-round-1-{short-topic}"
```

##### Create output directories
```bash
mkdir -p .otterwise/{session-id}/{teammate-1,teammate-2,...}
```

##### Create tasks for tracking
Use **TaskCreate** to create one task per teammate. Each task should:
- Have a descriptive subject summarizing the teammate's objectives
- Include the full objective bullet points in the description

##### Spawn ALL teammates in a SINGLE message
You MUST spawn all teammates in ONE message using multiple parallel **Agent** tool calls. This ensures they run concurrently.

For each teammate, use the Agent tool with these exact parameters:
- `subagent_type`: `"general-purpose"` (NOT "Explore" — teammates need Write + MCP tools)
- `team_name`: the team name from above
- `name`: `"researcher-N"` (e.g., `researcher-1`, `researcher-2`, etc.)
- `mode`: `"bypassPermissions"`
- `run_in_background`: `true`

Each teammate's `prompt` MUST include ALL of the following:
1. **Objectives**: Their assigned objective bullet points from step 2c
2. **Dataset path**: The full absolute path to the dataset
3. **Task ID**: Their task ID, with instruction to mark it completed via TaskUpdate
4. **Team name**: The actual team name so they can use SendMessage
5. **Teammate list**: Names of all teammates for cross-communication
6. **MCP tool usage**: Instructions to use the Python REPL MCP server:
   - `mcp__python-repl__python_repl` with `action: "start_notebook"` to initialize
   - `action: "execute"` for cell-by-cell analysis
   - `action: "get_state"` to check variable state
   - `action: "install_package"` if additional packages needed
   - OR use `Bash(python3 -c "...")` for simpler analysis
7. **Output directory**: Full path to their output folder (`.otterwise/{session-id}/teammate-N/`)
8. **Summary format**: Write `summary.md` using the Teammate Summary Format below
9. **Instruction to send findings to team-lead via SendMessage when done**

#### 2e. Monitor Progress
Poll **TaskList** periodically until ALL teammate tasks show status `completed`.
- If a task is stuck, send a message to the teammate via SendMessage
- If a teammate reports issues, provide guidance

#### 2f. Collect and Synthesize Results
After all teammates complete:
- Read each teammate's `summary.md` from their output directory
- Synthesize findings across all teammates
- Identify agreements, conflicts, and gaps

#### 2g. Write Round 1 Report
Create `report.md` in the session folder with YAML frontmatter:

```yaml
---
id: "{YYYYMMDD_HHMMSS}_{4-char-hex-hash}"
name: "{descriptive-kebab-case-name}"
parent: null
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

#### 2h. Record Round Metadata
Update `.otterwise/autopilot.json` — append to the `rounds` array:
```json
{
  "number": 1,
  "reportId": "<report-id>",
  "parentId": null,
  "status": "completed",
  "teamName": "<team-name>",
  "findingsCount": "<count>",
  "decisionScore": null,
  "stoppingReason": null,
  "startedAt": "<ISO-timestamp>",
  "completedAt": "<ISO-timestamp>"
}
```
Update `totalRounds` and `totalFindings` counters.

#### 2i. Clean Up Round 1 Team
1. Send shutdown requests to all teammates via SendMessage
2. Wait for shutdown confirmations
3. Use **TeamDelete** to remove the team

---

### 3. Loop Control — Between Rounds

After each round completes, before starting the next:

#### 3a. Check for Pause/Abort Signals
Read `.otterwise/autopilot-state.json`:
- If `command === "abort"`: Jump to Step 6 (Final Synthesis) with `stoppingReason: "user-abort"`
- If `command === "pause"`: Log "Paused by user", then poll the file every 10 seconds:
  - If command changes to `"resume"`: Write `command: "running"`, proceed with next round
  - If command changes to `"abort"`: Jump to Step 6 with `stoppingReason: "user-abort"`
- If `command === "running"` or file is missing/unreadable: Proceed normally (safe default)

Update `autopilot-state.json` with `command: "running"` after clearing any resume signal.

#### 3b. Evaluate Stopping Conditions

Check ALL stopping criteria. If ANY is TRUE, jump to Step 6 (Final Synthesis):

1. **Max iterations reached**: `rounds.length >= maxIterations`
2. **Depth limit reached**: Research DAG depth >= `scope.depthLimit`
3. **Diminishing returns**: Last 2 consecutive rounds each have < `stopping.minFindingsPerRound` findings
4. **Dead end ratio exceeded**: Ratio of dead-end reports to total reports > `stopping.maxDeadEndRatio`
5. **Goals satisfied**: All user-provided goals from config.json have been addressed with high-confidence findings
6. **No viable candidates**: Decision engine finds no expansion candidates scoring above 0.3
7. **Confidence threshold**: Average confidence across all findings >= `stoppingThreshold`
8. **No new questions**: Last round's report has 0 items in "Open Questions" section
9. **Repeated findings**: > 60% of last round's findings duplicate findings from earlier rounds
10. **Scope exhaustion**: All `scope.focusAreas` (if specified) have been covered with at least one deep-dive
11. **Time budget exceeded**: Total elapsed time since `createdAt` exceeds `researchTimeoutMinutes * maxIterations`
12. **Custom criteria**: Evaluate each entry in `customStoppingCriteria` — if any user-defined condition is met, stop with `stoppingReason: "custom"`

Log the stopping evaluation result (which criteria passed/failed) in the round metadata.

If ALL stopping conditions are FALSE, proceed to Step 4 (Decision Engine).

---

### 4. Decision Engine — Select Next Direction

#### 4a. Parse the Research DAG
- Use Glob to find all `.otterwise/**/report.md` files
- Read each report's frontmatter and full content
- Build a complete map of the research graph

#### 4b. Identify Expansion Candidates
From all completed reports, extract:
- **Open Questions** sections — each question is a candidate
- **Suggested Follow-ups** from teammate summaries — each is a candidate
- **Dead end recovery** — adjacent topics near dead-end nodes
- **Cross-references** — opportunities to combine insights from different branches
- **Gap filling** — aspects of data mentioned but never analyzed

#### 4c. Score Each Candidate (5-Factor Weighted Scoring)

Score each candidate on a 0-1 scale using these factors and weights:

| Factor | Weight | How to Score |
|--------|--------|-------------|
| **Follow-up richness** | 0.35 | Count the number of suggested follow-ups in the parent report's summaries that point toward this candidate. More references = higher score. Normalize: 0 refs = 0.0, 3+ refs = 1.0 |
| **Confidence signal** | 0.25 | Average confidence level of the parent findings that motivate this candidate. High = 1.0, Medium = 0.6, Low = 0.3 |
| **Novelty** | 0.20 | How different is this from existing analysis? Score 1.0 if no prior report covers this topic, 0.5 if partially covered, 0.0 if fully covered |
| **Depth balance** | 0.15 | Penalize rabbit holes. Score based on inverse of current branch depth: depth 1 = 1.0, depth 2 = 0.75, depth 3 = 0.5, depth 4+ = 0.25 |
| **Open questions** | 0.05 | Specificity of the questions driving this candidate. Specific, testable questions = 1.0; vague/broad questions = 0.3 |

**Final score** = (follow_up_richness * 0.35) + (confidence_signal * 0.25) + (novelty * 0.20) + (depth_balance * 0.15) + (open_questions * 0.05)

#### 4d. Select Direction
- Choose the highest-scoring candidate
- If there is a tie: prefer deeper exploration over broader (follow the branch with more existing context)
- Set `parentReportId` to the source report's ID
- Record the score and factor breakdown in round metadata

If the `explorationStrategy` in autopilot.json is:
- `"balanced"` (default): Use the scoring as-is
- `"breadth-first"`: Boost novelty weight to 0.35, reduce follow-up richness to 0.20
- `"depth-first"`: Boost follow-up richness to 0.45, reduce novelty to 0.10

---

### 5. Round N — Continue Research

Execute the full `/continue` workflow inline. Do NOT call `/continue` as a skill.

#### 5a. Design Objectives for This Round
Create 3-5 sets of objective bullet points, one per teammate. Each set should:
- Build on previous findings (reference specific report IDs)
- Be specific and actionable
- Target the direction chosen by the decision engine
- Be independent enough for parallel execution

Limit teammate count to `maxConcurrentTeammates` from autopilot.json.

#### 5b. Create Team and Spawn Researchers
Same spawning pattern as Round 1 (Step 2d), but with:
- New team name: `"autopilot-{YYYYMMDD-HHMMSS}-round-{N}-{topic}"`
- Objectives tailored to the decision engine's choice
- **Previous findings context**: Include key context from parent report in teammate prompts so they don't re-do work

#### 5c. Monitor, Collect, Synthesize
Same as Steps 2e-2f.

#### 5d. Write Round Report
Create `report.md` with YAML frontmatter — set `parent` to the parent node ID from the decision engine:

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

#### 5e. Record Round Metadata
Update `.otterwise/autopilot.json` — append to the `rounds` array:
```json
{
  "number": "N",
  "reportId": "<report-id>",
  "parentId": "<parent-report-id>",
  "status": "completed",
  "teamName": "<team-name>",
  "findingsCount": "<count>",
  "decisionScore": "<score-from-decision-engine>",
  "stoppingReason": null,
  "startedAt": "<ISO-timestamp>",
  "completedAt": "<ISO-timestamp>"
}
```
Update `totalRounds` and `totalFindings` counters.

#### 5f. Clean Up Round Team
1. Send shutdown requests to all teammates via SendMessage
2. Wait for shutdown confirmations
3. Use **TeamDelete** to remove the team

#### 5g. Return to Loop Control
Go back to Step 3 (Loop Control) to evaluate stopping conditions before the next round.

---

### 6. Final Synthesis

After the loop ends (any stopping condition triggered or abort/pause):

#### 6a. Collect All Reports
Use Glob to find all `.otterwise/**/report.md` files across all rounds.

#### 6b. Build Final DAG
Parse all reports to understand the complete research graph — parent-child relationships, findings, dead ends.

#### 6c. Synthesize Findings
- Identify the strongest, most-validated findings across all rounds
- Note conflicts and how they were resolved
- Highlight areas of high confidence vs. areas needing follow-up
- Connect findings across branches to reveal cross-cutting insights

#### 6d. Write autopilot-report.md

Create `.otterwise/autopilot-report.md`:

```markdown
---
sessionId: "{YYYYMMDD_HHMMSS}"
totalRounds: {N}
totalFindings: {count}
stoppingReason: "{max-iterations|diminishing-returns|goals-met|confidence-threshold|dead-end-saturation|no-new-questions|time-budget|custom|user-abort}"
executedAt: "{ISO-timestamp}"
---

# Autopilot Research Report

## Executive Summary
[2-3 paragraphs synthesizing the overall research journey and key insights]

## Research Journey

### Round 1: [Name]
- Report ID: [id]
- Parent: none (initial)
- Findings: [count]
- Key discoveries: [bullet points]

### Round 2: [Name]
- Report ID: [id]
- Parent: [parent-id]
- Decision score: [score]
- Findings: [count]
- Key discoveries: [bullet points]

[... more rounds ...]

## Consolidated Key Findings

### Finding Group 1: [Category]
[Description with evidence and cross-references to report IDs]

### Finding Group 2: [Category]
[Description with evidence and cross-references to report IDs]

[... more findings ...]

## Confidence Assessment
- High confidence: [findings that appear in multiple rounds/branches]
- Medium confidence: [findings supported by solid analysis but limited corroboration]
- Low confidence: [findings that warrant follow-up or deeper analysis]

## Dead Ends
[Approaches that didn't yield insights, with brief explanations]

## Open Questions & Recommended Follow-ups
[Top 3-5 questions for future sessions or manual exploration]

## Research Graph Visualization

[ASCII tree showing parent-child relationships:]
```
├── Round 1: basic-profiling (5 findings)
│   ├── Round 2: correlation-deep-dive (4 findings)
│   │   └── Round 3: time-series-analysis (2 findings)
│   └── Round 4: distribution-analysis (3 findings)
└── (end)
```

## Statistics
- Total research rounds: [N]
- Total findings discovered: [count]
- Average findings per round: [avg]
- Stopping reason: [reason]
- Final research graph depth: [max-depth]
```

---

### 7. Cleanup Phase

1. Update `.otterwise/autopilot.json` final status:
   ```json
   {
     "completedAt": "<ISO-timestamp>",
     "stoppingReason": "{reason}",
     "totalRounds": "<N>",
     "totalFindings": "<X>"
   }
   ```

2. Update `.otterwise/autopilot-state.json`:
   ```json
   {
     "command": "completed",
     "updatedAt": "<ISO-timestamp>",
     "reason": "<stoppingReason>"
   }
   ```

3. Report results to the user:
   - Path to `autopilot-report.md`
   - Total rounds executed
   - Total findings discovered
   - Why the loop stopped
   - Suggestion to use `/otterwise:continue` for manual follow-up or `/otterwise:status` to explore the graph

---

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
[High / Medium / Low] — [justification]

## Dead Ends
[What didn't work]

## Suggested Follow-ups
[1-3 directions for future exploration]
```

---

## Important Rules

- **You ARE the team lead**: Never delegate team creation, decision engine, or stopping evaluation to a sub-agent
- **No skill chaining**: Autopilot MUST NOT call `/research` or `/continue` — inline their logic directly
- **Loop control is critical**: Stopping conditions AND pause/abort signals must be checked before EVERY round
- **Decision engine scoring is transparent**: Log factor scores and final score so the user can understand why a direction was chosen
- **Never duplicate analysis**: Always check previous reports before designing new objectives
- **ID format**: `YYYYMMDD_HHMMSS_XXXX` where XXXX is a 4-character hex hash
- **Configuration immutability**: Once `.otterwise/autopilot.json` is created, only update `rounds`, `totalRounds`, `totalFindings`, `completedAt`, and `stoppingReason` — never overwrite the config fields
- **Immutable-append for rounds**: The `rounds` array is only appended to, never overwritten
- **Team cleanup is mandatory**: Always send shutdown requests and delete teams after each round
- **State file is the control plane**: Other skills (`/autopilot-pause`, `/autopilot-abort`) communicate with autopilot by writing to `autopilot-state.json`
- **All prompts and analysis in English**
- **Recommended team size**: Use `maxConcurrentTeammates` from config (default 3)

---

## Error Handling

- **Team creation fails**: Retry once. If still fails, abort with clear error to user
- **Round times out**: Mark round as `"timeout"` in autopilot.json, proceed to stopping condition evaluation
- **Teammate failure**: If > 50% of teammates succeeded, continue synthesis with available results. If <= 50%, note in round metadata and mark round as partial
- **Dataset becomes unavailable**: Stop immediately with `stoppingReason: "error-dataset-unavailable"`
- **Decision engine finds no candidates**: Stop with `stoppingReason: "no-viable-candidates"`
- **Decision engine tie**: Prefer deeper exploration over broader (follow the branch with more existing context)
- **State file missing/corrupted**: Treat as `command: "running"` (safe default); recreate from autopilot.json round history
- **MCP server crash**: Note in round metadata, continue — auto-respawn handles recovery

---

## Configuration Reference

### `.otterwise/autopilot.json` — Session Configuration & State

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxIterations` | integer | `5` | Maximum research rounds before auto-stop |
| `maxConcurrentTeammates` | integer | `3` | Maximum researchers per round |
| `stoppingThreshold` | float | `0.85` | Confidence threshold (0-1) for completeness |
| `researchTimeoutMinutes` | integer | `30` | Max minutes per round |
| `explorationStrategy` | string | `"balanced"` | Scoring strategy: `"balanced"`, `"breadth-first"`, `"depth-first"` |
| `seedPhrase` | string | auto | Unique session identifier |
| `customStoppingCriteria` | string[] | `[]` | User-defined stopping conditions (free text, evaluated by LLM) |
| `stopping.minFindingsPerRound` | integer | `2` | Minimum findings to avoid diminishing-returns stop |
| `stopping.maxDeadEndRatio` | float | `0.6` | Maximum ratio of dead-end branches |
| `scope.focusAreas` | string[] \| null | `null` | Restrict research to these topics |
| `scope.excludeTopics` | string[] \| null | `null` | Exclude these topics from research |
| `scope.depthLimit` | integer | `4` | Maximum DAG depth before stopping |
| `rounds` | Round[] | `[]` | Array of round metadata (append-only) |

### `stoppingReason` enum

- `"max-iterations"` — reached `maxIterations`
- `"diminishing-returns"` — findings dropping below useful threshold
- `"goals-met"` — original research goals satisfied
- `"confidence-threshold"` — average confidence >= `stoppingThreshold`
- `"dead-end-saturation"` — dead-end ratio exceeded threshold
- `"no-new-questions"` — last report has no open questions
- `"no-viable-candidates"` — decision engine found nothing worth exploring
- `"time-budget"` — total elapsed time exceeded budget
- `"custom"` — user-defined criterion triggered
- `"user-abort"` — user ran `/otterwise:autopilot-abort`

### `.otterwise/autopilot-state.json` — Real-time Control Signal

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Control state: `"running"`, `"pause"`, `"resume"`, `"abort"` |
| `updatedAt` | ISO 8601 | When this state was last changed |
| `reason` | string \| null | Optional reason for the command |

The autopilot skill creates this file with `command: "running"` at session start. Between each round, it reads this file. The `/autopilot-pause` and `/autopilot-abort` skills write to this file from a separate Claude session.

---

## Example Session Flow

```
User: /otterwise:autopilot /data/sales.csv "Find revenue drivers and seasonal patterns"

1. Setup: Create .otterwise/, config.json, autopilot.json, autopilot-state.json
2. Round 1: Basic profiling & initial analysis
   └─ Team: autopilot-20260323-143015-round-1-initial
   └─ 3 researchers explore structure, distributions, correlations
   └─ Report ID: 20260323_143015_a1b2 (5 findings)
3. Check state: command=running → evaluate stopping: not met → run decision engine
4. Decision engine scores:
   └─ "seasonal-decomposition" → 0.82 (high follow-up richness + novelty)
   └─ "customer-segmentation" → 0.71
   └─ "price-elasticity" → 0.65
   └─ Selected: seasonal-decomposition
5. Round 2: Seasonal pattern deep-dive
   └─ Team: autopilot-20260323-144015-round-2-seasonal
   └─ Report ID: 20260323_144015_c3d4 (4 findings, parent: a1b2)
6. Check state: command=running → evaluate stopping: not met → decision engine
7. Decision engine: "revenue-driver-regression" → 0.74
8. Round 3: Revenue driver analysis
   └─ Report ID: 20260323_145015_e5f6 (2 findings, parent: c3d4)
9. Check state → evaluate stopping: diminishing returns (2 findings in last 2 rounds) → STOP
10. Final synthesis: Create autopilot-report.md
    └─ 3 rounds, 11 total findings
    └─ Stopping reason: "diminishing-returns"
11. Report to user with path to autopilot-report.md
```

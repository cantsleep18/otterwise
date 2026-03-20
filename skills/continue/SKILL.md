---
name: continue
description: Continue and expand an existing Otterwise exploration
---

# /otterwise:continue

Expand the exploration graph with a new exploration session.

## Usage

The user can optionally specify:
- A focus direction (e.g., "dig into customer segments")
- A specific open question to pursue from a previous synthesis
- A specific exploration to branch from (by name or ID)

If nothing is specified, the research-lead reads all previous syntheses and decides the most promising direction automatically.

## Workflow

### Step 1: Verify existing exploration state

Check that `.otterwise/` exists and contains at least one completed exploration:

```bash
ls .otterwise/exploration-*/synthesis.md 2>/dev/null
```

If no completed explorations exist, tell the user to run `/otterwise:research` first.

### Step 2: Read configuration

Read `.otterwise/config.json` for the dataset path and research goals.

### Step 3: Load previous syntheses

Read ALL `synthesis.md` files from previous explorations:

```
.otterwise/exploration-{NNN}_{hash}_{name}/synthesis.md
```

Parse YAML frontmatter from each to understand the graph:
- `id`: exploration identifier
- `parent`: parent exploration ID (null for root)
- `status`: completed, in-progress
- `findings_count` and `threads_count`: scope of each exploration
- `agents`: which agents contributed

Read the full content of each synthesis, paying attention to:
- **Open Questions** -- candidates for the next exploration
- **Standalone Findings** -- findings not yet connected to threads
- **Key Threads** -- connected finding chains that could be extended

### Step 4: Load cross-exploration context

Read existing findings and threads across all explorations:
- `findings/finding-{agent}-{seq}.md` files for tags and content
- `threads.json` for existing connections between findings

This context lets the research-lead identify cross-exploration thread opportunities.

### Step 5: Determine next exploration number

Find the highest existing exploration number and increment:

```bash
ls -d .otterwise/exploration-* 2>/dev/null | sort -t- -k2 -n | tail -1
```

The new exploration gets ID `exploration-{NNN+1}_{hash}_{name}`.

### Step 6: Create new exploration folder

Create the exploration directory structure:

```
.otterwise/exploration-{NNN}_{hash}_{name}/
├── findings/
├── threads.json
└── synthesis.md          (written at the end)
```

Set the `parent` field in the eventual synthesis.md frontmatter to the exploration being branched from (or the most recent exploration if none specified).

### Step 7: Invoke research-lead

Invoke the `research-lead` agent with context:
- Dataset path from config.json
- All previous synthesis content (for graph awareness)
- All previous findings and threads (for cross-exploration threading)
- User's focus direction or open question (if provided)
- The new exploration ID and parent link

The research-lead will:
1. Decide specific exploration direction based on previous open questions and user input
2. Spawn explorer agents (alpha, beta, gamma, etc.) with suggested directions
3. Agents loop: analyze, write findings, read others' findings, analyze more
4. Research-lead discovers threads between findings (including cross-exploration threads)
5. Send cross-pollination messages between agents
6. Monitor for saturation and send stop signals
7. Write synthesis.md with key threads, standalone findings, and new open questions

### Step 8: Cross-exploration threads

After synthesis, new findings may connect to findings from previous explorations. These cross-exploration threads are recorded in `threads.json` with the `cross_exploration` field set to the source exploration ID:

```json
{
  "id": "thread-005",
  "from": "finding-alpha-002",
  "to": "finding-beta-003",
  "cross_exploration": "exploration-001_a3f2",
  "relation": "extends the correlation pattern",
  "strength": 0.85
}
```

### Step 9: Report results

Display to the user:
- New exploration name and ID
- Parent exploration link
- Number of findings and threads discovered
- Key threads (1-2 sentence summary each)
- Cross-exploration threads found (highlight these -- they connect the graph)
- New open questions for future exploration
- Updated graph state (tree view of all explorations)

```
Exploration Graph:
├── exploration-001_a3f2_basic-profiling (5 findings, 3 threads)
│   ├── exploration-002_b1c4_correlation-deep-dive (4 findings, 5 threads)
│   │   └── exploration-004_d8e1_time-series (NEW - 6 findings, 4 threads)
│   └── exploration-003_c7d9_distribution-analysis (3 findings, 2 threads)
└── (open questions available for next exploration)
```

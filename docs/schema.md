# Exploration Board Data Schema Reference

This document defines all data formats used by the Otterwise Exploration Board methodology. All agents producing or consuming exploration data **must** conform to these schemas.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Naming Conventions](#naming-conventions)
3. [config.json](#configjson)
4. [Finding Format](#finding-format)
5. [threads.json](#threadsjson)
6. [synthesis.md](#synthesismd)

---

## Directory Structure

Each exploration lives inside `.otterwise/` at the project root. An exploration is a self-contained unit of multi-agent analysis on a dataset.

```
.otterwise/
  config.json                                  # Dataset path, goals, created timestamp
  exploration-001_a3f1_initial-profiling/      # First exploration
    findings/                                  # All finding files for this exploration
      finding-alpha-001.md                     # Agent alpha's first finding
      finding-alpha-002.md                     # Agent alpha's second finding
      finding-beta-001.md                      # Agent beta's first finding
      finding-gamma-001.md                     # Agent gamma's first finding
    alpha/                                     # Agent alpha's notebook workspace
      notebook.ipynb                           # Agent alpha's Jupyter notebook
    beta/                                      # Agent beta's notebook workspace
      notebook.ipynb
    gamma/                                     # Agent gamma's notebook workspace
      notebook.ipynb
    threads.json                               # Connections between findings
    synthesis.md                               # Exploration summary and open questions
  exploration-002_b7e2_correlation-deep-dive/  # Second exploration
    findings/
      finding-alpha-001.md
      finding-beta-001.md
      finding-beta-002.md
    alpha/
      notebook.ipynb
    beta/
      notebook.ipynb
    threads.json
    synthesis.md
  exploration-003_c9d4_seasonal-patterns/      # Third exploration
    ...
```

### Rules

- The `.otterwise/` directory is always at the project root.
- `config.json` at the `.otterwise/` root is the global configuration.
- Each exploration gets its own subdirectory directly under `.otterwise/`.
- All finding files live in the `findings/` subdirectory within the exploration.
- Each agent gets a named subdirectory (e.g., `alpha/`, `beta/`) containing its `notebook.ipynb`.
- `threads.json` and `synthesis.md` live at the exploration directory root.

---

## Naming Conventions

### Exploration Directories

**Pattern:** `exploration-{NNN}_{4hex}_{kebab-name}`

| Component | Format | Description |
|-----------|--------|-------------|
| `NNN` | Zero-padded 3-digit integer | Sequential exploration number, starting at `001` |
| `4hex` | 4 lowercase hex characters | Random hash for uniqueness (e.g., `a3f1`, `b7e2`) |
| `kebab-name` | Lowercase kebab-case | Short descriptive name for the exploration |

**Examples:**
- `exploration-001_a3f1_initial-profiling`
- `exploration-002_b7e2_correlation-deep-dive`
- `exploration-015_d4c8_churn-segmentation`

**Constraints:**
- The kebab-name must be 2-5 words, lowercase, hyphen-separated.
- The NNN counter increments globally across all explorations in a session.
- The 4hex hash is generated randomly at creation time (not derived from content).

### Finding Files

**Pattern:** `finding-{agent}-{seq}.md`

| Component | Format | Description |
|-----------|--------|-------------|
| `agent` | Greek letter name | The agent that produced this finding |
| `seq` | Zero-padded 3-digit integer | Sequential finding number per agent per exploration |

**Agent names (in order of assignment):**

| Order | Name |
|-------|------|
| 1st | `alpha` |
| 2nd | `beta` |
| 3rd | `gamma` |
| 4th | `delta` |
| 5th | `epsilon` |

**Examples:**
- `finding-alpha-001.md`
- `finding-alpha-002.md`
- `finding-beta-001.md`
- `finding-gamma-003.md`

**Constraints:**
- Sequence numbers are per-agent within a single exploration (each agent starts at `001`).
- An agent may produce multiple findings in one exploration.
- Agent names beyond epsilon are not expected; if needed, continue with `zeta`, `eta`, `theta`, `iota`, `kappa`.

### Thread IDs

**Pattern:** `thread-{seq}`

| Component | Format | Description |
|-----------|--------|-------------|
| `seq` | Zero-padded 3-digit integer | Sequential thread number within an exploration |

**Examples:**
- `thread-001`
- `thread-012`

**Constraints:**
- Thread IDs are unique within a single exploration's `threads.json`.
- Cross-exploration threads still use the local sequence number but set `cross_exploration` to the referenced exploration's ID.

---

## config.json

The global configuration file at `.otterwise/config.json`. Created by `/otterwise:research` at the start of a session.

### Schema

```json
{
  "dataset": "<string>",
  "goals": ["<string>"],
  "created": "<string>"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dataset` | `string` | Yes | Absolute path to the dataset file (CSV, Excel, Parquet, etc.) |
| `goals` | `string[]` | Yes | Array of research goals or questions. If the user provides none, use `["General exploratory profiling"]` |
| `created` | `string` | Yes | ISO 8601 timestamp of session creation (e.g., `"2026-03-20T10:00:00Z"`) |

### Example

```json
{
  "dataset": "/home/user/projects/ecommerce/sales_data.csv",
  "goals": [
    "Identify key drivers of customer churn",
    "Find seasonal purchasing patterns",
    "Segment customers by behavior"
  ],
  "created": "2026-03-20T10:00:00Z"
}
```

---

## Finding Format

Each finding is a Markdown file with YAML frontmatter. A finding represents a single discrete discovery made by one agent during an exploration.

### File: `findings/finding-{agent}-{seq}.md`

### YAML Frontmatter

```yaml
---
id: "finding-{agent}-{seq}"
exploration: "exploration-{NNN}_{hash}"
agent: "{agent-name}"
confidence: 0.0-1.0
tags: ["tag1", "tag2"]
timestamp: "ISO-8601"
notebook_cell: {number}
---
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique finding ID, matches the filename without extension (e.g., `finding-alpha-001`) |
| `exploration` | `string` | Yes | Parent exploration directory name (e.g., `exploration-001_a3f1_initial-profiling`) |
| `agent` | `string` | Yes | Agent name that produced this finding (`alpha`, `beta`, `gamma`, `delta`, or `epsilon`) |
| `confidence` | `number` | Yes | Confidence score from `0.0` to `1.0`. Guidelines: `0.9-1.0` = strong statistical evidence; `0.7-0.89` = solid evidence with minor caveats; `0.5-0.69` = moderate evidence, needs validation; `0.3-0.49` = weak or indirect evidence; `0.0-0.29` = speculative or preliminary |
| `tags` | `string[]` | Yes | Descriptive tags for categorization (e.g., `["correlation", "revenue", "seasonality"]`). Minimum 1 tag, maximum 8 |
| `timestamp` | `string` | Yes | ISO 8601 timestamp of when the finding was written (e.g., `"2026-03-20T10:15:30Z"`) |
| `notebook_cell` | `integer` or `null` | Yes | Cell number in the agent's `notebook.ipynb` that produced the evidence, or `null` if no notebook cell is referenced |

### Body Structure

The Markdown body below the frontmatter uses `##` for the finding title and `###` for sections:

```markdown
## {Finding title}

### Evidence

What was observed. Include specific numbers, statistical measures, or
data points. Reference notebook cells where applicable (e.g., "See cell 5").
This section should be factual and verifiable.

### Implication

What this finding means in the context of the research goals. Interpret
the evidence — why does it matter? What does it suggest about the dataset
or the domain?

### Possible Threads

Connections this finding might have to other findings or directions for
further investigation. Each item should be a bullet point suggesting a
potential thread.

- Could relate to [other finding or topic] because [reason]
- Worth investigating whether [hypothesis]
- Contradicts / supports [other finding or assumption]
```

### Complete Example

```markdown
---
id: finding-alpha-001
exploration: exploration-001_a3f1_initial-profiling
agent: alpha
confidence: 0.92
tags: ["missing-data", "data-quality", "revenue"]
timestamp: "2026-03-20T10:15:30Z"
notebook_cell: 3
---

## Revenue column has 12% missing values concentrated in Q4

### Evidence

The `revenue` column contains 1,247 missing values out of 10,392 total rows
(12.0%). Of these, 891 (71.5%) fall within October-December entries.
The overall dataset missing rate is 3.2%, making the revenue column a
significant outlier. See cell 3 for the missing-value heatmap.

### Implication

The Q4 concentration suggests a systematic data collection issue rather than
random missingness — possibly a reporting system change or holiday-period
process gap. Any revenue analysis must account for this bias; Q4 aggregates
will be understated if NaN rows are simply dropped.

### Possible Threads

- Could relate to seasonal pattern findings — Q4 missingness may mask true seasonal revenue peaks
- Worth investigating whether other financial columns (cost, margin) share the same Q4 gap
- Supports the hypothesis that the 2024 system migration introduced data quality issues
```

---

## threads.json

Each exploration contains a `threads.json` file that captures connections between findings. Threads represent relationships, contradictions, reinforcements, or causal hypotheses linking two findings.

### File: `threads.json` (in exploration directory root)

### Schema

The file is a JSON object with a `threads` array:

```json
{
  "threads": [
    {
      "id": "thread-001",
      "from": "finding-alpha-001",
      "to": "finding-beta-002",
      "relation": "description of connection",
      "strength": 0.0-1.0,
      "discovered_by": "head|agent-name",
      "evidence": "notebook cell reference or explanation",
      "cross_exploration": "exploration-id or null"
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique thread ID within this exploration (e.g., `thread-001`) |
| `from` | `string` | Yes | Finding ID of the source (e.g., `finding-alpha-001`). For cross-exploration threads, prefix with the exploration name: `exploration-001_a3f1_initial-profiling/finding-alpha-002` |
| `to` | `string` | Yes | Finding ID of the target. Same prefixing rules as `from` |
| `relation` | `string` | Yes | Description of the connection type. Use one of the standard relation types below, or a free-text description if none fits exactly |
| `strength` | `number` | Yes | Connection strength from `0.0` to `1.0`. Guidelines: `0.8-1.0` = strong, clear statistical or logical connection; `0.5-0.79` = moderate, plausible with indirect evidence; `0.3-0.49` = weak, tentative connection; `0.0-0.29` = speculative, hypothesized but not yet evidenced |
| `discovered_by` | `string` | Yes | Who identified this thread: `"head"` for the research lead during synthesis, or an agent name (`alpha`, `beta`, `gamma`, `delta`, `epsilon`) |
| `evidence` | `string` | Yes | Brief explanation of why this thread exists — what connects the two findings. Reference notebook cells where applicable (1-3 sentences) |
| `cross_exploration` | `string` or `null` | Yes | The exploration ID if the thread connects findings from different explorations (e.g., `"exploration-001_a3f1_initial-profiling"`), or `null` if both findings are in the same exploration |

### Relation Types

| Relation | Meaning |
|----------|---------|
| `supports` | Finding A provides additional evidence for Finding B |
| `contradicts` | Finding A conflicts with or undermines Finding B |
| `extends` | Finding A builds on or deepens Finding B |
| `causes` | Finding A suggests a causal mechanism for Finding B |
| `caused-by` | Finding A is explained by Finding B (inverse of `causes`) |
| `correlates` | Findings A and B show statistical or thematic correlation without clear causation |
| `qualifies` | Finding A adds a caveat, boundary condition, or exception to Finding B |

### Strength Scale

| Range | Label | Meaning |
|-------|-------|---------|
| `0.8 - 1.0` | Strong | Clear statistical or logical connection with direct evidence |
| `0.5 - 0.79` | Moderate | Plausible connection supported by indirect evidence |
| `0.3 - 0.49` | Weak | Tentative connection based on limited evidence |
| `0.0 - 0.29` | Speculative | Hypothesized connection worth investigating but not yet evidenced |

### Example

```json
{
  "threads": [
    {
      "id": "thread-001",
      "from": "finding-alpha-001",
      "to": "finding-beta-002",
      "relation": "supports",
      "strength": 0.91,
      "discovered_by": "head",
      "evidence": "Alpha's Q4 missing-data concentration aligns with Beta's finding that Q4 revenue aggregates are 23% lower than expected — the missingness directly explains the apparent revenue dip.",
      "cross_exploration": null
    },
    {
      "id": "thread-002",
      "from": "finding-gamma-001",
      "to": "finding-alpha-001",
      "relation": "qualifies",
      "strength": 0.65,
      "discovered_by": "gamma",
      "evidence": "Gamma found that 30% of the Q4 missing revenue rows have valid cost entries, suggesting the missingness is specific to the revenue reporting pipeline, not a general Q4 data outage.",
      "cross_exploration": null
    },
    {
      "id": "thread-003",
      "from": "exploration-001_a3f1_initial-profiling/finding-alpha-002",
      "to": "finding-beta-001",
      "relation": "extends",
      "strength": 0.72,
      "discovered_by": "beta",
      "evidence": "The customer segmentation clusters from the initial profiling map cleanly onto the churn risk tiers identified here, suggesting the same underlying behavioral dimensions.",
      "cross_exploration": "exploration-001_a3f1_initial-profiling"
    }
  ]
}
```

### Notes

- An empty exploration starts with `threads.json` as: `{"threads": []}`.
- Threads are typically populated during or after synthesis, but individual agents may also propose threads in their findings' "Possible Threads" sections, which are then formalized here.
- Cross-exploration threads use fully qualified finding IDs (`exploration-name/finding-id`) for the `from` or `to` field that references the external exploration, and set `cross_exploration` to that exploration's ID.
- The `discovered_by` field uses `"head"` when the research lead identifies the thread during synthesis, or the agent name when an individual agent proposes it.

---

## synthesis.md

The synthesis is the final output of an exploration — a summary document that ties together all findings and threads into a coherent narrative. It is written by the research lead after all agents have completed their work.

### File: `synthesis.md` (in exploration directory root)

### YAML Frontmatter

```yaml
---
id: "<string>"
name: "<string>"
parent: "<string|null>"
dataset: "<string>"
status: "<string>"
findings_count: <integer>
threads_count: <integer>
agents: [<string>]
---
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | The exploration directory name (e.g., `exploration-001_a3f1_initial-profiling`) |
| `name` | `string` | Yes | Human-readable name for the exploration (e.g., `"Initial Profiling"`) |
| `parent` | `string` or `null` | Yes | ID of the parent exploration this one branches from, or `null` for the root exploration |
| `dataset` | `string` | Yes | Filename (not full path) of the dataset analyzed (e.g., `"sales_data.csv"`) |
| `status` | `string` | Yes | One of: `completed`, `in-progress`, `dead-end` |
| `findings_count` | `integer` | Yes | Total number of finding files in this exploration |
| `threads_count` | `integer` | Yes | Total number of threads in this exploration's `threads.json` |
| `agents` | `string[]` | Yes | List of agent names that participated (e.g., `["alpha", "beta", "gamma"]`) |

### Status Values

| Status | Meaning |
|--------|---------|
| `completed` | All agents finished, synthesis written, threads identified |
| `in-progress` | Agents are still working or synthesis is not yet written |
| `dead-end` | Exploration completed but yielded no actionable findings or threads |

### Body Structure

The Markdown body below the frontmatter has three required sections:

```markdown
# <Exploration Name>

## Key Threads

Narrative description of the most important connections discovered across
findings. Organize by theme, not by agent. Reference specific finding IDs
and thread IDs.

### <Thread Theme 1>

Description of the thread theme, referencing findings and thread IDs.
Explain what the connected findings reveal together that no single
finding reveals alone.

### <Thread Theme 2>

...

## Standalone Findings

Findings that do not connect to any thread but are still noteworthy.
List each with a brief summary and its finding ID.

- **finding-gamma-001**: [Brief summary of the standalone finding]
- **finding-delta-002**: [Brief summary]

## Open Questions

Directions for future exploration. Each question should be specific
enough to become the seed for a new exploration.

1. [Specific question arising from the findings]
2. [Specific question that a thread raises but does not answer]
3. [Gap in the analysis that was identified but not addressed]
```

### Complete Example

```markdown
---
id: exploration-001_a3f1_initial-profiling
name: "Initial Profiling"
parent: null
dataset: "sales_data.csv"
status: completed
findings_count: 5
threads_count: 3
agents: ["alpha", "beta", "gamma"]
---

# Initial Profiling

## Key Threads

### Q4 Data Quality and Revenue Impact (thread-001, thread-002)

Alpha's discovery of concentrated Q4 missing values in the revenue column
(finding-alpha-001) directly explains Beta's observation that Q4 revenue
appears 23% below trend (finding-beta-002, thread-001). This is not a
genuine seasonal dip but a data artifact. Gamma's analysis further qualifies
this: 30% of rows with missing revenue still have valid cost data
(finding-gamma-001, thread-002), pointing to a revenue-specific pipeline
issue rather than wholesale Q4 data loss.

**Implication:** Any seasonal analysis must impute or exclude these rows;
raw Q4 aggregates are unreliable.

### Customer Concentration Risk (thread-003)

Beta's Pareto analysis (finding-beta-001) shows 8% of customers generate
52% of revenue. Alpha's correlation matrix (finding-alpha-002) reveals
these top customers cluster in a single product category.

**Implication:** Revenue is doubly concentrated — by customer and by
product. A shift in either dimension poses outsized risk.

## Standalone Findings

- **finding-gamma-002**: Return rates are uniform across all segments at
  4.1% +/- 0.3%, suggesting returns are not a differentiator for
  customer segmentation.

## Open Questions

1. What caused the Q4 revenue reporting gap — was it a system migration,
   and does it affect other financial columns?
2. Are the top-8% customers also the longest-tenured, or is concentration
   driven by recent large accounts?
3. Is the product-category concentration stable over time, or is it a
   recent trend?
```

---

## Cross-Reference Summary

| Artifact | Location | Format | Created By |
|----------|----------|--------|------------|
| Global config | `.otterwise/config.json` | JSON | `/otterwise:research` skill |
| Exploration dir | `.otterwise/exploration-{NNN}_{4hex}_{kebab}/` | Directory | Research lead |
| Finding | `findings/finding-{agent}-{seq}.md` | Markdown + YAML frontmatter | Individual agent |
| Notebook | `{agent-name}/notebook.ipynb` | Jupyter notebook | Individual agent |
| Threads | `threads.json` | JSON object with `threads` array | Research lead during synthesis |
| Synthesis | `synthesis.md` | Markdown + YAML frontmatter | Research lead |

## Validation Checklist

Agents and tools should validate the following:

- [ ] Exploration directory name matches pattern `exploration-\d{3}_[0-9a-f]{4}_[a-z0-9-]+`
- [ ] Finding files are inside the `findings/` subdirectory
- [ ] Finding filenames match pattern `finding-(alpha|beta|gamma|delta|epsilon)-\d{3}\.md`
- [ ] Each agent has a `{agent-name}/notebook.ipynb` directory
- [ ] All YAML frontmatter fields are present and correctly typed
- [ ] `confidence` is a number between `0.0` and `1.0`
- [ ] `relation` in threads is a descriptive string (preferably one of: `supports`, `contradicts`, `extends`, `causes`, `caused-by`, `correlates`, `qualifies`)
- [ ] `strength` in threads is a number between `0.0` and `1.0`
- [ ] `threads.json` uses the `{"threads": [...]}` wrapper object format
- [ ] `cross_exploration` is either a valid exploration ID string or `null`
- [ ] `discovered_by` is either `"head"` or a valid agent name
- [ ] `status` in synthesis is one of: `completed`, `in-progress`, `dead-end`
- [ ] `findings_count` matches actual number of finding files in the directory
- [ ] `threads_count` matches actual length of the `threads.json` array
- [ ] All finding IDs referenced in `threads.json` exist as files
- [ ] Cross-exploration thread references use fully qualified paths
- [ ] Finding body contains all three required sections: Evidence, Implication, Possible Threads
- [ ] Synthesis body contains all three required sections: Key Threads, Standalone Findings, Open Questions

---
name: research
description: Start a new Otterwise exploration session on a dataset
---

# /otterwise:research

Start autonomous exploration of a dataset.

## Usage
User provides:
- Path to a dataset file (CSV, Excel, Parquet, etc.)
- Research goals or questions (optional -- explores freely if none given)

## Workflow

### 1. Get Dataset Path
If the user did not provide a dataset path, ask for it before continuing.

Verify the file exists and is a supported format (CSV, Excel, Parquet, JSON, etc.).

### 2. Initialize Otterwise Directory
Create `.otterwise/` in the project root if it does not exist.

Create `.otterwise/config.json`:
```json
{
  "dataset": "<absolute-path-to-dataset>",
  "goals": ["<user-provided-goals-or-default>"],
  "created": "<ISO-8601-timestamp>"
}
```

If goals were not provided, set a default: `["General profiling and pattern discovery"]`.

### 3. Create Exploration Folder
Create the first exploration folder: `.otterwise/exploration-001_{hash}_{name}/`

- `001`: zero-padded sequential number
- `{hash}`: 4-character hex hash from the current timestamp
- `{name}`: kebab-case name describing the exploration (e.g., `initial-profiling`)

Create the `findings/` subfolder inside it.

### 4. Invoke Research Lead
Invoke the `research-lead` agent to begin the exploration session.

Pass context:
- This is the **root exploration** (parent: null)
- Dataset path from config.json
- User's goals (if any)
- The exploration folder path

The research lead will:
1. Create an Agent Team of 3-5 explorer agents (named alpha, beta, gamma, etc.)
2. Each agent loops autonomously: analyze data, write findings, read others' findings, analyze more
3. Each finding is saved as `finding-{agent}-{seq}.md` in the `findings/` folder
4. The lead monitors findings, discovers threads (connections between findings), and writes to `threads.json`
5. The lead sends cross-pollination messages between agents when connections emerge
6. When the finding rate saturates, the lead winds down agents and writes `synthesis.md`

### 5. Report Results
When the research lead finishes, report to the user:

- **Key Threads**: Connected findings that tell a story (from synthesis.md)
- **Standalone Findings**: Interesting discoveries not yet connected to others
- **Open Questions**: Unanswered questions that could seed future explorations

### 6. Next Steps
Tell the user:

> Run `/otterwise:continue` to explore further -- it will read the open questions and expand the exploration graph into new directions.

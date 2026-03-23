---
name: research
description: Start a new Otterwise research session on a dataset
---

# /otterwise:research

Start a new autonomous research session.

## Usage
The user should provide:
- Path to a dataset file (CSV, Excel, Parquet, etc.)
- Research goals or questions (optional — will do general profiling if none given)

## Workflow
1. If dataset path not provided, ask the user for it
2. Create `.otterwise/` directory in the project root if it doesn't exist
3. Create `.otterwise/config.json`:
   ```json
   {
     "dataset": "<absolute-path-to-dataset>",
     "goals": ["<user-provided-goals-or-default>"],
     "created": "<ISO-timestamp>"
   }
   ```
4. Use the **Agent tool** to invoke the research-lead agent:
   ```
   Agent tool call:
     custom_agent_path: "agents/research-lead.md"
     mode: "bypassPermissions"
     prompt: |
       You are the Research Lead for an Otterwise research session.

       ## Configuration
       <paste full contents of .otterwise/config.json here>

       ## Context
       - Project root: <absolute project root path>
       - Dataset path: <absolute dataset path from config.json>
       - User goals: <goals array from config.json>
       - This is the INITIAL research session (root node, parent: null)

       Begin your workflow: read the config, plan objectives, create an Agent Team,
       spawn researcher teammates, monitor progress, synthesize results, and write the report.
   ```
   - The research-lead agent will autonomously create teams, spawn researchers, and synthesize findings
   - Do NOT intervene — let the agent run to completion
5. Report results to the user when complete
6. Research data is saved in `.otterwise/` directory. Use `/otterwise:status` to view progress.

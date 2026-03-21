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
4. Invoke the `research-lead` agent to begin the initial research session
   - This will be the root node (parent: null)
   - The lead will create an Agent Team for parallel analysis
5. Report results to the user when complete
6. Mention that the dashboard is available: `cd otterwise/dashboard && npm install && npm run dev`

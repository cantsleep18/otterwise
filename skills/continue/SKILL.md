---
name: continue
description: Continue and expand an existing Otterwise research session
---

# /otterwise:continue

Expand the research graph with new analysis directions.

## Usage
The user can optionally specify:
- A focus direction (e.g., "dig deeper into the correlation findings")
- A specific node to expand from (by name or ID)

## Workflow
1. Verify `.otterwise/` exists and has at least one completed research node
2. Read `.otterwise/config.json` for dataset info
3. Use the **Agent tool** to invoke the research-lead agent:
   ```
   Agent tool call:
     custom_agent_path: "agents/research-lead.md"
     mode: "bypassPermissions"
     prompt: |
       You are the Research Lead for an Otterwise continuation session.

       ## Configuration
       <paste full contents of .otterwise/config.json here>

       ## Context
       - Project root: <absolute project root path>
       - Dataset path: <absolute dataset path from config.json>
       - User goals: <goals array from config.json>
       - This is a CONTINUATION session — read all existing report.md files to understand the research graph
       - User's focus direction: <user focus direction if provided, otherwise "general expansion">

       Begin your workflow: read the config, review all existing reports, plan where to expand,
       create an Agent Team, spawn researcher teammates, monitor progress, synthesize results,
       and write the report.
   ```
   - The research-lead agent will autonomously read prior reports, create teams, spawn researchers, and synthesize
   - Do NOT intervene — let the agent run to completion
4. Report results and new graph state to the user

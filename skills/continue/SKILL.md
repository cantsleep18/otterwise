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
3. Invoke the `research-lead` agent with context:
   - All existing report.md files (the lead reads these to understand the graph)
   - User's focus direction (if provided)
   - The lead will decide where to expand the graph next
4. Report results and new graph state to the user

---
name: status
description: Show current state of Otterwise explorations
---

# /otterwise:status

Display the exploration graph and research progress.

## Workflow
1. Scan `.otterwise/` for all `synthesis.md` files
2. Parse YAML frontmatter from each
3. Display exploration tree:

```
Otterwise Exploration Graph
├── ● exploration-001 initial-profiling (5 findings, 3 threads)
│   ├── ● exploration-002 customer-segments (4 findings, 5 threads)
│   │   └── ○ exploration-004 churn-prediction (in-progress)
│   └── ● exploration-003 west-region (3 findings, 2 threads)
```

Legend: ● completed  ○ in-progress

4. Show summary stats:
   - Total explorations, findings, threads
   - Total open questions across all explorations
   - Dataset info

5. Show top open questions (candidates for /otterwise:continue)

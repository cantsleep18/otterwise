---
name: status
description: Show the current state of Otterwise research
---

# /otterwise:status

Display the current research graph status.

## Workflow
1. Scan `.otterwise/` for all `report.md` files
2. Parse YAML frontmatter from each report
3. Build and display a tree visualization:

```
Research Graph:
├── ● basic-profiling (completed, 5 findings)
│   ├── ● correlation-deep-dive (completed, 4 findings)
│   │   └── ○ time-series-analysis (in-progress)
│   └── ● distribution-analysis (completed, 3 findings)
│       └── ◌ segmentation (pending)
└── (no more nodes)
```

Legend: ● completed  ○ in-progress  ◌ pending  ✗ dead-end

4. Show summary stats:
   - Total nodes
   - Completed / In-progress / Pending / Dead-end counts
   - Total findings across all nodes
   - Dataset info from config.json

5. Mention Otterwise dashboard: "For interactive visualization, run: cd otterwise/dashboard && npm run dev"

---
name: status
description: Show the current state of Otterwise research
---

# /otterwise:status

Display the current research graph status, including auto pilot state when active.

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

5. If `.otterwise/autopilot.json` exists, display the **Auto Pilot Status** section (see below). If it does not exist, skip this step.

6. Mention that `/otterwise:research` can be used to start a new research session if none exists.

---

## Auto Pilot Status Section

This section is displayed **only** when `.otterwise/autopilot.json` exists. It appears after the summary stats (step 5).

Read `.otterwise/autopilot.json` for session data (rounds, findings, config). Additionally read `.otterwise/autopilot-state.json` for the live control state if it exists.

### When session is in progress (`completedAt` is null, `rounds` array is non-empty)

Check `.otterwise/autopilot-state.json` for control state:

#### Control state is `"running"` or `"resume"` (or autopilot-state.json is missing)

```
Auto Pilot Status:
  Status: RUNNING (Round {lastRound.number}/{maxIterations})
  Findings: {totalFindings} total across {rounds.length} rounds
  Active Branch: {lastRound.teamName}
  Elapsed: {elapsed since createdAt}

  Round History:
    Round 1: {rounds[0].teamName} ({findingsCount} findings) - {duration}
    Round 2: {rounds[1].teamName} ({findingsCount} findings) - {duration}
    Round 3: {rounds[2].teamName} (in progress)
```

- Calculate elapsed time as the difference between now and `createdAt`
- For rounds with `status: "completed"`, show findings count and duration (computed from `startedAt` to `completedAt`)
- For rounds with `status: "in-progress"`, show "(in progress)"

#### Control state is `"pause"`

```
Auto Pilot Status:
  Status: PAUSED (Round {lastRound.number}/{maxIterations})
  (PAUSED - use /otterwise:autopilot-pause to resume)
  Findings: {totalFindings} total across {rounds.length} rounds
  Active Branch: {lastRound.teamName}

  Round History:
    Round 1: {rounds[0].teamName} ({findingsCount} findings) - {duration}
    ...
```

#### Control state is `"abort"`

```
Auto Pilot Status:
  Status: (ABORTING - will stop after current round)
  Findings: {totalFindings} total (partial results)

  Round History:
    Round 1: {rounds[0].teamName} ({findingsCount} findings) - {duration}
    ...
```

### When session is completed (`completedAt` is set)

```
Auto Pilot Status:
  Status: COMPLETED ({totalRounds} rounds)
  Stopping Reason: {stoppingReason}
  Findings: {totalFindings} total
  Report: .otterwise/autopilot-report.md

  Round History:
    Round 1: {rounds[0].teamName} ({findingsCount} findings) - {duration}
    Round 2: {rounds[1].teamName} ({findingsCount} findings) - {duration}
    ...
```

- Show the `stoppingReason` (e.g., "max-iterations", "diminishing-returns", "goals-met", "confidence-threshold", "user-abort")
- Point user to `.otterwise/autopilot-report.md` for full results

### When `stoppingReason` is `"user-abort"`

```
Auto Pilot Status:
  Status: (ABORTED)
  Findings: {totalFindings} total (partial results)
  Report: .otterwise/autopilot-report.md

  Round History:
    Round 1: {rounds[0].teamName} ({findingsCount} findings) - {duration}
    ...
```

### Data Sources Reference

**`.otterwise/autopilot.json`** — session config and round history:
- `maxIterations`, `totalRounds`, `totalFindings`, `stoppingReason`, `createdAt`, `completedAt`
- `rounds[]`: each with `number`, `reportId`, `parentId`, `status`, `teamName`, `findingsCount`, `startedAt`, `completedAt`

**`.otterwise/autopilot-state.json`** — live control signal (may not exist):
- `command`: `"running"` | `"pause"` | `"resume"` | `"abort"`
- `updatedAt`, `reason`

---
name: autopilot-abort
description: Abort a running autopilot session
---

# /otterwise:autopilot-abort

Abort a running autopilot session. Signals the orchestrator to stop after the current round completes.

## Usage

No arguments needed. This skill runs in a **separate Claude session** from the autopilot — it writes a control signal file that the autopilot loop reads between rounds.

## Workflow

### 1. Check Session Exists

1. Check if `.otterwise/autopilot-state.json` exists
2. If not: display "No active autopilot session found." and stop

### 2. Read Current State

1. Read and parse `.otterwise/autopilot-state.json`
2. If `command === "abort"`: display "Abort already requested." and stop
3. If `command === "completed"`: display "Autopilot session has already completed. Nothing to abort." and stop

### 3. Write Abort Signal

Update `.otterwise/autopilot-state.json`:

```json
{
  "command": "abort",
  "updatedAt": "<ISO-timestamp>",
  "reason": "User requested abort"
}
```

### 4. Confirm to User

Display:
```
Abort requested. The autopilot session will stop after the current round completes
and generate a final report with results so far.

Use /otterwise:status to see results once the session finishes.
```

## Important Rules

- This skill runs in a **separate Claude session** from the autopilot — it only writes a file; the autopilot loop reads it
- Abort is not instant — the current round finishes, then the autopilot runs its Final Synthesis phase with `stoppingReason: "user-abort"`
- If no `autopilot-state.json` exists, there is no active autopilot session to abort
- Never modify `.otterwise/autopilot.json` directly — that file is owned by the autopilot orchestrator

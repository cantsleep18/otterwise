---
name: autopilot-abort
description: Abort a running autopilot session
---

# /otterwise:autopilot-abort

Abort a running autopilot session. Writes an abort command to the state file so the orchestrator stops the loop.

## Usage

No arguments needed. This skill runs in a **separate Claude session** from the autopilot — it writes a control signal file that the autopilot loop reads between rounds.

## Workflow

### 1. Check Session Exists

1. Check if `.otterwise/autopilot-state.json` exists
2. If not: display "No active autopilot session found." and stop

### 2. Read Current State

1. Read and parse `.otterwise/autopilot-state.json`
2. If `command === "abort"`: display "Abort already requested." and stop

### 3. Write Abort Signal

Update `.otterwise/autopilot-state.json`:

```json
{
  "command": "abort",
  "updatedAt": "<ISO-timestamp>",
  "reason": "User requested abort"
}
```

The autopilot orchestrator will set `status: "aborted"` in `autopilot.json` when it reads this signal.

### 4. Confirm to User

Display:
```
Abort requested. The autopilot session will stop after the current round completes.

Use /otterwise:status to check session state.
```

## Important Rules

- This skill runs in a **separate Claude session** from the autopilot — it only writes a file; the autopilot loop reads it
- Abort is not instant — the current round finishes, then the loop stops. No synthesis or report is generated.
- If no `autopilot-state.json` exists, there is no active autopilot session to abort
- Never modify `.otterwise/autopilot.json` directly — that file is owned by the autopilot orchestrator

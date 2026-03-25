---
name: autopilot-abort
description: Abort a running autopilot session
---

# /otterwise:autopilot-abort

Abort a running autopilot session. Writes an abort command to the state file so the orchestrator stops the loop. Abort is a **one-way terminal state** — once aborted, the session cannot be resumed or paused; the only option is to start a new autopilot session.

## Usage

No arguments needed. This skill runs in a **separate Claude session** from the autopilot — it writes a control signal file that the autopilot loop reads between rounds.

## Workflow

### 1. Check Session Exists

1. Check if `.otterwise/autopilot-state.json` exists
2. If not: display "No active autopilot session found." and stop

### 2. Read Current State

1. Read and parse `.otterwise/autopilot-state.json`
2. If `command === "abort"`: display "Autopilot session has been aborted. Cannot modify an aborted session." and stop

### 3. Write Abort Signal

Update `.otterwise/autopilot-state.json`:

```json
{
  "command": "abort",
  "updatedAt": "<ISO-timestamp>",
  "reason": "user-requested"
}
```

The autopilot orchestrator will set `status: "aborted"` in `autopilot.json` when it reads this signal.

### 4. Confirm to User

Display:
```
Abort requested. The autopilot session will stop after the current round completes.

This is a terminal state — to run new research, start a new autopilot session.
Use /otterwise:status to check session state.
```

## Unified State Machine

The `autopilot-state.json` file uses a single `command` field. Valid commands:

| Command | Meaning | Transitions to |
|---------|---------|----------------|
| `"running"` | Loop is active | `"pause"`, `"abort"` |
| `"pause"` | Loop pauses after current round | `"running"` (via resume), `"abort"` |
| `"abort"` | Terminal — loop stops permanently | _(none — terminal state)_ |

Abort can be issued from any non-terminal state (`"running"` or `"pause"`). Once set, no further state transitions are possible — only starting a new autopilot session.

## Important Rules

- This skill runs in a **separate Claude session** from the autopilot — it only writes a file; the autopilot loop reads it between rounds
- Abort is not instant — the current round finishes, then the loop stops. No synthesis or report is generated.
- Abort is a **one-way terminal state** — once aborted, the session cannot be resumed or paused
- If no `autopilot-state.json` exists, there is no active autopilot session to abort
- Always use ISO 8601 timestamps for the `updatedAt` field
- Never modify `.otterwise/autopilot.json` directly — that file is owned by the autopilot orchestrator

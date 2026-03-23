---
name: autopilot-pause
description: Pause or resume a running auto pilot session
---

# /otterwise:autopilot-pause

Toggle pause/resume on a running auto pilot session. This skill runs in a **separate Claude session** from the autopilot orchestrator — it only writes a control signal file that the autopilot loop reads between rounds.

## Workflow

### 1. Check Session Exists

1. Check if `.otterwise/autopilot-state.json` exists
2. If not: display "No active auto pilot session found." and stop

### 2. Read Current State

1. Read and parse `.otterwise/autopilot-state.json`
2. Extract the `command` field

### 3. Toggle State

Based on the current `command` value:

- **If `"running"` or `"resume"`**: Write `{ "command": "pause", "updatedAt": "<ISO-timestamp>", "reason": null }` to `.otterwise/autopilot-state.json`. Display:
  ```
  Pause requested. The current round will complete before pausing.
  ```

- **If `"pause"`**: Write `{ "command": "resume", "updatedAt": "<ISO-timestamp>", "reason": null }` to `.otterwise/autopilot-state.json`. Display:
  ```
  Auto pilot resumed.
  ```

- **If `"abort"`**: Display:
  ```
  Auto pilot session has been aborted. Cannot pause an aborted session.
  ```

- **If `"completed"`**: Display:
  ```
  Auto pilot session has already completed. Nothing to pause.
  ```

## Important Rules

- This skill runs in a **separate Claude session** from the autopilot — it only writes a file; the autopilot loop reads it between rounds
- Pause is not instant — the current round finishes before the orchestrator checks the control signal
- If no `autopilot-state.json` exists, there is no active session to control
- Always use ISO 8601 timestamps for the `updatedAt` field
- Never modify `.otterwise/autopilot.json` — this skill only touches `autopilot-state.json`

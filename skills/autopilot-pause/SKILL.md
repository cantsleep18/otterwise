---
name: autopilot-pause
description: Pause or resume a running autopilot session
---

# /otterwise:autopilot-pause

Toggle pause/resume on a running autopilot session. Pausing delays the next EVALUATE cycle; resuming continues the infinite loop. This skill runs in a **separate Claude session** from the autopilot orchestrator — it only writes a control signal file that the autopilot loop reads between rounds.

## Workflow

### 1. Check Session Exists

1. Check if `.otterwise/autopilot-state.json` exists
2. If not: display "No active autopilot session found." and stop

### 2. Read Current State

1. Read and parse `.otterwise/autopilot-state.json`
2. Extract the `command` field

### 3. Toggle State

Based on the current `command` value:

- **If `"running"`**: Write `{ "command": "pause", "updatedAt": "<ISO-timestamp>", "reason": null }` to `.otterwise/autopilot-state.json`. Display:
  ```
  Pause requested. The current round will complete before pausing.
  ```

- **If `"pause"`**: Write `{ "command": "running", "updatedAt": "<ISO-timestamp>", "reason": null }` to `.otterwise/autopilot-state.json`. Display:
  ```
  Autopilot resumed. The infinite loop continues.
  ```

- **If `"abort"`**: Display:
  ```
  Autopilot session has been aborted. Cannot pause an aborted session.
  ```

## Important Rules

- This skill runs in a **separate Claude session** from the autopilot — it only writes a file; the autopilot loop reads it between rounds
- Pause is not instant — the current round finishes before the orchestrator checks the control signal
- Resume is an action (not a state) — it sets `command` back to `"running"`. Valid states are: `running`, `pause`, `abort`
- If no `autopilot-state.json` exists, there is no active session to control
- Always use ISO 8601 timestamps for the `updatedAt` field
- Never modify `.otterwise/autopilot.json` — this skill only touches `autopilot-state.json`

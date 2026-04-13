---
name: status
description: Show the current state of Otterwise research
---

# /otterwise:status

Display the current research graph status, including autopilot state when active.

## Workflow

1. Scan `.otterwise/strategies/*.md` for all strategy files.
2. Parse YAML frontmatter from each strategy (including `backtest` block) to reconstruct the DAG.
3. Build the graph from wikilinks in `## 관련 전략` sections.
4. Display the graph visualization (see below).
5. Show summary stats.
6. If `.otterwise/autopilot.json` exists, display the **Autopilot Status** section.
7. If no research exists, mention `/otterwise:research` to start.

---

## Graph Visualization

Build a tree from strategy relationships (`## 관련 전략` wikilinks). Seed strategies (no parents) are roots. Display using indented tree format:

```
Research Graph:
├── ● earnings-gap-overnight (PF 2.13, 승률 65.9%)          ← seed
│   └── ● earnings-gap-large-cap (PF 1.82, 승률 58.3%)      ← derive
├── ● volume-spike-reversal (PF 1.67, 승률 71.2%)           ← seed
│   └── ○ volume-spike-etf (백테스트 중...)                   ← explore, in-progress
└── ✗ insider-buy-signal (PF 0.91 — SKIP)                   ← seed, failed JUDGE
```

Legend: `●` completed (WRITE) `○` in-progress `◌` pending `✗` SKIP `⏸` paused

### Cross-branch strategies

Strategies with multiple parents (combine type) appear under their first parent with a `<- cross-branch` annotation and list all parent names joined with ` + `.

### Strategy label format

- Completed (WRITE): `● {name} (PF {profit_factor}, 승률 {win_rate_pct}%)`
- In-progress: `○ {name} (백테스트 중...)`
- SKIP/dead-end: `✗ {name} (PF {profit_factor} — SKIP)`
- Pending: `◌ {name}`
- Paused: `⏸ {name}`

---

## Summary Stats

After the graph, display:

```
Summary:
  Total strategies: 5
  Passed (WRITE):   3
  Skipped:          1
  In-progress:      1
  Best PF:          2.13 (earnings-gap-overnight)
  Avg PF:           1.87
  Dataset:          /path/to/prices/
```

- **Best PF**: highest `profit_factor` among completed (WRITE) strategies. Show strategy name.
- **Avg PF**: average `profit_factor` across completed (WRITE) strategies.
- **Dataset**: read from `.otterwise/config.json` field `dataset.prices`.
- Omit Best PF / Avg PF lines if no completed strategies exist.

---

## Autopilot Status Section

Displayed **only** when `.otterwise/autopilot.json` exists. Appears after summary stats.

Read `.otterwise/autopilot.json` for session data (strategies, status, config). Read `.otterwise/autopilot-state.json` for the live control state if it exists.

### Running (`status` is `"running"`, `autopilot-state.json` command is `"running"` or missing)

```
Autopilot:
  Status:     RUNNING
  Strategies: {totalStrategies}
  Expanding:  {last in-progress strategy name}
  Direction:  {current expansion direction from latest strategy's phenomenon}
  Elapsed:    {elapsed since createdAt}
  Last activity: {timestamp of most recent strategy's startedAt or completedAt}

  Expansion History:
    1. ● earnings-gap-overnight (PF 2.13, 승률 65.9%)
    2. ● volume-spike-reversal (PF 1.67, 승률 71.2%)
    3. ○ volume-spike-etf (백테스트 중...)
```

- List strategies in creation order.
- For completed strategies: show `●` with PF and win_rate.
- For SKIP strategies: show `✗` with PF and SKIP label.
- For the current in-progress strategy: show `○` with `(백테스트 중...)`.
- **Direction**: read from the latest strategy's frontmatter `phenomenon` field.
- **Last activity**: the most recent `startedAt` or `completedAt` timestamp from the strategies array in `autopilot.json`.

### Paused (`autopilot-state.json` command is `"pause"`)

```
Autopilot:
  Status:     ⏸ PAUSED
  Reason:     {reason from autopilot-state.json, if present}
  Strategies: {totalStrategies}
  Paused at:  {updatedAt from autopilot-state.json}
  Elapsed:    {elapsed since createdAt}

  Expansion History:
    1. ● earnings-gap-overnight (PF 2.13, 승률 65.9%)
    2. ● volume-spike-reversal (PF 1.67, 승률 71.2%)
    ...
```

- Omit the `Reason:` line if `reason` is null or absent in `autopilot-state.json`.
- Autopilot will resume from where it left off when unpaused.

### Aborting (`autopilot-state.json` command is `"abort"`)

```
Autopilot:
  Status:     ABORTING (will stop after current strategy)
  Strategies: {totalStrategies}

  Expansion History:
    1. ● earnings-gap-overnight (PF 2.13, 승률 65.9%)
    ...
```

### Aborted (`status` is `"aborted"`)

```
Autopilot:
  Status:     ABORTED
  Strategies: {totalStrategies}

  Expansion History:
    1. ● earnings-gap-overnight (PF 2.13, 승률 65.9%)
    ...
```

- Research data remains in `.otterwise/` and can be continued by running `/otterwise:autopilot` again.

---

## Data Sources

**`.otterwise/strategies/*.md`** -- DAG source of truth via YAML frontmatter:
- `id`, `type` (seed/derive/explore/combine), `status`, `phenomenon`, `researchMode`, `tags`
- `backtest:` block: `tickers`, `period`, `trades`, `winners`, `losers`, `win_rate_pct`, `avg_return_pct`, `profit_factor`, `max_consecutive_losses`, `fee_applied_pct`
- Strategy IDs use the format `YYYYMMDD_HHMM_{8hex}`. Display the `name` portion of the filename (after the ID prefix) in graph labels and expansion history.
- Parent relationships parsed from `## 관련 전략` wikilinks.

**`.otterwise/config.json`** -- dataset path (`dataset.prices`), goals (immutable after init)

**`.otterwise/autopilot.json`** -- autopilot session state:
- `status` (`"running"` | `"aborted"`), `createdAt`
- `strategies[]`: each with `id`, `status`, `phenomenon`, `researchMode`, `name`, `startedAt`, `completedAt`, `backtest` (`{ trades, win_rate_pct, profit_factor }`)
- `cooldown[]`: array of strategy names/candidates that hit the circuit breaker (3+ consecutive failures)

**`.otterwise/autopilot-state.json`** -- live control signal (may not exist):
- `command`: `"running"` | `"pause"` | `"abort"`
- `updatedAt`, `reason`

**`.otterwise/error.log`** -- append-only error log (may not exist):
- One error per line. Count lines to show error total in summary stats (omit if empty or missing).

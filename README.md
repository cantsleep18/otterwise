<p align="center">
  <br />
  <code>&nbsp;otterwise&nbsp;</code>
  <br />
  <br />
  <strong>종가베팅 strategy research that never sleeps.</strong>
  <br />
  <sub>A Claude Code plugin that discovers overnight-return opportunities through event-driven backtesting.</sub>
  <br />
  <br />
  <a href="#install"><img src="https://img.shields.io/badge/install-one_command-000?style=flat-square" /></a>
  <img src="https://img.shields.io/badge/v1.5.0-000?style=flat-square&labelColor=000&color=111" />
  <img src="https://img.shields.io/badge/license-MIT-000?style=flat-square&labelColor=000&color=111" />
</p>

---

## What it does

Point it at price data and a goal. It runs an observation loop -- finding events, backtesting overnight returns (buy at close, sell at next open), and writing strategy documents when the numbers hold up. Each cycle produces a strategy memo with a real backtest. It doesn't stop until you tell it to.

---

## Install

```bash
claude extension add cantsleep18/otterwise
```

Verify with `/otterwise:ow-setup`.

---

## Quick start

```bash
/otterwise:autopilot /path/to/prices/ "종가베팅 전략 발굴"
```

Walk away. Come back to a vault of backtested strategy documents.

Pause anytime with `/otterwise:autopilot-pause`. Stop with `/otterwise:autopilot-abort`.

---

## The OLJC loop

Each autopilot cycle runs four phases:

```
OBSERVE    read data, find an event that might work for 종가베팅
LOOK       mark event dates, calculate overnight returns, aggregate metrics
JUDGE      profit_factor > 1.5? positive after fees? enough trades? → WRITE or SKIP
CRYSTALLIZE   write the strategy document with backtest results
```

Then the **router** picks a new direction and the loop restarts. Ten research modes keep exploration diverse -- brute force screening, news replay, anomaly detection, consensus gaps, and more.

Output is Obsidian-native markdown. Open `.otterwise/strategies/` as a vault and get a knowledge graph for free.

---

## Commands

| Command | |
|---------|---|
| `/otterwise:autopilot` | Infinite autonomous research loop |
| `/otterwise:autopilot-pause` | Pause / resume |
| `/otterwise:autopilot-abort` | Stop the loop |
| `/otterwise:research` | Single-cycle research run |
| `/otterwise:continue` | Expand the graph manually |
| `/otterwise:status` | Print current strategy graph with PF/win-rate |
| `/otterwise:ow-setup` | Diagnose + auto-update |

---

## Details

See [PLAN.md](PLAN.md) for the full architecture, strategy format, and mode definitions.

---

MIT

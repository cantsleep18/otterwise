<p align="center">
  <br />
  <code>&nbsp;otterwise&nbsp;</code>
  <br />
  <br />
  <strong>Autonomous investment research that never sleeps.</strong>
  <br />
  <sub>A Claude Code plugin that reads your data, discovers patterns, and writes strategy memos — on repeat, forever.</sub>
  <br />
  <br />
  <a href="#install"><img src="https://img.shields.io/badge/install-one_command-000?style=flat-square" /></a>
  <img src="https://img.shields.io/badge/v1.3.0-000?style=flat-square&labelColor=000&color=111" />
  <img src="https://img.shields.io/badge/license-MIT-000?style=flat-square&labelColor=000&color=111" />
</p>

---

## What it does

Point it at a dataset and a goal. It runs an observation loop — reading data, noticing phenomena, checking price behavior, writing narrative strategy files. Each cycle produces an analyst-grade memo grounded in real data. It doesn't stop until you tell it to.

---

## Install

```bash
claude extension add cantsleep18/otterwise
```

Verify with `/otterwise:ow-setup`.

---

## Quick start

```bash
/otterwise:autopilot /path/to/data.csv "Find undervalued stocks"
```

Walk away. Come back to a vault of strategy documents.

Pause anytime with `/otterwise:autopilot-pause`. Stop with `/otterwise:autopilot-abort`.

---

## The OLJC loop

Each autopilot cycle runs four phases:

```
OBSERVE    read data, notice something interesting
LOOK       find past cases, check actual price moves
JUDGE      worth writing up? yes or skip
CRYSTALLIZE   distill into a strategy memo
```

Then the **router** picks a new direction and the loop restarts. Ten research modes keep exploration diverse — brute force screening, news replay, anomaly detection, narrative shifts, and more.

Output is Obsidian-native markdown. Open `.otterwise/strategies/` as a vault and get a knowledge graph for free.

---

## Commands

| Command | |
|---------|---|
| `/otterwise:autopilot` | Infinite autonomous research loop |
| `/otterwise:autopilot-pause` | Pause / resume |
| `/otterwise:autopilot-abort` | Stop the loop |
| `/otterwise:research` | One-shot research run |
| `/otterwise:continue` | Expand the graph manually |
| `/otterwise:status` | Print current strategy graph |
| `/otterwise:ow-setup` | Diagnose + auto-update |

---

## Details

See [PLAN.md](PLAN.md) for the full architecture, routing logic, and strategy format spec.

---

MIT

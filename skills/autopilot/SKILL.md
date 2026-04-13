---
name: autopilot
description: Run autonomous 종가베팅 strategy research — OLJC loop that grows a strategy graph indefinitely
---

# /otterwise:autopilot

Run a fully autonomous 종가베팅 research loop. Each cycle discovers an event (OBSERVE), backtests overnight returns (LOOK), judges profitability (JUDGE), and crystallizes it into a strategy (CRYSTALLIZE). An Adaptive Router selects the next research mode between cycles. The loop runs forever until the user aborts. You (the main Claude session) ARE the research lead -- do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:autopilot "Optional investment goals"
/otterwise:autopilot /path/to/prices "Optional investment goals" [/path/to/sources]
```

If no paths given, defaults to `./data/prices` and `./data/sources` (created by `/otterwise:ow-setup`).
Re-running on an existing `.otterwise/` directory resumes from current state.

## Workflow

```
           +------------------------------------------------------------+
           v                                                            |
INIT --> ROUTE --> OBSERVE --> LOOK --> JUDGE --+--> CRYSTALLIZE --> ROUTE
 or                 Team x1   Team xK   inline  |
RESUME                                          SKIP -> log + ROUTE
```

## State Check (every phase)

Before each phase, read `autopilot-state.json`:
- `"running"` -> proceed.
- `"pause"` -> wait loop (re-read every 10s until `"running"`).
- `"abort"` -> set `autopilot.json` status to `"aborted"`, stop.

## Phase: INIT (no existing strategies)

1. Parse user input: prices path (optional, default `./data/prices`), optional goals, optional sources path (default `./data/sources`).
2. Create `.otterwise/` with subdirectories: `strategies/`, `artifacts/`.
3. Write `config.json`:
   ```json
   { "dataset": { "prices": "/path", "sources": "/path/or/null" },
     "goals": "", "investmentMode": true,
     "fee": { "stock_pct": 0.24, "etf_pct": 0.04 } }
   ```
4. Write `autopilot.json` (`status: "running"`, empty `strategies[]`, `modeStats: {}`, `lastModes: []`, `cooldown: []`), `autopilot-state.json` (`command: "running"`).
5. Explore dataset inline (do NOT spawn agent): list files, read samples, identify data types (prices, news, filings), note quality issues.
6. Proceed to **ROUTE**.

If dataset missing/empty: abort. If `.otterwise/strategies/` already has `.md` files: switch to RESUME.

## Phase: RESUME (existing strategies found)

1. Glob `.otterwise/strategies/*.md`. Parse frontmatter; delete files missing required fields (`id`, `type`, `status`, `phenomenon`, `researchMode`, `backtest`), log each deletion.
2. Rebuild strategy graph from `## 관련 전략` wikilinks. Log dangling references.
3. Sync `autopilot.json`: rebuild `strategies[]` from frontmatter (include `backtest: {trades, win_rate_pct, profit_factor}`), recalculate `modeStats`, rebuild `lastModes` from timestamps (last 5). Set `autopilot-state.json` to `"running"`.
4. Read `config.json` for dataset paths and fee config. Proceed to **ROUTE**.

If all files incomplete: fresh start (INIT step 5). If `config.json` missing: abort.

## ROUTE (Adaptive Router)

State check. Then glob `strategies/*.md` and read `autopilot.json` (`modeStats`, `lastModes`).

Reason about the current state -- qualitative judgment, not a formula:

**Inputs**: graph coverage (strategies per mode, status distribution, unexplored modes), recent flow (`lastModes`), data availability, existing findings (drafts needing verification, established strategies open for derivation/combination).

**Decide three things**:

1. **Research mode** (one of 10 -- see Mode Objectives below).
2. **Expansion type**: `seed` (new), `derive` (improve existing), `explore` (inspired by existing, different area), `combine` (merge 2+ insights). Specify target strategy IDs for derive/explore/combine.
3. **Focus area**: specific phenomenon to investigate, priority data files.

**Diversity rule**: if `lastModes` has 3 consecutive identical modes, force a different mode. Log the override.

Pass routing directive inline to OBSERVE. Do not persist to a file.

## OBSERVE

**Cycle ID** (generate before any file writes): `{id}` = `YYYYMMDD_HHMM_{8hex}`. Choose kebab-case `{name}`. Use `{id}_{name}` for artifact folder AND strategy file.

State check. Discover an event that could work as a 종가베팅 trigger.

1. **Teams API**: TeamCreate `"autopilot-{YYYYMMDD-HHMMSS}-observe-{name}"`, 1 task, 1 researcher. Poll 5-min intervals, 15-min timeout.
2. **Researcher receives**: mode objectives, dataset paths, existing graph summary, parent context (for derive/combine). Key instruction: observe events, do not hypothesize trading rules.
3. **Output**: `.otterwise/artifacts/{id}_{name}/01_discovery.md`
   - `## 현상` -- observed event, natural language
   - `## 데이터 근거` -- file, column, row range
   - `## 종가베팅 가설` -- why buying at close on this event might yield overnight profit
   - `## 확인 필요 사항` -- specific tickers/dates to check in LOOK
4. Shutdown researcher, delete team. Pass phenomenon to LOOK.

## LOOK

State check. Researchers mark event dates and calculate overnight returns in parallel.

1. **Teams API**: TeamCreate `"autopilot-{YYYYMMDD-HHMMSS}-look-{name}"`, K tasks (default 3), K researchers in ONE message. Poll 5-min intervals, 10-min timeout per researcher.
2. **Researcher receives**: phenomenon from OBSERVE, `dataset.prices` path, assigned subset (time period/sector/stock group), fee config from `config.json`.
3. **Per-event calculation**: gross = `(next_open - close) / close`, fee = `config.fee.stock_pct` (or `etf_pct`), net = gross - fee/100.
4. **Output**: event table + aggregate metrics per subset.
   ```
   ## 이벤트 마킹
   | 날짜 | 종목 | 이벤트 | 종가 | 익일시가 | gross수익률 | fee | net수익률 |
   ## 집계
   trades, winners, losers, win_rate_pct, avg_return_pct, profit_factor, max_consecutive_losses
   ## 관찰
   ```
5. **50%+ failure tolerance**: if majority fail, continue with available results.
6. **Synthesize** into `.otterwise/artifacts/{id}_{name}/02_evidence.md` (per-subset files as `02_evidence_{subset}.md`). Recalculate aggregates across all subsets.
7. Shutdown researchers, delete team. Pass synthesized output to JUDGE.

## JUDGE

State check. Team lead judges inline -- no agent spawn, no Teams API.

1. Read OBSERVE output and LOOK output in full.
2. **Decision gates** (all must pass for WRITE):
   - `profit_factor > 1.5`
   - Sufficient trades (>=10 preferred, judgment call for rare events)
   - `avg_return_pct > 0` (positive after fees)
3. **Secondary** (informational): `win_rate_pct`, `max_consecutive_losses`, explainability, repeatability.
4. Decide: **WRITE** or **SKIP**.
5. Log to `.otterwise/artifacts/{id}_{name}/03_evaluation.md`:
   ```
   ## 판정: {WRITE | SKIP}
   ## 정량 기준
   - profit_factor: {value} (gate: > 1.5)
   - trades: {value}
   - avg_return_pct: {value} (gate: positive)
   - win_rate_pct / max_consecutive_losses (informational)
   ## 정성 판단
   - 설명 가능성 / 반복 가능성
   ## 사유
   ```
6. **WRITE** -> CRYSTALLIZE. **SKIP** -> return to ROUTE.

## CRYSTALLIZE

State check. Write the final strategy document.

1. **Teams API**: TeamCreate `"autopilot-{YYYYMMDD-HHMMSS}-crystallize-{name}"`, 1 task, 1 researcher. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: JUDGE rationale, OBSERVE phenomenon, LOOK event table + aggregates, expansion type, related strategy names, dataset paths.
3. **Output**: `.otterwise/strategies/{id}_{name}.md` -- frontmatter with `backtest:` block (tickers, period, trades, winners, losers, win_rate_pct, avg_return_pct, profit_factor, max_consecutive_losses, fee_applied_pct) + body sections: `## 관련 전략`, `## 현상`, `## 이벤트 발생일 및 종가베팅 결과` (6-col table: 날짜/종목/이벤트/종가/익일시가/수익률 -- net only), `## 집계`, `## 해석`, `## 한계 및 주의사항`.
4. **Post-CRYSTALLIZE** updates to `autopilot.json`:
   - Append to `strategies[]`: `{ id, name, type, status: "draft", phenomenon, researchMode, backtest: { trades, win_rate_pct, profit_factor }, createdAt }`
   - Increment `modeStats[mode]`, append mode to `lastModes[]` (keep last 10)
5. Shutdown researcher, delete team. **Return to ROUTE** -- infinite loop continues.

## Mode Objectives (종가베팅)

| Mode | OBSERVE Focus | LOOK Focus |
|------|---------------|------------|
| `brute_force` | 가격/거래량 극단값 (거래량 급증, 상한가/하한가) | 조건 충족일 종가매수 -> 익일시가 수익률 |
| `news_replay` | 뉴스 유형별 당일 가격 반응 (실적, M&A, 제재) | 뉴스 유형 발생일 종가베팅 수익률 |
| `condition_combo` | 복수 조건 동시 충족일 (거래량+가격+수급) | 조건 조합 충족일 종가베팅 수익률 |
| `anomaly_detection` | 통계적 이상치 (가격, 거래량, 괴리율) | 이상치 발생일 종가베팅 수익률 |
| `copycat` | 검증된 패턴의 타종목/타섹터 적용 | 타종목 동일 패턴 발생일 종가베팅 수익률 |
| `narrative_shift` | 기업 스토리 전환점 (CEO 교체, 피벗) | 전환점 발생일 종가베팅 수익률 |
| `consensus_gap` | 컨센서스 vs 실제 괴리 (실적, 가이던스) | 괴리 발생일 종가베팅 수익률 |
| `supply_chain` | 업스트림 시그널 (원자재, 부품사, 고객사) | 시그널 발생일 하류종목 종가베팅 수익률 |
| `regulatory` | 정책/규제 이벤트 (금리, 세제, 산업규제) | 이벤트 발생일 섹터 종가베팅 수익률 |
| `behavioral` | 경영진 행동 패턴 (자사주, 내부자거래) | 패턴 발생일 종가베팅 수익률 |

For `derive`/`explore`/`combine`, also inject parent strategy context (phenomenon, backtest results, limitations).

## Teams API Lifecycle

**TeamCreate** (`"autopilot-{YYYYMMDD-HHMMSS}-{phase}-{name}"`) -> **TaskCreate** x K -> **Agent** x K (ALL in one message, `general-purpose`, `bypassPermissions`, `run_in_background: true`) -> **TaskList** poll (5-min intervals, phase-specific timeout; on timeout continue with available) -> **Read** outputs -> **SendMessage** shutdown_request -> **TeamDelete** (1 retry on failure).

## State Management

```
.otterwise/
  config.json                          <- dataset, goals, fee, investmentMode
  autopilot.json                       <- status, strategies[], modeStats, lastModes, cooldown
  autopilot-state.json                 <- user control: running/pause/abort
  error.log
  strategies/{id}_{name}.md            <- CRYSTALLIZE output (Obsidian vault)
  artifacts/{id}_{name}/               <- per-cycle folder
    01_discovery.md / 02_evidence.md / 02_evidence_{subset}.md / 03_evaluation.md
```

Strategy frontmatter: `id`, `type`, `status`, `phenomenon`, `researchMode`, `tags`, `backtest: { tickers, period, trades, winners, losers, win_rate_pct, avg_return_pct, profit_factor, max_consecutive_losses, fee_applied_pct }`. Relationships via `[[wikilinks]]` in `## 관련 전략`.

`autopilot.json` entries: `{ id, name, type, status, phenomenon, researchMode, backtest: { trades, win_rate_pct, profit_factor }, createdAt }`. Top-level: `status`, `modeStats`, `lastModes` (last 10), `cooldown` ([{candidateId, consecutiveFailures, lastFailedAt}]).

## Error Handling

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, log to `error.log`, skip cycle, ROUTE. |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | Set status `"aborted"`, stop. |
| Researcher crash (no output) | Log, exclude from synthesis. |
| TeamDelete fails | Retry once. Log and continue. |
| Phase timeout | Continue with available results, log warning. |
| JUDGE returns SKIP | Log to `03_evaluation.md`, return to ROUTE. |
| Candidate in cooldown (3+ failures) | Skip, select next in ROUTE. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the loop.
- One team per phase per cycle, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing -- serialize all outputs to disk.
- Strategy graph reconstructed from frontmatter + wikilinks each cycle.
- Strategy names: kebab-case. IDs: `YYYYMMDD_HHMM_{8hex}`.
- The loop never self-terminates. Only user abort stops it.
- Re-running `/autopilot` on existing `.otterwise/` is the resume mechanism.
- All strategy content in Korean. Obsidian-compatible (wikilinks, tags, callouts).
- No backtest engine -- Claude reads price data and does math directly.
- No data format enforcement -- Claude reads whatever format is provided.

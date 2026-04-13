---
name: research
description: Start a new investment research session — single OLJC cycle on a dataset
---

# /otterwise:research

Run one 종가베팅 research cycle on a dataset. Discover a phenomenon (OBSERVE), backtest overnight returns (LOOK), judge by quantitative gates (JUDGE), and crystallize into a strategy document (CRYSTALLIZE). You (the main Claude session) ARE the research lead -- do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:research "Optional goals"
/otterwise:research /path/to/prices "Optional goals" [/path/to/sources]
```

If no paths given, defaults to `./data/prices` and `./data/sources` (created by `/otterwise:ow-setup`).

Optional: specify research mode -- `/otterwise:research "goals" mode=news_replay`. Default: auto-selected in ROUTE.

## Workflow

```
INIT ──> ROUTE ──> OBSERVE ──> LOOK ──> JUDGE ──┬──> CRYSTALLIZE ──> done
                     │           │        │      │
                   Team×1    Team×K    inline    SKIP → log + done
                                                 Team×1
```

## Phase: INIT

1. Parse user input: prices path (optional, default `./data/prices`), optional goals, optional sources path (default `./data/sources`), optional mode override.
2. Create `.otterwise/` with subdirectories: `strategies/`, `artifacts/`.
3. Write `config.json`:
   ```json
   {
     "dataset": { "prices": "/path/to/prices/", "sources": "/path/to/sources/" },
     "goals": "user goals",
     "investmentMode": true,
     "fee": { "stock_pct": 0.24, "etf_pct": 0.04 }
   }
   ```
   `sources` is `null` if not provided.
4. Explore dataset inline (do NOT spawn agent): list files in prices dir (and sources dir if given), read samples, identify data types, note quality issues.
5. Proceed to **ROUTE**.

If prices path missing/empty: abort with message to user.

## ROUTE

Select research mode -- auto or user-specified.

If user specified a mode, use it. Otherwise, reason about dataset contents and user goals to pick the best fit.

**Research modes** (10):

| # | Mode | OBSERVE Focus | LOOK Focus |
|---|------|---------------|------------|
| 1 | `brute_force` | 가격/거래량 극단값 | 해당 조건일 종가베팅 수익률 |
| 2 | `news_replay` | 뉴스 유형별 당일 반응 | 뉴스 발생일 종가베팅 수익률 |
| 3 | `condition_combo` | 복수 조건 동시 충족일 | 조건 조합일 종가베팅 수익률 |
| 4 | `anomaly_detection` | 통계적 이상치 탐지 | 이상치 발생일 종가베팅 수익률 |
| 5 | `copycat` | 검증 패턴 타종목 적용 | 타종목 패턴일 종가베팅 수익률 |
| 6 | `narrative_shift` | 기업 스토리 전환점 | 전환점 발생일 종가베팅 수익률 |
| 7 | `consensus_gap` | 컨센서스 vs 실제 괴리 | 괴리 발생일 종가베팅 수익률 |
| 8 | `supply_chain` | 업스트림 시그널 | 시그널일 하류 종목 종가베팅 수익률 |
| 9 | `regulatory` | 정책/규제 이벤트 | 이벤트일 섹터 종가베팅 수익률 |
| 10 | `behavioral` | 경영진 행동 패턴 | 패턴 발생일 종가베팅 수익률 |

Expansion type is always `seed` (new research, no existing graph). Pass routing directive (mode, focus area, priority data files) inline to OBSERVE.

## OBSERVE

**Cycle ID** (generate before any file writes): `{id}` = `YYYYMMDD_HHMM_{8hex}` (current time + random hex, e.g. `20260401_1200_a1b2c3d4`). Choose kebab-case `{name}` for the topic. Use `{id}_{name}` consistently for artifact folder AND strategy file this cycle.

Discover a phenomenon from data -- observation, not analysis. The goal is "어?" not "통계적 유의성".

1. **Teams API**: TeamCreate, 1 task, 1 researcher. Poll 5-min intervals, 15-min timeout.
2. **Researcher receives**: mode-specific objectives (from table above), dataset paths (prices + sources), user goals. Key instruction: observe phenomena, articulate why this could produce overnight returns.
3. **Output**: `.otterwise/artifacts/{id}_{name}/01_discovery.md`
   ```
   ## 현상         — observed event, natural language
   ## 데이터 근거   — which files/columns/rows, what was seen
   ## 종가베팅 가설  — why buying at close on this event might yield overnight profit
   ## 확인 필요 사항 — specific tickers/dates to check in LOOK
   ```
   Create the per-cycle folder `artifacts/{id}_{name}/` on first write.
4. Shutdown researcher, delete team. Pass phenomenon to LOOK.

## LOOK

Researchers mark event dates and calculate overnight returns in parallel.

1. **Teams API**: TeamCreate, K tasks (default 3), K researchers in ONE message. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: phenomenon from OBSERVE, prices dataset path, assigned subset (time period/sector/stock group), mode context, fee rates from config.json.
3. **Overnight return calculation**:
   - Gross return: `(next_open - close) / close`
   - Net return: `gross_return - fee_pct/100` (stock: 0.24%, ETF: 0.04%)
   - Claude reads price data directly and does the math -- no backtest engine.
4. **Output per researcher**: event table + metrics for their subset.
5. **50%+ failure tolerance**: if majority fail, continue with available results.
6. **Synthesize** into `.otterwise/artifacts/{id}_{name}/02_evidence.md` (combined) and per-subset `02_evidence_{subset}.md`:
   ```
   ## 현상 요약
   ## 이벤트 마킹
   | 날짜 | 종목 | 이벤트 | 종가 | 익일시가 | gross수익률 | fee | net수익률 |
   ## 집계
   - trades / winners / losers / win_rate_pct / avg_return_pct / profit_factor / max_consecutive_losses
   ## 관찰
   ```
   Aggregate metrics recalculated across all subsets.
7. Shutdown researchers, delete team. Pass synthesized output to JUDGE.

## JUDGE

Team lead judges inline -- no agent spawn, no Teams API.

1. Read OBSERVE output and LOOK output in full.
2. **Quantitative gates** (all must pass for WRITE):
   - `profit_factor > 1.5`
   - Sufficient trades (>=10 preferred, judgment call for rare events)
   - `avg_return_pct > 0` (positive after fees)
3. **Secondary** (informational, not gates): `win_rate_pct`, `max_consecutive_losses`, explainability, repeatability.
4. Decide: **WRITE** or **SKIP**. No middle ground.
5. Log to `.otterwise/artifacts/{id}_{name}/03_evaluation.md`:
   ```
   ## 판정: {WRITE | SKIP}
   ## 정량 기준
   - profit_factor: {value} (gate: > 1.5)
   - trades: {value} (gate: sufficient)
   - avg_return_pct: {value} (gate: positive)
   - win_rate_pct: {value}
   - max_consecutive_losses: {value}
   ## 정성 판단
   - 설명 가능성: {assessment}
   - 반복 가능성: {assessment}
   ## 사유
   {1-2 sentence rationale}
   ```
6. **WRITE** -> proceed to CRYSTALLIZE. **SKIP** -> log in `03_evaluation.md`, report to user, done.

## CRYSTALLIZE

Write the final strategy document in Obsidian-compatible format.

1. **Teams API**: TeamCreate, 1 task, 1 researcher. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: JUDGE rationale, OBSERVE phenomenon, LOOK event table + aggregates, dataset path.
3. **Output**: `.otterwise/strategies/{id}_{name}.md`:
   - YAML frontmatter: `id`, `type: seed`, `status: draft`, `phenomenon`, `researchMode`, `tags`, `backtest:` block (tickers, period, trades, winners, losers, win_rate_pct, avg_return_pct, profit_factor, max_consecutive_losses, fee_applied_pct -- values from LOOK)
   - `## 관련 전략` -- "독립 전략 (seed)"
   - `## 현상` -- natural language event description
   - `## 이벤트 발생일 및 종가베팅 결과` -- event table (날짜, 종목, 이벤트, 종가, 익일시가, 수익률 -- net returns only)
   - `## 집계` -- plain-text aggregates matching frontmatter
   - `## 해석` -- why this phenomenon works for 종가베팅
   - `## 한계 및 주의사항` -- limitations
4. Shutdown researcher, delete team. Report result to user.

## Teams API Lifecycle (Per Phase)

Each phase follows: **TeamCreate** (`"research-{YYYYMMDD-HHMMSS}-{phase}-{name}"`) -> **TaskCreate** x K -> **Agent** x K (ALL in one message, `general-purpose`, `bypassPermissions`, `run_in_background: true`) -> **TaskList** poll (5-min intervals, phase-specific timeout; on timeout continue with available results) -> **Read** outputs -> **SendMessage** shutdown_request -> **TeamDelete** (1 retry on failure).

## State Management

```
.otterwise/
  config.json                          <- dataset, goals, fee, investmentMode
  strategies/
    {id}_{name}.md                     <- CRYSTALLIZE output (Obsidian vault)
  artifacts/
    {id}_{name}/                       <- per-cycle folder (created in OBSERVE)
      01_discovery.md                  <- OBSERVE phenomenon
      02_evidence.md                   <- LOOK event table + metrics
      02_evidence_{subset}.md          <- LOOK per-subset evidence
      03_evaluation.md                 <- JUDGE decision (WRITE or SKIP)
```

## Error Handling

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, log to `error.log`, abort. |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | Abort with message to user. |
| Researcher crash (no output) | Log, exclude from synthesis. |
| TeamDelete fails | Retry once. If still fails, ignore and continue. **Never `rm -rf ~/.claude/` paths.** |
| Phase timeout | Continue with available results, log warning. |
| JUDGE returns SKIP | Record in `03_evaluation.md`, report to user, done. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the cycle.
- One team per phase, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing -- serialize all outputs to disk.
- Strategy names use kebab-case. Strategy IDs: `YYYYMMDD_HHMM_{8hex}`.
- Research runs once -- no loop, no resume. Each invocation starts fresh.
- No autopilot.json or autopilot-state.json -- research has no loop state.
- All strategy content in Korean. Obsidian-compatible format (wikilinks, tags, callouts).
- No backtest engine -- Claude reads price data and calculates returns directly.
- No data format enforcement -- Claude reads whatever format the user provides.

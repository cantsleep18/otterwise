---
name: continue
description: Expand the strategy graph with a user-directed OLJC cycle
---

# /otterwise:continue

Run a single user-directed OLJC cycle to expand the strategy graph with 종가베팅 backtesting. You (the main Claude session) ARE the research lead -- do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:continue "deepen earnings-gap-overnight"
/otterwise:continue "branch from volume-spike-reversal"
/otterwise:continue "combine earnings-gap-overnight and volume-spike-reversal"
/otterwise:continue "investigate regulatory impact on semiconductors"
```

## Workflow

```
LOAD ──> ROUTE (user override) ──> OBSERVE ──> LOOK ──> JUDGE ──┬──> CRYSTALLIZE
                                     │           │        │      │
                                   Team×1     Team×K    inline   SKIP → log + done
                                                                 Team×1
```

Single cycle -- runs once, then reports result.

## Phase: LOAD

1. Verify `.otterwise/` exists with `config.json`. If missing: abort with setup instructions.
2. Read `config.json` -- extract `dataset.prices`, `dataset.sources`, `fee`.
3. Check `autopilot-state.json` if it exists:
   - `"running"` -> **BLOCK**. Print: "Autopilot이 실행 중입니다. 먼저 /otterwise:autopilot-pause 또는 /otterwise:autopilot-abort를 실행하세요." Stop.
   - `"pause"` / `"abort"` / file does not exist -> proceed.
4. Glob `strategies/*.md` (top-level only). Parse frontmatter including `backtest:` block; rebuild graph from `## 관련 전략` wikilinks. When listing strategies, show PF and win_rate alongside phenomenon. Log dangling references.

If no strategies exist yet, this is the first expansion -- proceed with `seed` type.

## Phase: ROUTE (User Override)

Parse user input to determine expansion directive:

| User says | expansion_type | target |
|-----------|---------------|--------|
| "deepen X" / "improve X" | `derive` | X |
| "branch from X" / "explore beyond X" | `explore` | X |
| "combine X and Y" | `combine` | [X, Y] |
| "investigate {topic}" / no target | `seed` | -- |

Select **research mode** (one of 10): `brute_force`, `news_replay`, `condition_combo`, `anomaly_detection`, `copycat`, `narrative_shift`, `consensus_gap`, `supply_chain`, `regulatory`, `behavioral`.

Mode objectives (종가베팅-framed):

| Mode | OBSERVE Focus | LOOK Focus |
|------|---------------|------------|
| `brute_force` | 가격/거래량 극단값 | 해당 조건일 종가베팅 수익률 |
| `news_replay` | 뉴스 유형별 당일 반응 | 뉴스 발생일 종가베팅 수익률 |
| `condition_combo` | 복수 조건 동시 충족일 | 조건 조합일 종가베팅 수익률 |
| `anomaly_detection` | 통계적 이상치 탐지 | 이상치 발생일 종가베팅 수익률 |
| `copycat` | 검증 패턴 타종목 적용 | 타종목 패턴일 종가베팅 수익률 |
| `narrative_shift` | 기업 스토리 전환점 | 전환점 발생일 종가베팅 수익률 |
| `consensus_gap` | 컨센서스 vs 실제 괴리 | 괴리 발생일 종가베팅 수익률 |
| `supply_chain` | 업스트림 시그널 | 시그널일 하류 종목 종가베팅 수익률 |
| `regulatory` | 정책/규제 이벤트 | 이벤트일 섹터 종가베팅 수익률 |
| `behavioral` | 경영진 행동 패턴 | 패턴 발생일 종가베팅 수익률 |

**Diversity awareness**: review existing `strategies/*.md` mode distribution. Prefer underrepresented modes when the user's request doesn't imply a specific one.

For `derive`/`explore`/`combine`, inject parent strategy context (phenomenon, backtest results, limitations).

If user specifies a mode explicitly, use it. Pass routing directive inline to OBSERVE.

## OBSERVE

**Cycle ID** (generate before any file writes): `{id}` = `YYYYMMDD_HHMM_{8hex}`. Choose kebab-case `{name}` for the topic. Use `{id}_{name}` consistently for artifact folder AND strategy file this cycle.

Discover a phenomenon from data -- observation, not analysis. The goal is "어?" not "통계적 유의성".

1. **Teams API**: TeamCreate, 1 task, 1 researcher. Poll 5-min intervals, 15-min timeout.
2. **Researcher receives**: mode-specific objectives, dataset paths (prices + sources), existing strategy graph summary, parent context (for derive/combine).
3. **Output**: `.otterwise/artifacts/{id}_{name}/01_discovery.md`
   ```
   ## 현상         — observed event, natural language
   ## 데이터 근거   — which files/columns/rows, what was seen
   ## 종가베팅 가설  — why buying at close on this event might yield overnight profit
   ## 확인 필요 사항 — specific tickers/dates to check in LOOK
   ```
4. Shutdown researcher, delete team. Pass phenomenon to LOOK.

## LOOK

Researchers mark event dates and calculate overnight returns in parallel.

1. **Teams API**: TeamCreate, K tasks (default 3), K researchers in ONE message. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: phenomenon from OBSERVE, prices dataset path, assigned subset, mode context, fee rates from config.json.
3. **Overnight return calculation**:
   - Gross return: `(next_open - close) / close`
   - Net return: `gross_return - fee_pct/100` (stock: 0.24%, ETF: 0.04%)
   - Claude reads price data directly and does the math -- no backtest engine.
4. **Output per researcher**: event table + metrics for their subset.
5. **50%+ failure tolerance**: if majority fail, continue with available results.
6. **Synthesize** into `.otterwise/artifacts/{id}_{name}/02_evidence.md` and per-subset `02_evidence_{subset}.md`:
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
2. **Researcher receives**: JUDGE rationale, OBSERVE phenomenon, LOOK event table + aggregates, expansion type, related strategy names, dataset path.
3. **Output**: `.otterwise/strategies/{id}_{name}.md`:
   - YAML frontmatter: `id`, `type` (seed|derive|explore|combine), `status: draft`, `phenomenon`, `researchMode`, `tags`, `backtest:` block (tickers, period, trades, winners, losers, win_rate_pct, avg_return_pct, profit_factor, max_consecutive_losses, fee_applied_pct)
   - `## 관련 전략` -- `[[wikilinks]]` to related strategies, or "독립 전략 (seed)"
   - `## 현상` -- natural language event description
   - `## 이벤트 발생일 및 종가베팅 결과` -- event table (날짜, 종목, 이벤트, 종가, 익일시가, 수익률 -- net only)
   - `## 집계` -- plain-text aggregates matching frontmatter
   - `## 해석` -- why this phenomenon works for 종가베팅
   - `## 한계 및 주의사항` -- limitations
4. **Post-CRYSTALLIZE updates**:
   - If `autopilot.json` exists: append to `strategies[]` (`{ id, name, type, status, phenomenon, researchMode, backtest: { trades, win_rate_pct, profit_factor }, createdAt }`), increment `modeStats[mode]`, append mode to `lastModes[]` (keep last 10).
   - If `autopilot.json` does not exist: no JSON update needed.
5. Shutdown researcher, delete team. Report result to user.

## Teams API Lifecycle (Per Phase)

Each phase follows: **TeamCreate** (`"continue-{YYYYMMDD-HHMMSS}-{phase}-{name}"`) -> **TaskCreate** x K -> **Agent** x K (ALL in one message, `general-purpose`, `bypassPermissions`, `run_in_background: true`) -> **TaskList** poll (5-min intervals, phase-specific timeout; on timeout continue with available results) -> **Read** outputs -> **SendMessage** shutdown_request -> **TeamDelete** (1 retry on failure).

## Error Handling

| Error | Action |
|-------|--------|
| `.otterwise/` missing | Abort, tell user to run `/otterwise:research` first. |
| TeamCreate fails | Retry once. If still fails, log to `error.log`, abort cycle. |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | Abort, report to user. |
| Researcher crash (no output) | Log, exclude from synthesis. |
| TeamDelete fails | Retry once. Log and continue. |
| Phase timeout | Continue with available results, log warning. |
| JUDGE returns SKIP | Log verdict to `03_evaluation.md`, report to user, done. |
| Target strategy not found | Abort, list available strategies for user. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the cycle.
- One team per phase, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing -- serialize all outputs to disk.
- Strategy graph is reconstructed from frontmatter + wikilinks each cycle.
- Strategy names use kebab-case. Strategy IDs: `YYYYMMDD_HHMM_{8hex}`.
- All strategy content in Korean. Obsidian-compatible format (wikilinks, tags, callouts).
- Single cycle only -- no looping. For continuous research, use `/otterwise:autopilot`.
- **Cannot run while autopilot is running** -- blocks to prevent race conditions.
- No backtest engine -- Claude reads price data and calculates returns directly.
- No data format enforcement -- Claude reads whatever format the user provides.

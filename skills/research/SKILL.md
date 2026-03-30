---
name: research
description: Start a new investment research session — single OLJC cycle on a dataset
---

# /otterwise:research

Run one investment research cycle on a dataset. Discover a phenomenon (OBSERVE), verify it against price data (LOOK), judge its validity (JUDGE), and crystallize it into a strategy document (CRYSTALLIZE). You (the main Claude session) ARE the research lead -- do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:research /path/to/dataset "Optional investment goals"
```

Optional: specify research mode -- `/otterwise:research /path/to/dataset "goals" mode=news_replay`. Default: auto-selected in ROUTE.

## Workflow

```
INIT ──> ROUTE ──> OBSERVE ──> LOOK ──> JUDGE ──┬──> CRYSTALLIZE ──> done
                     │           │        │      │
                   Team×1    Team×K    inline    SKIP → log + done
                                                 Team×1
```

## Phase: INIT

1. Parse user input: dataset path, optional goals, optional mode override.
2. Create `.otterwise/` with subdirectories: `strategies/`, `strategies/look/`, `strategies/research-log/`, `strategies/discarded/`.
3. Write `config.json`: `{ dataset, goals, investmentMode: true }`.
4. Explore dataset inline (do NOT spawn agent): list files, read samples, identify data types (prices, financials, news, insider transactions), note quality issues.
5. Proceed to **ROUTE**.

If dataset missing/empty: abort with message to user.

## ROUTE

Select research mode -- auto or user-specified.

If user specified a mode, use it. Otherwise, reason about dataset contents (available data types, file structure) and user goals to pick the best fit.

**Research modes** (10):

| # | Mode | Description |
|---|------|-------------|
| 1 | `brute_force` | Indicator x condition enumeration |
| 2 | `news_replay` | News event price patterns |
| 3 | `condition_combo` | Combine weak signals into strong |
| 4 | `anomaly_detection` | Outlier → price reaction |
| 5 | `copycat` | Apply valid pattern to other stocks |
| 6 | `narrative_shift` | Corporate story change → price impact |
| 7 | `consensus_gap` | Market expectation vs reality gap |
| 8 | `supply_chain` | Upstream/downstream company signals |
| 9 | `regulatory` | Policy/regulation → sector impact |
| 10 | `behavioral` | Executive behavior patterns → signals |

Expansion type is always `seed` (new research, no existing graph). Pass routing directive (mode, focus area, priority data files) inline to OBSERVE.

## OBSERVE

Discover a phenomenon from data -- observation, not analysis. The goal is "어?" not "통계적 유의성".

1. **Teams API**: TeamCreate, 1 task, 1 researcher. Poll 5-min intervals, 15-min timeout.
2. **Researcher receives**: mode-specific objectives, dataset path, user goals. Key instruction: observe phenomena, do not hypothesize.
3. **Output**: `.otterwise/strategies/research-log/{name}-observe.md`
   ```
   ## 현상         — observed fact, no interpretation
   ## 데이터 근거   — file, column, row range where found
   ## 흥미로운 점   — why this stands out
   ## 확인 필요 사항 — specific questions for LOOK
   ```
4. Shutdown researcher, delete team. Pass phenomenon to LOOK.

## LOOK

Researchers verify the phenomenon against actual price behavior in parallel.

1. **Teams API**: TeamCreate, K tasks (default 3), K researchers in ONE message. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: phenomenon from OBSERVE, dataset path, assigned subset (time period/sector/stock group), mode context.
3. **Data evidence rules** -- researchers MUST:
   - Include `| 날짜 | 가격 | 이벤트 |` table for every case
   - Write each case as `### 사례 N: {종목} ({시기})`
   - Add `> [!data]- 원본 데이터` callout with source paths
   - Mark exceptions: `### ⚠️ 사례 N: {종목} (예외)` with interpretation
   - NO summary-only cases -- no table means no case
   - Use WebSearch/WebFetch for price validation; every claim needs `[source: URL or file]`
4. **50%+ failure tolerance**: if majority fail, continue with available results.
5. **Synthesize** into `.otterwise/strategies/look/{name}.md`:
   ```
   ## 현상 요약    — phenomenon from OBSERVE
   ## 사례 기록    — per-case sections with tables + source callouts
   ## 공통점       — repeated patterns across cases
   ## 갈림길       — conditions that lead to different outcomes
   ```
6. Shutdown researchers, delete team. Pass synthesized output to JUDGE.

## JUDGE

Team lead judges inline -- no agent spawn, no Teams API.

1. Read OBSERVE output and LOOK output in full.
2. Apply four criteria (reason through evidence, no numeric thresholds):
   - **일관성**: Do cases show a repeatable pattern?
   - **설명 가능성**: Can the phenomenon be reasonably explained?
   - **예외 해석**: Are exceptions understandable, not pattern-breaking?
   - **투자 유의미성**: Does this matter for investment decisions?
3. Decide: **WRITE** or **SKIP**. No middle ground.
4. Log to `.otterwise/strategies/research-log/{name}-judge.md`:
   ```
   ## 판정: {WRITE | SKIP}
   ## 근거
   - 일관성: {assessment}
   - 설명 가능성: {assessment}
   - 예외 해석: {assessment}
   - 투자 관점: {assessment}
   ## 사유
   {1-2 sentence rationale}
   ```
5. **WRITE** → proceed to CRYSTALLIZE. **SKIP** → log to `strategies/discarded/{name}.md`, report result to user, done.

## CRYSTALLIZE

Write the final strategy document in Obsidian-compatible format.

1. **Teams API**: TeamCreate, 1 task, 1 researcher. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: JUDGE rationale, OBSERVE phenomenon, LOOK case records (full), dataset path.
3. **Output**: `.otterwise/strategies/{name}.md` -- must pass `validate-strategy.sh`:
   - YAML frontmatter: `id` (YYYYMMDD_{8hex}), `type: seed` (always), `status: draft` (always), `phenomenon`, `researchMode`, `tags`, optional `observationPeriod` (include for time-series data, omit for snapshots)
   - `## 관련 전략` -- "독립 전략 (seed)" (no existing graph)
   - `## 현상` -- concise phenomenon with key numbers
   - `## 가격 관찰` -- summary table + per-case `| 날짜 | 가격 | 이벤트 |` tables + `> [!data]-` callouts + `⚠️` exceptions
   - `## 해석` -- analyst interpretation (not trading rules)
   - `## 전략 아이디어` -- investment monitoring approach
   - `## 한계 및 주의사항` -- limitations, sample size, exceptions
4. Shutdown researcher, delete team. Report result to user.

## Teams API Lifecycle (Per Phase)

Each phase follows: **TeamCreate** (`"research-{YYYYMMDD-HHMMSS}-{phase}-{name}"`) → **TaskCreate** x K → **Agent** x K (ALL in one message, `general-purpose`, `bypassPermissions`, `run_in_background: true`) → **TaskList** poll (5-min intervals, phase-specific timeout; on timeout continue with available results) → **Read** outputs → **SendMessage** shutdown_request → **TeamDelete** (1 retry on failure).

## State Management

### Directory Structure

```
.otterwise/
  config.json                          ← dataset, goals, investmentMode
  strategies/
    {name}.md                          ← CRYSTALLIZE output
    look/{name}.md                     ← LOOK case records
    research-log/{name}-observe.md     ← OBSERVE phenomenon
    research-log/{name}-judge.md       ← JUDGE decision
    discarded/{name}.md                ← SKIP decisions
```

### Strategy Frontmatter

```yaml
id: "YYYYMMDD_{8hex}"
type: seed                             # always seed for research (no derive/explore/combine)
status: draft                          # always draft (never skip to developing/established)
phenomenon: "one-line description"
researchMode: "mode_name"
observationPeriod: "YYYY-YYYY"         # optional — include for time-series, omit for snapshots
tags: [tag-1, tag-2]
```

Relationships via `[[wikilinks]]` in `## 관련 전략`. All strategy content in Korean.

## Error Handling

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, log to `error.log`, abort. |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | Abort with message to user. |
| Researcher crash (no output) | Log, exclude from synthesis. |
| TeamDelete fails | Retry once. Log and continue. |
| Phase timeout | Continue with available results, log warning. |
| JUDGE returns SKIP | Log to `discarded/`, report to user, done. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the cycle.
- One team per phase, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing -- serialize all outputs to disk.
- Strategy names use kebab-case. Strategy IDs: `YYYYMMDD_{8hex}`.
- Research runs once -- no loop, no resume. Each invocation starts fresh.
- No autopilot.json or autopilot-state.json -- research has no loop state.
- All strategy content in Korean. Obsidian-compatible format (wikilinks, tags, callouts).

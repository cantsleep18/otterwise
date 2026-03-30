---
name: autopilot
description: Run autonomous investment strategy research — OLJC loop that grows a strategy graph indefinitely
---

# /otterwise:autopilot

Run a fully autonomous investment research loop. Each cycle discovers a phenomenon (OBSERVE), verifies it against price data (LOOK), judges its validity (JUDGE), and crystallizes it into a strategy document (CRYSTALLIZE). An Adaptive Router selects the next research mode between cycles. The loop runs forever until the user aborts. You (the main Claude session) ARE the research lead -- do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:autopilot /path/to/dataset "Optional investment goals"
```

Re-running on an existing `.otterwise/` directory resumes from current state.

## Workflow

```
           ┌──────────────────────────────────────────────────────────────────┐
           v                                                                  │
INIT ──> ROUTE ──> OBSERVE ──> LOOK ──> JUDGE ──┬──> CRYSTALLIZE ──> ROUTE ──┘
 or                  │           │        │      │
RESUME             Team×1    Team×K    inline    SKIP → log + ROUTE
                                                       Team×1
```

## State Check (every phase)

Before each phase, read `autopilot-state.json`:
- `"running"` → proceed.
- `"pause"` → wait loop (re-read every 10 seconds until `"running"`).
- `"abort"` → set `autopilot.json` status to `"aborted"`, stop.

## Phase: INIT (no existing strategies)

1. Parse user input: dataset path, optional investment goals.
2. Create `.otterwise/` with subdirectories: `strategies/`, `artifacts/look/`, `artifacts/research-log/`, `artifacts/discarded/`.
3. Write `config.json` (`dataset`, `goals`, `investmentMode: true`), `autopilot.json` (`status: "running"`, empty `strategies[]`, `modeStats`, `lastModes`, `cooldown`), `autopilot-state.json` (`command: "running"`).
4. Explore dataset inline (do NOT spawn agent): list files, read samples, identify data types (prices, financials, news, insider transactions), note quality issues.
5. Proceed to **ROUTE**.

If dataset missing/empty: abort. If `.otterwise/strategies/` already has `.md` files: switch to RESUME.

## Phase: RESUME (existing strategies found)

1. Glob `.otterwise/strategies/*.md` (top-level only). Parse frontmatter; delete files missing required fields (`id`, `type`, `status`, `phenomenon`, `researchMode`), log each deletion.
2. Rebuild strategy graph from `## 관련 전략` wikilinks. Log dangling references.
3. Sync `autopilot.json`: rebuild `strategies[]` from frontmatter, recalculate `modeStats`, rebuild `lastModes` from timestamps (last 5). Set `autopilot-state.json` to `"running"`.
4. Read `config.json` for dataset path. Proceed to **ROUTE**.

If all files incomplete: fresh start (INIT step 4). If `config.json` missing: abort.

## ROUTE (Adaptive Router)

State check. Then glob `strategies/*.md` and read `autopilot.json` (`modeStats`, `lastModes`).

Reason about the current state -- this is qualitative judgment, not a formula:

**Inputs**: graph coverage (strategies per mode, status distribution, unexplored modes), recent flow (`lastModes`), data availability (which data files support which modes), existing findings (draft strategies needing verification, established strategies open for derivation/combination).

**Decide three things**:

1. **Research mode** (one of 10):

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

2. **Expansion type**: `seed` (new, independent), `derive` (improve existing strategy), `explore` (inspired by existing, different area), `combine` (merge 2+ strategy insights). Specify target strategy IDs for derive/explore/combine.

3. **Focus area**: specific phenomenon to investigate, priority data files.

**Diversity rule**: if `lastModes` has 3 consecutive identical modes, force a different mode. Log the override.

Pass routing directive (mode, expansion type, targets, focus) inline to OBSERVE. Do not persist to a file.

## OBSERVE

State check. Discover a phenomenon from data -- observation, not analysis. The goal is "어?" not "통계적 유의성".

1. **Teams API**: TeamCreate `"autopilot-{YYYYMMDD-HHMMSS}-observe-{name}"`, 1 task, 1 researcher. Poll 5-min intervals, 15-min timeout.
2. **Researcher receives**: mode-specific objectives (see Mode Objectives below), dataset path, existing strategy graph summary, parent context (for derive/combine). Key instruction: observe phenomena, do not hypothesize.
3. **Output**: `.otterwise/artifacts/research-log/{name}-observe.md`
   ```
   ## 현상         — observed fact, no interpretation
   ## 데이터 근거   — file, column, row range where found
   ## 흥미로운 점   — why this stands out
   ## 확인 필요 사항 — specific questions for LOOK
   ```
4. Shutdown researcher, delete team. Pass phenomenon to LOOK.

## LOOK

State check. Researchers verify the phenomenon against actual price behavior in parallel.

1. **Teams API**: TeamCreate `"autopilot-{YYYYMMDD-HHMMSS}-look-{name}"`, K tasks (default 3), K researchers in ONE message. Poll 5-min intervals, 10-min timeout per researcher.
2. **Researcher receives**: phenomenon from OBSERVE, dataset path, assigned subset (time period/sector/stock group), mode context (see Mode Objectives below).
3. **Data evidence rules** -- researchers MUST:
   - Include `| 날짜 | 가격 | 이벤트 |` table for every case
   - Write each case as `### 사례 N: {종목} ({시기})`
   - Add `> [!data]- 원본 데이터` callout with source paths
   - Mark exceptions: `### ⚠️ 사례 N: {종목} (예외)` with interpretation
   - NO summary-only cases -- no table means no case
   - Use WebSearch/WebFetch for price validation; every claim needs `[source: URL or file]`
4. **50%+ failure tolerance**: if majority fail, continue with available results.
5. **Synthesize** researcher outputs into `.otterwise/artifacts/look/{name}.md`:
   ```
   ## 현상 요약    — phenomenon from OBSERVE
   ## 사례 기록    — per-case sections with tables + source callouts
   ## 공통점       — repeated patterns across cases
   ## 갈림길       — conditions that lead to different outcomes
   ```
6. Shutdown researchers, delete team. Pass synthesized output to JUDGE.

## JUDGE

State check. Team lead judges inline -- no agent spawn, no Teams API.

1. Read OBSERVE output and LOOK output in full.
2. Apply four criteria (no numeric thresholds -- reason through the evidence):
   - **일관성**: Do cases show a repeatable pattern?
   - **설명 가능성**: Can the phenomenon be reasonably explained?
   - **예외 해석**: Are exceptions understandable, not pattern-breaking?
   - **투자 유의미성**: Does this matter for investment decisions?
3. Decide: **WRITE** or **SKIP**. No middle ground.
4. Log to `.otterwise/artifacts/research-log/{name}-judge.md`:
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
5. **WRITE** → proceed to CRYSTALLIZE. **SKIP** → log to `artifacts/discarded/{name}.md`, return to ROUTE.

## CRYSTALLIZE

State check. Write the final strategy document in Obsidian-compatible format.

1. **Teams API**: TeamCreate `"autopilot-{YYYYMMDD-HHMMSS}-crystallize-{name}"`, 1 task, 1 researcher. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: JUDGE rationale, OBSERVE phenomenon, LOOK case records (full), expansion type, related strategy names, dataset path.
3. **Output**: `.otterwise/strategies/{name}.md` with this exact structure:
   - YAML frontmatter: `id` (YYYYMMDD_{8hex}), `type`, `status: draft`, `phenomenon`, `dataUsed`, `observationPeriod`, `researchMode`, `tags`
   - `# {전략 제목}`
   - `## 관련 전략` -- `[[wikilinks]]` to related strategies, or "독립 전략 (seed)"
   - `## 현상` -- concise phenomenon with key numbers
   - `## 가격 관찰` -- summary comparison table + per-case sections with `| 날짜 | 가격 | 이벤트 |` tables + `> [!data]-` callouts + `⚠️` exception cases
   - `## 해석` -- analyst interpretation (not trading rules)
   - `## 전략 아이디어` -- how to use this for investment (monitoring approach, not trading rules)
   - `## 한계 및 주의사항` -- limitations, sample size, exceptions
4. **Post-CRYSTALLIZE** updates to `autopilot.json`:
   - Append to `strategies[]`: `{ id, name, type, status: "draft", phenomenon, researchMode, createdAt }`
   - Increment `modeStats[mode]`
   - Append mode to `lastModes[]` (keep last 10; trim oldest if over 10)
5. Shutdown researcher, delete team.
6. **Return to ROUTE** -- infinite loop continues.

## Mode Objectives

Each mode injects specific objectives into OBSERVE and LOOK researcher prompts. OBSERVE objectives focus on phenomenon discovery; LOOK objectives focus on historical case verification with data tables.

| Mode | OBSERVE Focus | LOOK Focus |
|------|--------------|------------|
| `brute_force` | Scan numeric columns for extreme-condition price anomalies | Table all cases matching the indicator condition with before/after prices |
| `news_replay` | Classify news events and observe pre/post price patterns | Table all events in the category with event-day and +5/+20 day prices |
| `condition_combo` | Test if two conditions together produce different price behavior | Table dual-condition cases vs single-condition control groups |
| `anomaly_detection` | Find outliers and observe post-anomaly price reactions | Table all same-type anomalies with magnitude and +10/+30/+60 day prices |
| `copycat` | Apply existing pattern to new stocks/sectors | Table original vs new-stock cases side by side |
| `narrative_shift` | Find corporate story change points and price transitions | Table narrative shifts with announcement/recognition/stabilization dates |
| `consensus_gap` | Find expectation-vs-reality gaps and price adjustments | Table all gaps with expected/actual values and +20/+60 day prices |
| `supply_chain` | Find upstream/downstream signals preceding target price moves | Table supply chain events with time lag to target price reaction |
| `regulatory` | Find policy events and sector-wide price impacts | Table regulation events with per-stock sector reactions |
| `behavioral` | Find executive behavior patterns preceding price moves | Table executive actions with +30/+60/+90 day prices |

For `derive`/`explore`/`combine`, also inject parent strategy context (phenomenon, limitations, findings) into the prompt.

## Teams API Lifecycle (Per Phase)

Each phase follows: **TeamCreate** (`"autopilot-{YYYYMMDD-HHMMSS}-{phase}-{name}"`) → **TaskCreate** x K → **Agent** x K (ALL in one message, `general-purpose`, `bypassPermissions`, `run_in_background: true`) → **TaskList** poll (5-min intervals, phase-specific timeout; on timeout continue with available results) → **Read** outputs (if completed but no output: log, exclude) → **SendMessage** shutdown_request → **TeamDelete** (1 retry on failure).

## State Management

### Directory Structure

```
.otterwise/
  config.json                          ← dataset, goals, investmentMode (immutable)
  autopilot.json                       ← status, strategies[], modeStats, lastModes, cooldown
  autopilot-state.json                 ← user control: running/pause/abort
  error.log
  strategies/
    {name}.md                          ← CRYSTALLIZE output (Obsidian vault — graph source of truth)
  artifacts/
    look/{name}.md                     ← LOOK case records (synthesis + researcher outputs)
    research-log/{name}-observe.md     ← OBSERVE phenomenon
    research-log/{name}-judge.md       ← JUDGE decision
    discarded/{name}.md                ← SKIP decisions
```

### Strategy Frontmatter

```yaml
id: "YYYYMMDD_{8hex}"              # type: seed|derive|explore|combine
status: draft|developing|established|archived
phenomenon: "one-line"             # researchMode: "brute_force"
dataUsed: ["prices"]               # observationPeriod: "YYYY-YYYY"
tags: [tag-1, tag-2]
```

Relationships via `[[wikilinks]]` in `## 관련 전략`, not frontmatter. Graph reconstructed each cycle.

### autopilot.json

`strategies[]` entries: `{ id, name, type, status, phenomenon, researchMode, createdAt }`. Top-level: `status` ("running"/"aborted"), `modeStats` ({mode: count}), `lastModes` (last 10), `cooldown` ([{candidateId, consecutiveFailures, lastFailedAt}]).

## Error Handling

| Error | Action |
|-------|--------|
| TeamCreate fails | Retry once. If still fails, log to `error.log`, skip this cycle, return to ROUTE. |
| >50% researchers fail | Continue with available results. Log warning. |
| Dataset unavailable | Set status `"aborted"`, stop. |
| Researcher crash (completed but no output) | Log, exclude from synthesis. |
| TeamDelete fails | Retry once. Log and continue. |
| Phase timeout | Continue with available results, log warning. |
| JUDGE returns SKIP | Log reason to `discarded/`, return to ROUTE. |
| Candidate in cooldown (3+ failures) | Skip, select next in ROUTE. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the loop.
- One team per phase per cycle, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing -- serialize all outputs to disk.
- The strategy graph is reconstructed from frontmatter + wikilinks each cycle.
- Strategy names use kebab-case. Strategy IDs: `YYYYMMDD_{8hex}`.
- The loop never self-terminates. Only user abort stops it.
- Re-running `/autopilot` on an existing `.otterwise/` directory is the resume mechanism.
- All strategy content in Korean. Obsidian-compatible format (wikilinks, tags, callouts).

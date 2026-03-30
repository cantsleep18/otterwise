---
name: continue
description: Expand the strategy graph with a user-directed OLJC cycle
---

# /otterwise:continue

Run a single user-directed OLJC cycle to expand the strategy graph. You (the main Claude session) ARE the research lead — do NOT delegate leadership to a sub-agent.

## Usage

```
/otterwise:continue "deepen insider-signal-pattern"
/otterwise:continue "branch from earnings-gap-analysis"
/otterwise:continue "combine insider-signal-pattern and earnings-gap-analysis"
/otterwise:continue "investigate regulatory impact on semiconductors"
```

## Workflow

```
LOAD ──> ROUTE (user override) ──> OBSERVE ──> LOOK ──> JUDGE ──┬──> CRYSTALLIZE
                                     │           │        │      │
                                   Team×1     Team×K    inline   SKIP → log + done
                                                                 Team×1
```

Single cycle — runs once, then reports result.

## Phase: LOAD

1. Verify `.otterwise/` exists with `config.json`. If missing: abort with setup instructions.
2. Read `config.json` for dataset path and goals.
3. Check `autopilot-state.json` if it exists:
   - `"running"` → **BLOCK**. Print: "Autopilot이 실행 중입니다. 먼저 /otterwise:autopilot-pause 또는 /otterwise:autopilot-abort를 실행하세요." Stop.
   - `"pause"` → proceed (manual continue is allowed while autopilot is paused).
   - `"abort"` → proceed (manual continue is allowed after autopilot abort).
   - File does not exist → proceed.
4. Glob `strategies/*.md` (top-level only). Parse frontmatter; rebuild graph from `## 관련 전략` wikilinks. Log dangling references.

If no strategies exist yet, this is the first expansion — proceed with `seed` type.

## Phase: ROUTE (User Override)

Parse user input to determine expansion directive:

| User says | expansion_type | target |
|-----------|---------------|--------|
| "deepen X" / "improve X" | `derive` | X |
| "branch from X" / "explore beyond X" | `explore` | X |
| "combine X and Y" | `combine` | [X, Y] |
| "investigate {topic}" / no target | `seed` | — |

Select **research mode** (one of 10): `brute_force`, `news_replay`, `condition_combo`, `anomaly_detection`, `copycat`, `narrative_shift`, `consensus_gap`, `supply_chain`, `regulatory`, `behavioral`.

**Inputs for mode selection**: graph coverage (strategies per mode, unexplored modes), existing findings, data availability, user's topic hint.

**Diversity awareness**: review existing `strategies/*.md` mode distribution. Prefer underrepresented modes when the user's request doesn't imply a specific one.

If user specifies a mode explicitly, use it. Pass routing directive (mode, expansion type, targets, focus) inline to OBSERVE.

## Phase: OBSERVE

Discover a phenomenon from data — observation, not analysis. The goal is "어?" not "통계적 유의성".

1. **Teams API**: TeamCreate `"continue-{YYYYMMDD-HHMMSS}-observe-{name}"`, 1 task, 1 researcher. Poll 5-min intervals, 15-min timeout.
2. **Researcher receives**: mode-specific objectives (see autopilot Mode Objectives table), dataset path, existing strategy graph summary, parent context (for derive/combine).
3. **Output**: `.otterwise/artifacts/research-log/{name}-observe.md`
   ```
   ## 현상         — observed fact, no interpretation
   ## 데이터 근거   — file, column, row range where found
   ## 흥미로운 점   — why this stands out
   ## 확인 필요 사항 — specific questions for LOOK
   ```
4. Shutdown researcher, delete team. Pass phenomenon to LOOK.

## Phase: LOOK

Researchers verify the phenomenon against actual price behavior in parallel.

1. **Teams API**: TeamCreate `"continue-{YYYYMMDD-HHMMSS}-look-{name}"`, K tasks (default 3), K researchers in ONE message. Poll 5-min intervals, 10-min timeout per researcher.
2. **Researcher receives**: phenomenon from OBSERVE, dataset path, assigned subset (time period/sector/stock group), mode context.
3. **Data evidence rules** — researchers MUST:
   - Include `| 날짜 | 가격 | 이벤트 |` table for every case
   - Write each case as `### 사례 N: {종목} ({시기})`
   - Add `> [!data]- 원본 데이터` callout with source paths
   - Mark exceptions: `### ⚠️ 사례 N: {종목} (예외)` with interpretation
   - NO summary-only cases — no table means no case
   - Use WebSearch/WebFetch for price validation; every claim needs `[source: URL or file]`
4. **50%+ failure tolerance**: if majority fail, continue with available results.
5. **Synthesize** into `.otterwise/artifacts/look/{name}.md`:
   ```
   ## 현상 요약    — phenomenon from OBSERVE
   ## 사례 기록    — per-case sections with tables + source callouts
   ## 공통점       — repeated patterns across cases
   ## 갈림길       — conditions that lead to different outcomes
   ```
6. Shutdown researchers, delete team. Pass synthesized output to JUDGE.

## Phase: JUDGE

Team lead judges inline — no agent spawn, no Teams API.

1. Read OBSERVE output and LOOK output in full.
2. Apply four criteria (reason through the evidence, no numeric thresholds):
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
5. **WRITE** → proceed to CRYSTALLIZE. **SKIP** → log to `artifacts/discarded/{name}.md`, report result to user, done.

## Phase: CRYSTALLIZE

Write the final strategy document in Obsidian-compatible format.

1. **Teams API**: TeamCreate `"continue-{YYYYMMDD-HHMMSS}-crystallize-{name}"`, 1 task, 1 researcher. Poll 5-min intervals, 10-min timeout.
2. **Researcher receives**: JUDGE rationale, OBSERVE phenomenon, LOOK case records (full), expansion type, related strategy names, dataset path.
3. **Output**: `.otterwise/strategies/{name}.md` with this exact structure:
   - YAML frontmatter: `id` (YYYYMMDD_{8hex}), `type` (seed|derive|explore|combine), `status: draft`, `phenomenon`, `dataUsed`, `observationPeriod`, `researchMode`, `tags`
   - `# {전략 제목}`
   - `## 관련 전략` — `[[wikilinks]]` to related strategies, or "독립 전략 (seed)"
   - `## 현상` — concise phenomenon with key numbers
   - `## 가격 관찰` — summary table + per-case `| 날짜 | 가격 | 이벤트 |` tables + `> [!data]-` callouts + `⚠️` exceptions
   - `## 해석` — analyst interpretation (not trading rules)
   - `## 전략 아이디어` — how to use for investment (monitoring approach, not trading rules)
   - `## 한계 및 주의사항` — limitations, sample size, exceptions
4. **Post-CRYSTALLIZE updates**:
   - If `autopilot.json` exists: append to `strategies[]` (`{ id, name, type, status: "draft", phenomenon, researchMode, createdAt }`), increment `modeStats[mode]`, append mode to `lastModes[]` (keep last 10).
   - If `autopilot.json` does not exist: no JSON update needed.
5. Shutdown researcher, delete team. Report result to user.

## Teams API Lifecycle (Per Phase)

Each phase follows: **TeamCreate** (`"continue-{YYYYMMDD-HHMMSS}-{phase}-{name}"`) → **TaskCreate** x K → **Agent** x K (ALL in one message, `general-purpose`, `bypassPermissions`, `run_in_background: true`) → **TaskList** poll (5-min intervals, phase-specific timeout; on timeout continue with available results) → **Read** outputs (if completed but no output: log, exclude) → **SendMessage** shutdown_request → **TeamDelete** (1 retry on failure).

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
| JUDGE returns SKIP | Log to `discarded/`, report to user, done. |
| Target strategy not found | Abort, list available strategies for user. |

## Important Rules

- You are the team lead. Do NOT spawn a sub-agent to run the cycle.
- One team per phase, destroyed after result collection.
- All Agent calls in a single message for true parallel execution.
- No implicit state sharing — serialize all outputs to disk.
- Strategy graph is reconstructed from frontmatter + wikilinks each cycle.
- Strategy names use kebab-case. Strategy IDs: `YYYYMMDD_{8hex}`.
- All strategy content in Korean. Obsidian-compatible format (wikilinks, tags, callouts).
- Single cycle only — no looping. For continuous research, use `/otterwise:autopilot`.
- **Cannot run while autopilot is running** — blocks to prevent race conditions with parallel Teams API calls and competing strategy writes. Only allowed when autopilot is paused, aborted, or not active.

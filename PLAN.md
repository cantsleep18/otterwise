# Otterwise Investment — 설계 계획

기존 Otterwise 자율 리서치 엔진을 투자 전략 탐색에 특화시킨 확장.
인간 애널리스트의 관찰 행위를 자동화한다 — 데이터를 읽고, 현상을 포착하고, 가격 변화를 확인하고, 해석을 글로 남긴다.
출력물은 **내러티브 전략 파일** — 실 데이터 관찰에 근거한 정성적 투자 테시스(`.md`).

> **data-driven reasoning**: 실제 데이터 → 실제 가격 행동 → 해석. 이 순서를 반드시 지킨다.

---

## 1. 아키텍처

### 핵심 원칙

1. **데이터 파이프라인 없음** — 프로젝트 디렉토리의 파일을 있는 그대로 사용한다.
2. **전략 = 그래프 노드** — 각 전략은 DAG의 노드. 파생·탐색·교차조합이 자유롭게 발생한다.
3. **기존 인프라 위에 구축** — EVALUATE/EXPAND를 OLJC로 교체하되, Teams API·상태관리·에러처리는 유지.

### 변경 범위

| 구성 요소 | 상태 | 설명 |
|-----------|------|------|
| Teams API 라이프사이클 | **유지** | TeamCreate → Agent×K → poll → TeamDelete |
| `autopilot-state.json` | **유지** | running/pause/abort 제어 |
| hooks, validate 스크립트 | **유지** | 기존 동작 동일 |
| 대시보드 | **제거** | Obsidian 그래프 뷰로 대체 |
| 루프 로직 | **변경** | EVALUATE/EXPAND → OLJC |
| 노드 의미론 | **변경** | 리서치 노드 → 전략 노드 (내러티브 기반) |
| 리서처 프롬프트 | **변경** | 현상 관찰·가격 변화 해석 특화 |
| 후보 선정 | **변경** | 데이터 근거 기반 필터링 + 적응형 라우팅 |
| `config.json` | **확장** | 투자 모드 플래그, 전략 파라미터 추가 |
| 전략 출력 | **확장** | Obsidian 호환 포맷 — wikilinks, 태그, Dataview |

### 시스템 흐름

```
사용자 데이터 → /otterwise:autopilot (투자 모드)
  └─ OLJC 루프 (무한)
       OBSERVE → LOOK → JUDGE → CRYSTALLIZE → ROUTE → OBSERVE ...
                                                ↑
                                       autopilot-state.json (pause/abort)
출력: .otterwise/strategies/*.md (Obsidian vault)
```

---

## 2. 관찰 루프 (OBSERVE → LOOK → JUDGE → CRYSTALLIZE)

### OBSERVE (2-15분)

데이터를 읽고 흥미로운 현상을 발견한다. 통계가 아니라 관찰이다. Claude는 사람이 재무제표를 훑으며 "어?" 하는 순간을 재현한다 — 임계값도 공식도 없다.

- **입력**: 프로젝트 데이터 파일 + 기존 그래프 노드 + Router 지시
- **출력**: 현상 기술서 (가설이 아닌 관찰 기록)
- **Teams API**: 리서처 1명

### LOOK (2-10분)

현상의 과거 사례들을 찾아 실제 가격 움직임을 하나씩 살펴본다. 모든 사례는 실제 데이터 테이블과 함께 기록한다 — 산문 요약만으로는 불충분하다.

- **입력**: 현상 기술서 + 원본 데이터
- **출력**: `look/{name}.md` — 사례별 서술 기록 + 공통점·갈림길
- **Teams API**: 리서처 K명(기본 3) 병렬. 50% 이상 실패해도 가용 결과로 진행.

### JUDGE (<2분)

팀 리드가 직접 판단한다 — 에이전트 spawn 불필요.

**판단 기준** (수치 임계값 없음): 일관성, 설명 가능성, 예외 해석, 투자 관점 유의미성.

**판정**: WRITE(전략 작성) 또는 SKIP(사유 기록 후 Router 복귀). 중간 판정 없음.

### CRYSTALLIZE (5-10분)

관찰·확인·판단을 하나의 전략 문서로 결정(結晶)한다. 트레이딩 룰이 아니라 애널리스트 메모처럼 쓴다. Obsidian 호환 포맷(wikilinks, 태그, callout)으로 작성.

- **입력**: JUDGE 판단 + OBSERVE/LOOK 원본 데이터
- **출력**: `.otterwise/strategies/{name}.md`
- **Teams API**: 리서처 1명

### 페이즈 전환

매 페이즈 시작 전 `autopilot-state.json` 확인: running → 진행, pause → 대기 루프, abort → 즉시 중단.

---

## 3. 전략 = 그래프 노드

### 전략 파일 위치

```
.otterwise/strategies/
  insider-buying-after-dip.md      ← name 필드가 파일명
  ceo-change-price-impact.md
  look/                            ← LOOK 사례 기록
  research-log/                    ← 리서치 과정 로그
```

### Frontmatter

```yaml
---
id: "20260320_f3a1b7c2"          # YYYYMMDD_{8hex}, 메타데이터 전용
type: seed | derive | explore | combine
status: draft | developing | established | archived
phenomenon: "one-line summary"
dataUsed: ["prices", "financials", "news"]
observationPeriod: "2024-2025"
researchMode: "brute_force"
tags: [insider-trading, mean-reversion, kospi]
---
```

- `parentIds` 없음 — 부모 관계는 본문 `## 관련 전략`의 `[[wikilink]]`로 표현
- 모든 frontmatter 필드는 Obsidian Dataview로 쿼리 가능

### 본문 구조

`## 관련 전략` → `## 현상` → `## 가격 관찰` (사례별 데이터 테이블) → `## 해석` → `## 전략 아이디어` → `## 한계 및 주의사항`

### 데이터 근거 규칙

전략 `.md`는 원본 데이터 파일 없이도 독립적으로 읽을 수 있어야 한다.

1. **데이터 테이블 필수** — 모든 가격 관찰에 날짜, 가격, 이벤트 테이블을 포함한다.
2. **사례별 독립 섹션** — `### 사례 N: 종목명 (시기)` 형식. 각 사례는 자체 테이블과 서술.
3. **출처 표시** — 각 테이블 아래 `> [!data]- 원본 데이터` callout으로 출처 기록.
4. **예외 ⚠️ 표시** — 패턴 이탈 사례는 `### ⚠️ 사례 N: 종목명 (예외)` 형식 + 해석.
5. **대조군 비교** — 대조군이 있으면 비교 요약 테이블 포함.

### 4가지 확장 타입

| 타입 | 관련 전략 | 설명 |
|------|----------|------|
| `seed` | 없음 | 새 관찰에서 시작. 독립적 전략. |
| `derive` | `[[부모]]` 1개 | 기존 전략의 조건 변형/추가/제거 |
| `explore` | `[[참조]]` + 자유 영감 | 기존 발견에서 영감, 다른 영역 탐색 |
| `combine` | `[[A]]`, `[[B]]`, ... | 복수 전략의 관찰을 합쳐 새 전략 |

부모/참조 관계는 `## 관련 전략` 섹션의 `[[wikilink]]`로 표현. Obsidian 그래프 뷰에서 자동 엣지 생성.

### Obsidian 활용

| 기능 | 활용 |
|------|------|
| 파일명 | `{name}.md` (예: `insider-buying-after-dip.md`) |
| 그래프 뷰 | `[[wikilink]]`가 엣지를 형성하여 전략 DAG 시각화 |
| 백링크 | 자신을 참조하는 파생/교차 전략 자동 추적 |
| 태그 검색 | frontmatter `tags:` 배열로 모드별, 상태별 필터링 |
| Dataview | frontmatter 필드 기반 테이블/필터 쿼리 |
| 출처 callout | `> [!data]- 원본 데이터` (기본 접힘) |

### 생명주기

`draft` → `developing` → `established` → `archived`

| 전환 | 판단 기준 |
|------|-----------|
| draft → developing | 추가 사례에서 비슷한 가격 행동 재확인. 반복 가능한 패턴의 조짐. |
| developing → established | 다양한 맥락에서 일관성 확인. 예외 설명 가능. 파생·교차 관찰이 뒷받침. |
| any → archived | 패턴 소실, 시장 구조 변화, 또는 상위 전략이 흡수·대체. |

모든 타입은 `draft`에서 시작. `combine`은 부모 중 하나가 `archived`되면 근거 유효성을 재검토한다.

---

## 4. Adaptive Router

CRYSTALLIZE 완료 후 다음 사이클의 방향을 결정한다. 수식이 아니라 Claude가 현재 상태를 읽고 추론한다.

### 10가지 리서치 모드

| # | 모드 | 적합 상황 |
|---|------|----------|
| 1 | Brute Force | 초기 탐색, 지표×조건 열거 |
| 2 | News Replay | 뉴스 이벤트별 가격 패턴 |
| 3 | Condition Combo | 약한 시그널 조합으로 강한 시그널 |
| 4 | Anomaly Detection | 이상치 후 가격 반응 |
| 5 | Copycat | 유효 패턴을 다종목에 적용 |
| 6 | Narrative Shift | 기업 스토리 변화 → 가격 영향 |
| 7 | Consensus Gap | 시장 기대 vs 실제 괴리 |
| 8 | Supply Chain | 상류/하류 기업 시그널 |
| 9 | Regulatory | 정책/규제 → 섹터 영향 |
| 10 | Behavioral | 경영진 행동 패턴 → 시그널 |

### 라우팅 기준

- **그래프 현황** — 모드별 전략 분포, 미탐색 모드
- **최근 흐름** — 직전 사이클 결과
- **데이터 가용성** — 프로젝트 데이터가 해당 모드를 뒷받침하는가
- **다양성** — 동일 모드 3회 연속 불가. `autopilot.json`의 `modeStats`/`lastModes`로 추적.

### 확장 타입 결정

| 타입 | 판단 기준 |
|------|----------|
| `seed` | 새 모드, 기존 전략과 독립적일 때 |
| `derive` | 개선 가능한 기존 전략이 있고 같은 모드일 때 |
| `explore` | 기존 발견에서 영감, 완전히 다른 영역일 때 |
| `combine` | 서로 다른 전략의 인사이트를 합칠 수 있을 때 |

---

## 5. 대시보드 제거

Obsidian이 대시보드의 모든 기능을 대체한다.

| 기존 대시보드 기능 | Obsidian 대체 |
|-------------------|--------------|
| 전략 그래프 시각화 | Graph view — wikilink 기반 DAG 자동 생성 |
| 전략 목록/필터 | Dataview 쿼리 — status, type, tags 기반 테이블 |
| 마크다운 렌더링 | Obsidian 네이티브 마크다운 + callout |
| 관계 탐색 | Backlinks 패널 — 양방향 참조 자동 추적 |

### 제거 대상

- `dashboard/` — 전체 삭제 (React 앱, node_modules, 설정 파일)
- `skills/dashboard/SKILL.md` — 대시보드 스킬 정의
- `plugin.json` — keywords에서 `"visualization"` 제거
- `marketplace.json` — 대시보드 관련 tags 정리
- `CLAUDE.md` — skills 목록, 프로젝트 구조에서 dashboard 제거

---

## 6. 구현 우선순위

**Phase A: 코어 루프** — OLJC 관찰 루프 구현 + autopilot-state.json 상태 관리 + Teams API 오케스트레이션.

**Phase B: Router 통합** — 10가지 연구 모드 라우팅 + 다양성 강제.

**Phase C: 생명주기 관리** — 전략 상태 전환 (draft → developing → established → archived).

**Phase D: 대시보드 제거 + Obsidian vault 설정** — 위 제거 계획 실행 + flat `.md` 구조 + wikilink/tags/Dataview 컨벤션 적용.

**Phase E: 기존 기능 정리** — 불필요한 hooks, scripts, 레거시 코드 정리 + 버전 업데이트.

---

## 전략 예시

구체적인 전략 노드 예시는 [EXAMPLES.md](EXAMPLES.md) 참조.

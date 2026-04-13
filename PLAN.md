# Otterwise -- 종가베팅 전략 리서치 설계

종가베팅(종가 매수 → 익일 시가 매도) 전략을 자율 탐색하는 Claude Code 플러그인.
이벤트를 발견하고, 백테스트하고, 전략 문서로 결정(結晶)한다.

> **core loop**: 이벤트 발견 → 종가베팅 백테스트 → 정량 판단 → 전략 문서화

---

## 1. 종가베팅이란

종가에 매수하고 익일 시가에 매도하는 오버나이트 전략.

- **gross 수익률**: `(익일시가 - 종가) / 종가`
- **net 수익률**: `gross - fee`
- **fee**: 주식 0.24% (거래세 0.20% + 수수료), ETF 0.04% (config.json에서 설정)

모든 전략은 이 구조로 백테스트된다. Claude가 직접 계산한다 -- 별도 엔진 없음.

---

## 2. OLJC 관찰 루프

### OBSERVE -- 현상 발견

데이터를 읽고 종가베팅에 유리할 수 있는 이벤트를 발견한다.

- 입력: 데이터셋(prices + sources) + 기존 그래프 + Router 지시
- 출력: `artifacts/{id}_{name}/01_discovery.md` -- 현상, 데이터 근거, 종가베팅 가설, 확인 사항
- Teams API: 리서처 1명

### LOOK -- 이벤트 마킹 + 종가베팅 백테스트

이벤트 발생일을 마킹하고 종가베팅 수익률을 계산한다.

- 입력: OBSERVE 현상 + 가격 데이터
- 출력: `artifacts/{id}_{name}/02_evidence.md` -- 이벤트 테이블 + 집계 메트릭
- Teams API: 리서처 K명(기본 3) 병렬, 서브셋별 분담
- 이벤트 테이블 컬럼: 날짜, 종목, 이벤트, 종가, 익일시가, gross수익률, fee, net수익률

### JUDGE -- 유효성 판단

백테스트 결과를 보고 전략 작성 여부를 결정한다. 팀 리드가 직접 판단.

- 정량 게이트 (모두 통과해야 WRITE):
  - `profit_factor > 1.5`
  - `avg_return_pct > 0` (fee 차감 후 양수)
  - 충분한 거래 횟수 (10회 이상 권장)
- 보조 지표 (정보용): win_rate_pct, max_consecutive_losses
- 정성 판단: 설명 가능성, 반복 가능성
- 판정: WRITE 또는 SKIP

### CRYSTALLIZE -- 전략 문서화

관찰, 백테스트, 판단을 하나의 전략 문서로 결정(結晶)한다.

- 출력: `.otterwise/strategies/{id}_{name}.md`
- Teams API: 리서처 1명

---

## 3. 전략 문서 형식

### Frontmatter

```yaml
---
id: "YYYYMMDD_HHMM_{8hex}"
type: seed                           # seed | derive | explore | combine
status: draft                        # draft | developing | established | archived
phenomenon: "one-line event description"
researchMode: "news_replay"          # 10가지 모드 중 하나
tags: [tag1, tag2]
backtest:
  tickers: ["005930", "000660"]
  period: "2020-01 ~ 2026-03"
  trades: 41
  winners: 27
  losers: 14
  win_rate_pct: 65.9
  avg_return_pct: 0.52
  profit_factor: 2.13
  max_consecutive_losses: 3
  fee_applied_pct: 0.24
---
```

### Body Sections (순서대로)

```markdown
## 관련 전략
## 현상
## 이벤트 발생일 및 종가베팅 결과
| 날짜 | 종목 | 이벤트 | 종가 | 익일시가 | 수익률 |
## 집계
## 해석
## 한계 및 주의사항
```

---

## 4. 확장 타입

| 타입 | 관련 전략 | 설명 |
|------|----------|------|
| `seed` | 없음 | 새 관찰에서 시작. 독립 전략. |
| `derive` | `[[부모]]` 1개 | 기존 전략의 조건 변형/추가/제거 |
| `explore` | `[[참조]]` + 자유 영감 | 기존 발견에서 영감, 다른 영역 탐색 |
| `combine` | `[[A]]`, `[[B]]`, ... | 복수 전략의 관찰을 합쳐 새 전략 |

부모/참조 관계는 `## 관련 전략`의 `[[wikilink]]`로 표현. Obsidian 그래프 뷰에서 자동 엣지 생성.

---

## 5. 10가지 리서치 모드

| # | 모드 | OBSERVE | LOOK |
|---|------|---------|------|
| 1 | brute_force | 가격/거래량 극단값 | 해당 조건일 종가베팅 수익률 |
| 2 | news_replay | 뉴스 유형별 가격 반응 | 뉴스 유형 발생일 종가베팅 수익률 |
| 3 | condition_combo | 복수 조건 동시 충족일 | 조건 조합 충족일 종가베팅 수익률 |
| 4 | anomaly_detection | 통계적 이상치 | 이상치 발생일 종가베팅 수익률 |
| 5 | copycat | 검증 패턴의 타종목 적용 | 타종목 동일 패턴일 종가베팅 수익률 |
| 6 | narrative_shift | 기업 스토리 전환점 | 전환점 발생일 종가베팅 수익률 |
| 7 | consensus_gap | 컨센서스 vs 실제 괴리 | 괴리 발생일 종가베팅 수익률 |
| 8 | supply_chain | 업스트림 시그널 | 시그널 발생일 하류 종목 종가베팅 수익률 |
| 9 | regulatory | 정책/규제 이벤트 | 이벤트 발생일 섹터 종가베팅 수익률 |
| 10 | behavioral | 경영진 행동 패턴 | 패턴 발생일 종가베팅 수익률 |

---

## 6. Adaptive Router

CRYSTALLIZE 완료 후 다음 사이클의 방향을 결정한다.

- 그래프 현황: 모드별 전략 분포, 미탐색 모드
- 최근 흐름: 직전 사이클 결과
- 데이터 가용성: 해당 모드를 뒷받침하는 데이터 존재 여부
- 다양성: 동일 모드 3회 연속 불가

---

## 7. 데이터 구조

### config.json

```json
{
  "dataset": {
    "prices": "/path/to/prices/",
    "sources": "/path/to/sources/"
  },
  "goals": "종가베팅 전략 발굴",
  "investmentMode": true,
  "fee": {
    "stock_pct": 0.24,
    "etf_pct": 0.04
  },
  "sectors": {
    "반도체": ["005930", "000660"]
  }
}
```

데이터 형식 제한 없음 -- Claude가 prices/sources 디렉토리의 파일을 직접 읽고 해석한다.

### 전략 생명주기

`draft` → `developing` → `established` → `archived`

---

## 8. 실행 모드

| 명령 | 흐름 | 설명 |
|------|------|------|
| `/otterwise:research` | INIT → ROUTE → OLJC → done | 단일 사이클 |
| `/otterwise:continue` | LOAD → ROUTE → OLJC → done | 그래프 확장 |
| `/otterwise:autopilot` | INIT/RESUME → [ROUTE → OLJC]∞ | 무한 루프 |

Autopilot은 매 페이즈 시작 전 `autopilot-state.json`을 확인하여 pause/abort를 처리한다.

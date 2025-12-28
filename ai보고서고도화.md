좋아. **네가 말한 방식(기초 분석은 MD에서 끝내고 → LLM에게 “고도화 보고서”만 맡기기)**가 제일 현실적이고, **문항이 바뀌어도 그대로 재사용**할 수 있게 만들 수 있어.

핵심은 “문항별 맞춤 파인튜닝”이 아니라,

* **서버가 문항이 뭐든 항상 만들 수 있는 ‘표준 분석팩(Analysis Pack)’**을 만들고
* LLM은 그 팩을 읽고 **의사결정 문서(Decision-grade report)**로 “편집/정리/추천”만 하게 하는 것

이렇게 하면 문항이 바뀌어도 **파이프라인은 동일**, 모델 프롬프트도 거의 그대로 씁니다.

아래는 **네가 말한 개선(숫자 일관성, Evidence Catalog, Decision Cards, Confidence, Action Board)을 전부 적용**하면서도
**문항이 바뀌어도 그대로 동작**하도록 만든 “범용 설계”입니다. (Cursor에 바로 던져도 됨)

---

# 1) 최종 구조: 2단계 파이프라인

## A. 기초 분석(Deterministic, MD/JSON 생성)

문항이 뭐든 항상 가능한 것만 생성:

* 캠페인 메타(표본 N, 시점, 문항 리스트)
* 문항별 분포/요약(객관식/복수/평점/텍스트)
* 교차표(crosstab) + 하이라이트(Top associations)
* 데이터 품질(결측/표본 경고/셀 N<5 경고)
* **Evidence Catalog(E1..En)** ← *항상 생성*
* (옵션) Lead Queue / Priority Queue ← *태그가 있을 때만 생성*

👉 이 단계 결과를 **MD로 다운로드 가능**하게 유지 (네가 원하는 방식)

## B. 고도화 보고서(LLM, Decision-grade)

LLM에 던질 입력은 **기초 분석팩(Analysis Pack)** 한 덩어리(텍스트 + JSON 블록)로 고정.

LLM은 여기서:

* Decision Cards(옵션 비교 + 추천 + 근거ID + 기대효과/리스크)
* Action Board(24h/7d/14d)
* Playbook(세그먼트별 세일즈/마케팅 산출물)
* 추가 설문 개선(“다음에 물어볼 것”)
  만 작성

그리고 중요한 규칙:

* **숫자/카운트/비율은 반드시 Evidence Catalog에서만 인용**
* 없는 숫자는 “Unknown” 처리

---

# 2) “문항이 바뀌어도 되는” 핵심 설계 포인트 4개

## (1) Evidence ID를 “문항에 종속”시키지 말고 “팩에 종속”

문항이 바뀌면 Q1/Q2 같은 번호가 흔들리니까,
Evidence ID는 **팩 생성 시점에 자동 부여(E1..En)** 하고, 설명을 함께 넣어줘.

* E1: “문항 A 분포(Top choices)”
* E2: “문항 B 분포”
* E7: “문항 A × 문항 C 교차표 highlight”
* E12: “데이터 품질: 셀 N<5 경고”

LLM은 **E1/E7 같은 ID를 링크처럼 참조**만 한다.

## (2) 교차분석은 ‘역할 태그’ 없이도 돌아가야 함 (제로 설정)

태그를 안 붙여도 돌아가게 하려면,
서버에서 다음 규칙으로 교차분석 후보를 자동 선정하면 됨:

* 객관식(single)/복수(multi) 문항 중

  * 응답률 높고
  * 분산(엔트로피)이 큰 상위 K개 선택
* 그들 간 쌍(pair)을 만들어

  * Cramér’s V(범주형 연관) 또는 lift 기반으로 상위 5개 하이라이트만 뽑기

→ 문항이 바뀌어도 “의미 있는 관계”가 자동으로 뽑힌다.

## (3) Priority Queue(리드 우선순위)는 “옵션 기능”으로

문항마다 리드 스코어링이 가능한 건 아니니까,
Priority Queue는 **기본 OFF(또는 Not Available)** 가 맞다.

* 캠페인에 `analysisTags`가 설정되어 있을 때만(예: timeframe, followupIntent, budget 등)

  * deterministic scoring으로 P0~P4 생성
* 태그가 없으면:

  * “이번 설문은 리드 스코어링에 필요한 질문이 없어 Priority Queue는 생성하지 않음”
  * 대신 Decision Cards/Action Board는 “세그먼트 기반”으로 생성

## (4) 숫자 일관성은 AI가 아니라 서버가 강제로 보장(필수)

“P0 0명인데 Action Board엔 11명” 같은 모순은 **서버 병합 정책으로 영구 방지**:

* Priority Queue가 존재하면:

  * `Σ(P0..P4) == N` 검증 실패 시 저장 금지
* 모든 “대상 수량”은 Evidence Catalog에서만 가져오게 만들고,
* LLM이 출력한 숫자는 저장 전에 덮어쓰기/검증

---

# 3) Analysis Pack(기초 분석팩) 표준 포맷

기초 분석 MD 파일에 **아래 JSON 블록을 항상 포함**시키면 문항이 바뀌어도 LLM이 안정적으로 읽습니다.

### MD 구조 권장

1. 사람이 읽는 요약(간단)
2. `BEGIN_ANALYSIS_PACK_JSON` 블록(머신리더블)
3. 부록(표/교차표 상세)

예시:

````md
# Survey Analysis Pack (Base)

## Summary
- N=50, Questions=3
- Key highlights: H1, H2

## BEGIN_ANALYSIS_PACK_JSON
```json
{
  "version": "ap-1.0",
  "campaign": {
    "id": "…",
    "title": "…",
    "analyzedAtISO": "…",
    "sampleCount": 50,
    "totalQuestions": 3
  },
  "questions": [
    {
      "qid": "uuid",
      "label": "Q1",
      "type": "single",
      "text": "…",
      "responseCount": 50,
      "topOptions": [
        {"text":"…", "count":17, "pct":34.0}
      ]
    }
  ],
  "evidenceCatalog": [
    {
      "id": "E1",
      "title": "Q1 분포(프로젝트 시점)",
      "valueText": "1주 이내 34% (17/50)",
      "n": 50,
      "source": "question_distribution",
      "confidence": "Confirmed"
    }
  ],
  "crosstabs": [
    {
      "id": "CT1",
      "row": "Q1",
      "col": "Q3",
      "cells": [
        {"rowKey":"1주 이내","colKey":"온라인 미팅","count":6,"rowPct":35.3,"overallPct":26.0,"lift":1.36}
      ],
      "minCellCount": 2
    }
  ],
  "highlights": [
    {
      "id": "H1",
      "title": "1주 이내 그룹에서 온라인 미팅 선호가 전체 대비 높음",
      "evidenceIds": ["E1","E7"],
      "statement": "1주 이내 그룹의 온라인 미팅 비중 35.3% vs 전체 26.0% (lift 1.36, 6/17)",
      "confidence": "Directional"
    }
  ],
  "dataQuality": [
    {"level":"info","message":"표본 N=50, 분포/방향성 파악에 충분"},
    {"level":"warning","message":"교차표 일부 셀 N<5 → 세부 결론은 가설로만"}
  ],
  "leadQueue": null
}
````

## END_ANALYSIS_PACK_JSON

````

> **이 JSON이 ‘문항이 바뀌어도 변하지 않는 계약(Contract)’** 역할을 해요.

---

# 4) LLM에게 맡길 출력: “Decision Pack” (범용, 문항 독립)

LLM 출력도 문항과 무관하게 고정 구조로 제한하면, 품질이 안정됩니다.

### Decision Pack v1 (추천 스키마: 단순/안정)
- Decision Cards(3~5)
- Action Board(24h/7d/14d)
- Playbooks(세일즈/마케팅)
- Survey 개선(추가 질문 제안)

**LLM에게 절대 시키지 말 것**
- 퍼센트 계산
- 리드 티어 합계
- “유의성 확보” 같은 통계 단정

---

# 5) 보고서 “전문성”을 보장하는 Linter 규칙 (문항 바뀌어도 동일)

아래 규칙은 문항이 바뀌어도 그대로 적용 가능하고, 허접함을 강하게 줄여줍니다.

## 저장 금지(FAIL) 조건
1) Decision Card < 3개
2) 모든 Decision Card에 `evidenceIds`가 2개 미만
3) Action Board에 “대상 수량/목표 KPI”가 하나도 없음  
4) `important / need / should`류 문장만 있고 동사형 액션이 없음  
5) Evidence Catalog의 숫자와 Action의 숫자가 모순(가능하면 서버에서 덮어쓰기)

## 통과(PASS) 조건
- 각 결론에 Confidence(Confirmed/Directional/Hypothesis) 라벨 존재
- 각 Decision Card는 Options(A/B/C) 비교 포함
- Action은 Owner/Due/KPI 포함

---

# 6) UI/PDF 구성(문항 바뀌어도 동일 템플릿)

너가 원한 상단 순서는 유지 + Decision 중심 섹션 추가:

1) 고정 신뢰 문구(서버 삽입)
2) 분석대상 요약
3) 레퍼런스 요약
4) 도넛 요약(상위 문항 자동 선정)
5) **Evidence Catalog (E1~E10)** ← 짧게
6) **Decision Cards (3~5)**
7) **Action Board (24h/7d/14d)**
8) Playbooks(세일즈/마케팅)
9) Data Quality & Limits
10) Appendix(교차표/문항별 상세)

PDF도 같은 레이아웃으로 print view를 렌더링하면 문항이 바뀌어도 문제 없음.

---

# 7) “최소 설정” 옵션만 추가하면 품질이 더 올라감 (하지만 필수는 아님)

문항이 바뀌어도 돌아가게 하려면 제로 설정이 기본이 맞고,  
다만 리드 우선순위(P0~P4)를 제대로 하고 싶으면, “파인튜닝”이 아니라 **가벼운 태그 설정**만 있으면 됨:

- `analysisTag`: `timeframe`, `followup_intent`, `budget`, `decision_power`, `pain_point`, `use_case`
- 태그가 없으면 Priority Queue는 숨기고,
- 태그가 있으면 deterministic scoring ON

이건 문항이 바뀌어도 “태그만 바꾸면” 끝이라 운영 부담이 작아요.

---

# 8) Cursor에 바로 던질 “구현 명세” (요약본)

```md
# Cursor Spec: MD Base Analysis → LLM Decision Report (Question-agnostic)

## Goal
- Base 분석은 서버에서 MD+JSON(AnalysisPack)로 생성
- LLM은 AnalysisPack을 입력으로 DecisionPack 생성
- 문항이 바뀌어도 동일 템플릿/동일 룰로 동작

## Base(Deterministic) Output: AnalysisPack(ap-1.0)
- campaign meta
- questions stats(topOptions)
- evidenceCatalog(E1..En)
- crosstabs + highlights(H1..H5)
- dataQuality messages
- leadQueue optional (tags 있을 때만)

## LLM Output: DecisionPack(dp-1.0)
- decisionCards(>=3, options A/B/C, evidenceIds, confidence)
- actionBoard(24h/7d/14d: owner/due/targetCount/kpi)
- playbooks(sales/marketing)
- surveyNextQuestions

## Server Merge Rules
- 숫 provide: evidenceCatalog 기반만 허용(LLM 숫자 검증/덮어쓰기)
- leadQueue는 서버 계산(있을 때만 노출)
- Σ(P0..P4)==N 검증 실패 시 저장 금지

## Linter
- decisionCards>=3
- each card evidenceIds>=2
- actionBoard에 targetCount/kpi 존재
- placeholder/모호 표현 감점 및 재시도
````

---

# 9) 구현 단계별 로드맵

## Phase 1: 기초 분석팩 생성 (Deterministic) - 1주

### 작업 목록
- [ ] `buildAnalysisPack()` 함수 구현
  - 캠페인 메타 수집
  - 문항별 통계 계산 (`questionStats`)
  - 교차표 생성 (`buildCrosstabs`)
  - Evidence Catalog 생성 (`buildEvidenceCatalog`)
  - 데이터 품질 평가 (`buildDataQuality`)
- [ ] Analysis Pack JSON 스키마 정의 (Zod)
- [ ] MD 템플릿 렌더링 (`renderAnalysisPackMD`)
- [ ] 단위 테스트 작성

### 의존성
- 기존 `buildComputedMetrics.ts` 활용
- `question-stats` API 결과 활용

### 예상 소요 시간
- 개발: 16시간
- 테스트: 4시간
- 총: 20시간

---

## Phase 2: LLM Decision Pack 생성 - 1주

### 작업 목록
- [ ] `generateDecisionPack()` 함수 구현
  - Analysis Pack을 프롬프트로 변환
  - Gemini API 호출 (Structured Output 비활성화)
  - JSON 파싱 및 검증
- [ ] Decision Pack 스키마 정의 (Zod)
- [ ] 프롬프트 엔지니어링 (system/user prompt)
- [ ] 재시도 로직 구현 (최대 2회)

### 의존성
- Phase 1 완료 필요
- `gemini.ts` 기존 코드 활용

### 예상 소요 시간
- 개발: 20시간
- 프롬프트 튜닝: 8시간
- 테스트: 4시간
- 총: 32시간

---

## Phase 3: Linter 및 품질 검증 - 3일

### 작업 목록
- [ ] `lintDecisionPack()` 함수 구현
  - Decision Cards 검증 (>=3개, evidenceIds >=2개)
  - Action Board 검증 (targetCount/KPI 존재)
  - 숫자 일관성 검증 (Evidence Catalog 기반)
  - 플레이스홀더 감지
- [ ] Linter 결과를 재시도 프롬프트로 변환
- [ ] 품질 게이트 통합

### 의존성
- Phase 2 완료 필요
- 기존 `reportLinter.ts` 확장

### 예상 소요 시간
- 개발: 12시간
- 테스트: 4시간
- 총: 16시간

---

## Phase 4: 서버 병합 및 검증 - 2일

### 작업 목록
- [ ] `mergeAnalysisAndDecisionPack()` 함수 구현
  - Analysis Pack + Decision Pack 병합
  - 숫자 덮어쓰기 (Evidence Catalog 우선)
  - Priority Queue 서버 계산값으로 교체
  - `Σ(P0..P4) == N` 검증
- [ ] 최종 보고서 생성 (`renderFinalReportMD`)

### 의존성
- Phase 1, 2, 3 완료 필요

### 예상 소요 시간
- 개발: 8시간
- 테스트: 4시간
- 총: 12시간

---

## Phase 5: UI 렌더링 및 PDF 생성 - 1주

### 작업 목록
- [ ] UI 컴포넌트 업데이트
  - Evidence Catalog 섹션 추가
  - Decision Cards 렌더링
  - Action Board 렌더링 (24h/7d/14d)
- [ ] PDF 생성 로직 구현
  - Markdown → PDF 변환
  - 그래프 포함 (도넛 차트 등)
- [ ] 다운로드 기능 (MD/PDF)

### 의존성
- Phase 4 완료 필요
- 기존 `renderMarkdown.ts` 확장

### 예상 소요 시간
- 개발: 24시간
- 테스트: 8시간
- 총: 32시간

---

## Phase 6: 통합 테스트 및 최적화 - 3일

### 작업 목록
- [ ] E2E 테스트 시나리오 작성
- [ ] 성능 테스트 (대용량 데이터)
- [ ] 에러 케이스 테스트
- [ ] 문서화 완료

### 예상 소요 시간
- 테스트: 16시간
- 문서화: 4시간
- 총: 20시간

---

## 전체 일정 요약

| Phase | 작업 내용 | 예상 소요 시간 | 의존성 |
|-------|----------|--------------|--------|
| Phase 1 | 기초 분석팩 생성 | 20시간 | - |
| Phase 2 | LLM Decision Pack 생성 | 32시간 | Phase 1 |
| Phase 3 | Linter 및 품질 검증 | 16시간 | Phase 2 |
| Phase 4 | 서버 병합 및 검증 | 12시간 | Phase 1,2,3 |
| Phase 5 | UI 렌더링 및 PDF 생성 | 32시간 | Phase 4 |
| Phase 6 | 통합 테스트 및 최적화 | 20시간 | Phase 5 |
| **총계** | | **132시간 (약 3.3주)** | |

---

# 10) 에러 처리 및 재시도 전략

## LLM 호출 실패 시나리오

### 시나리오 1: API 호출 실패 (네트워크/타임아웃)
**처리 방법:**
```typescript
async function generateDecisionPackWithRetry(
  analysisPack: AnalysisPack,
  maxRetries = 2
): Promise<DecisionPack> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateDecisionPack(analysisPack)
    } catch (error: any) {
      lastError = error
      
      // 네트워크 오류인 경우에만 재시도
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          console.log(`[Decision Pack] 재시도 ${attempt + 1}/${maxRetries}...`)
          continue
        }
      }
      
      // 다른 오류는 즉시 throw
      throw error
    }
  }
  
  throw lastError || new Error('Decision Pack 생성 실패: 최대 재시도 횟수 초과')
}
```

### 시나리오 2: JSON 파싱 실패
**처리 방법:**
- LLM 응답에서 JSON 블록 추출 (`BEGIN_DECISION_PACK_JSON` ~ `END_DECISION_PACK_JSON`)
- JSON 파싱 실패 시 재시도 (프롬프트 강화)
- 최대 2회 재시도 후 실패 시 Fallback: "분석 생성 실패" 메시지 반환

### 시나리오 3: Zod 스키마 검증 실패
**처리 방법:**
```typescript
async function generateDecisionPack(
  analysisPack: AnalysisPack,
  retryIssues?: z.ZodIssue[]
): Promise<DecisionPack> {
  const prompt = buildPrompt(analysisPack, retryIssues)
  const response = await callGeminiAPI(prompt)
  const parsed = extractJSON(response)
  
  // Zod 검증
  const result = DecisionPackSchema.safeParse(parsed)
  
  if (!result.success) {
    // 검증 실패 시 재시도 (검증 오류를 프롬프트에 포함)
    throw new Error('Schema validation failed') as any
    error.issues = result.error.issues
    throw error
  }
  
  return result.data
}
```

### 시나리오 4: Linter 품질 검증 실패
**처리 방법:**
- Linter 경고를 `qualityPrompt`로 변환
- 재시도 시 품질 개선 요청 포함
- 최대 2회 재시도 후에도 실패 시:
  - 경고가 `warning` 레벨만 있으면 저장 허용 (로그 기록)
  - 경고가 `error` 레벨이면 저장 금지

## Fallback 메커니즘

### Fallback 1: LLM 완전 실패 시
```typescript
try {
  decisionPack = await generateDecisionPackWithRetry(analysisPack)
} catch (error) {
  console.error('[Decision Pack] 생성 실패:', error)
  
  // Fallback: 기본 구조만 생성
  decisionPack = {
    version: 'dp-1.0',
    decisionCards: [],
    actionBoard: { d0: [], d7: [], d14: [] },
    playbooks: { sales: [], marketing: [] },
    surveyNextQuestions: [],
    _fallback: true,
    _error: error.message
  }
  
  // 사용자에게 알림
  return NextResponse.json({
    success: true,
    data: {
      analysisPack,
      decisionPack,
      warnings: ['LLM 생성 실패로 기본 구조만 제공됩니다.']
    }
  })
}
```

### Fallback 2: 부분 실패 시
- Decision Cards만 실패 → Action Board는 저장
- Action Board만 실패 → Decision Cards는 저장
- 각 섹션별로 독립적으로 Fallback 처리

---

# 11) 성능 최적화 가이드

## 대용량 데이터 처리

### 문제: 응답 수가 1000명 이상일 때
**해결책:**
1. **샘플링 전략**
   ```typescript
   // 교차표 생성 시 샘플링
   function buildCrosstabs(
     questions: Question[],
     answers: Answer[],
     submissions: Submission[],
     maxSampleSize = 1000
   ): Crosstab[] {
     const sampleSize = Math.min(submissions.length, maxSampleSize)
     const sampledSubmissions = sampleSubmissions(submissions, sampleSize)
     // ... 교차표 계산
   }
   ```

2. **병렬 처리**
   ```typescript
   // 문항별 통계를 병렬로 계산
   const questionStatsPromises = questions.map(q => 
     computeQuestionStats(q, answers)
   )
   const questionStats = await Promise.all(questionStatsPromises)
   ```

3. **스트리밍 처리**
   - 대용량 데이터는 청크 단위로 처리
   - 메모리 사용량 모니터링

### 문제: 교차표 계산이 느림
**해결책:**
- 상위 K개 문항만 교차분석 (기본 K=5)
- 캐싱: 동일 캠페인 재분석 시 캐시 활용

## 캐싱 전략

### 캐시 키 설계
```typescript
function getCacheKey(campaignId: string, sampleCount: number): string {
  return `analysis-pack:${campaignId}:${sampleCount}`
}
```

### 캐시 무효화 조건
- 새로운 응답 추가 시 (`sampleCount` 변경)
- 문항 수정 시 (`questions` 변경)
- 캠페인 메타 변경 시

### 캐시 저장소
- Redis (프로덕션)
- 메모리 캐시 (개발)

## LLM 호출 최적화

### 프롬프트 크기 최적화
- Analysis Pack JSON을 압축 (불필요한 필드 제거)
- Evidence Catalog는 상위 10개만 포함
- 교차표는 하이라이트만 포함

### 배치 처리
- 여러 캠페인 동시 분석 시 큐 시스템 활용
- Rate limiting 적용 (Gemini API 제한 고려)

---

# 12) 확장성 설계

## 새로운 분석 타입 추가 방법

### Step 1: Analysis Pack 확장
```typescript
// lib/surveys/analysis/analysisPackSchema.ts
export const AnalysisPackSchema = z.object({
  version: z.literal('ap-1.0'),
  campaign: CampaignMetaSchema,
  questions: z.array(QuestionStatsSchema),
  evidenceCatalog: z.array(EvidenceItemSchema),
  crosstabs: z.array(CrosstabSchema),
  highlights: z.array(HighlightSchema),
  dataQuality: z.array(DataQualityMessageSchema),
  leadQueue: LeadQueueSchema.optional(),
  // 새로운 분석 타입 추가
  sentimentAnalysis: SentimentAnalysisSchema.optional(), // 예시
})
```

### Step 2: 계산 함수 추가
```typescript
// lib/surveys/analysis/buildComputedMetrics.ts
export function buildSentimentAnalysis(
  textAnswers: Answer[]
): SentimentAnalysis {
  // 새로운 분석 로직
}
```

### Step 3: Evidence Catalog에 추가
```typescript
// buildEvidenceCatalog 함수에 추가
sentimentAnalysis.forEach(sentiment => {
  evidence.push({
    id: `E${evidenceIdCounter++}`,
    title: `감정 분석: ${sentiment.category}`,
    valueText: `${sentiment.positivePct}% 긍정`,
    n: sentiment.sampleCount,
    source: 'sentiment',
  })
})
```

### Step 4: Decision Pack 스키마 확장 (필요시)
- 새로운 분석 타입이 의사결정에 영향을 주는 경우에만 확장

## 플러그인 구조 (향후)

```typescript
interface AnalysisPlugin {
  name: string
  version: string
  compute(analysisPack: AnalysisPack): Promise<PluginResult>
  render(result: PluginResult): string
}

// 플러그인 등록
registerPlugin({
  name: 'sentiment-analysis',
  version: '1.0.0',
  compute: buildSentimentAnalysis,
  render: renderSentimentAnalysis,
})
```

## 커스터마이징 포인트

1. **리드 스코어링 룰**
   - `buildLeadSignals()` 함수의 점수 계산 로직 수정
   - 캠페인별 커스터마이징 가능

2. **교차표 후보 선정**
   - `selectCrosstabCandidates()` 함수 수정
   - 엔트로피/Cramér's V 임계값 조정

3. **Linter 규칙**
   - `lintDecisionPack()` 함수에 새로운 규칙 추가
   - 비즈니스 요구사항에 맞게 조정

---

# 13) 테스트 전략

## 단위 테스트

### 테스트 대상
```typescript
// lib/surveys/analysis/buildComputedMetrics.test.ts
describe('buildCrosstabs', () => {
  it('should generate crosstabs for valid question pairs', () => {
    const questions = [/* ... */]
    const answers = [/* ... */]
    const submissions = [/* ... */]
    
    const crosstabs = buildCrosstabs(questions, answers, submissions)
    
    expect(crosstabs).toHaveLength(5) // 상위 5개
    expect(crosstabs[0].cells).toBeDefined()
    expect(crosstabs[0].cells[0].lift).toBeGreaterThan(0)
  })
})

describe('buildEvidenceCatalog', () => {
  it('should generate unique evidence IDs', () => {
    const catalog = buildEvidenceCatalog(/* ... */)
    const ids = catalog.map(e => e.id)
    const uniqueIds = new Set(ids)
    
    expect(ids.length).toBe(uniqueIds.size)
  })
  
  it('should include all required evidence types', () => {
    const catalog = buildEvidenceCatalog(/* ... */)
    
    const hasQuestionStats = catalog.some(e => e.source === 'qStats')
    const hasCrosstab = catalog.some(e => e.source === 'crosstab')
    const hasLeadSignals = catalog.some(e => e.source === 'derived')
    
    expect(hasQuestionStats).toBe(true)
    expect(hasCrosstab).toBe(true)
    expect(hasLeadSignals).toBe(true)
  })
})
```

## 통합 테스트

### 테스트 시나리오
```typescript
// __tests__/integration/analysis-pipeline.test.ts
describe('Analysis Pipeline Integration', () => {
  it('should generate complete report from survey data', async () => {
    // 1. 테스트 데이터 준비
    const campaign = await createTestCampaign()
    const submissions = await createTestSubmissions(campaign.id, 50)
    
    // 2. Analysis Pack 생성
    const analysisPack = await buildAnalysisPack(campaign.id)
    expect(analysisPack.evidenceCatalog.length).toBeGreaterThan(0)
    
    // 3. Decision Pack 생성
    const decisionPack = await generateDecisionPack(analysisPack)
    expect(decisionPack.decisionCards.length).toBeGreaterThanOrEqual(3)
    
    // 4. Linter 검증
    const linterResult = lintDecisionPack(decisionPack, analysisPack)
    expect(linterResult.isValid).toBe(true)
    
    // 5. 병합 및 최종 보고서 생성
    const finalReport = mergeAndRender(analysisPack, decisionPack)
    expect(finalReport).toContain('Evidence Catalog')
    expect(finalReport).toContain('Decision Cards')
  })
})
```

## Linter 검증 테스트

```typescript
// lib/surveys/analysis/reportLinter.test.ts
describe('Linter', () => {
  it('should fail when Decision Cards < 3', () => {
    const decisionPack = {
      decisionCards: [/* 2개만 */],
      // ...
    }
    
    const result = lintDecisionPack(decisionPack)
    expect(result.isValid).toBe(false)
    expect(result.warnings.some(w => w.field === 'decisionCards')).toBe(true)
  })
  
  it('should fail when evidenceIds < 2', () => {
    const decisionPack = {
      decisionCards: [{
        evidenceIds: ['E1'], // 1개만
        // ...
      }],
    }
    
    const result = lintDecisionPack(decisionPack)
    expect(result.isValid).toBe(false)
  })
})
```

## 품질 게이트 테스트

```typescript
// E2E 테스트
describe('Quality Gates', () => {
  it('should reject report with placeholder text', async () => {
    // LLM이 플레이스홀더를 생성하도록 유도
    const decisionPack = await generateDecisionPack(analysisPack)
    
    // 플레이스홀더 감지
    const hasPlaceholder = decisionPack.actionBoard.d0.some(
      action => action.title.includes('ℹ️ 정보:')
    )
    
    expect(hasPlaceholder).toBe(false)
  })
  
  it('should enforce number consistency', async () => {
    const analysisPack = { /* ... */ }
    const decisionPack = await generateDecisionPack(analysisPack)
    
    // 병합 후 검증
    const merged = mergeAnalysisAndDecisionPack(analysisPack, decisionPack)
    
    // Priority Queue 합계 검증
    const total = merged.priorityQueue.reduce((sum, q) => sum + q.count, 0)
    expect(total).toBe(analysisPack.campaign.sampleCount)
  })
})
```

---

# 14) 모니터링 및 로깅

## 품질 메트릭 추적

### 메트릭 수집
```typescript
interface AnalysisMetrics {
  campaignId: string
  sampleCount: number
  analysisPackGenerationTime: number
  decisionPackGenerationTime: number
  linterWarnings: number
  linterErrors: number
  retryCount: number
  finalQualityScore: number
}

async function trackAnalysisMetrics(metrics: AnalysisMetrics) {
  // 로깅
  console.log('[Metrics]', JSON.stringify(metrics))
  
  // 메트릭 수집 서비스로 전송 (예: Datadog, Prometheus)
  await sendMetrics({
    'analysis.generation_time': metrics.analysisPackGenerationTime,
    'analysis.linter_warnings': metrics.linterWarnings,
    'analysis.quality_score': metrics.finalQualityScore,
  })
}
```

### 주요 메트릭
- **생성 시간**: Analysis Pack 생성 시간, Decision Pack 생성 시간
- **품질 점수**: Linter 통과율, 재시도 횟수
- **에러율**: LLM 호출 실패율, 스키마 검증 실패율
- **사용량**: 일일 생성 보고서 수, 평균 응답 수

## 디버깅 가이드

### 로그 레벨
```typescript
// 개발 환경
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] Analysis Pack:', JSON.stringify(analysisPack, null, 2))
  console.log('[DEBUG] LLM Prompt:', prompt)
  console.log('[DEBUG] LLM Response:', response)
}

// 프로덕션 환경
console.log('[INFO] Analysis Pack generated', { campaignId, sampleCount })
console.warn('[WARN] Linter warnings', { warnings: linterResult.warnings })
console.error('[ERROR] Decision Pack generation failed', { error: error.message })
```

### 디버깅 체크리스트
1. **Analysis Pack 생성 실패**
   - 문항 데이터 확인
   - 응답 데이터 확인
   - 교차표 계산 로직 확인

2. **Decision Pack 생성 실패**
   - LLM API 키 확인
   - 프롬프트 크기 확인 (토큰 제한)
   - JSON 파싱 오류 확인

3. **Linter 검증 실패**
   - Evidence Catalog 확인
   - Decision Cards 구조 확인
   - 숫자 일관성 확인

## 알림 설정

### 알림 조건
- LLM 호출 실패율 > 10%
- Linter 에러율 > 20%
- 평균 생성 시간 > 60초
- 일일 생성 보고서 수 < 예상치의 50%

### 알림 채널
- Slack 웹훅
- 이메일 (중요 오류만)
- 모니터링 대시보드

---

# 15) 버전 관리 전략

## Analysis Pack 버전 호환성

### 버전 규칙
- **Major 버전 (ap-1.0 → ap-2.0)**: 스키마 호환성 깨짐
- **Minor 버전 (ap-1.0 → ap-1.1)**: 필드 추가 (하위 호환)
- **Patch 버전 (ap-1.0 → ap-1.0.1)**: 버그 수정

### 마이그레이션 가이드

#### ap-1.0 → ap-1.1 마이그레이션
```typescript
function migrateAnalysisPack(
  pack: AnalysisPackV1_0
): AnalysisPackV1_1 {
  return {
    ...pack,
    version: 'ap-1.1',
    // 새로운 필드 추가 (기본값)
    sentimentAnalysis: pack.sentimentAnalysis || null,
  }
}
```

#### ap-1.0 → ap-2.0 마이그레이션 (Breaking Change)
```typescript
function migrateAnalysisPackV2(
  pack: AnalysisPackV1_0
): AnalysisPackV2_0 {
  // 구조 변경 처리
  return {
    version: 'ap-2.0',
    campaign: pack.campaign,
    // 새로운 구조로 변환
    evidenceCatalog: pack.evidenceCatalog.map(e => ({
      ...e,
      // 필드명 변경 등
      metric: e.source, // source → metric
    })),
  }
}
```

## 하위 호환성 정책

### 읽기 호환성
- 이전 버전 Analysis Pack도 읽을 수 있어야 함
- 마이그레이션 함수 제공

### 쓰기 호환성
- 최신 버전으로 저장 권장
- 이전 버전 저장도 허용 (경고 로그)

## 버전 확인 로직
```typescript
function parseAnalysisPack(data: any): AnalysisPack {
  const version = data.version || 'ap-1.0'
  
  switch (version) {
    case 'ap-1.0':
      return migrateToLatest(data as AnalysisPackV1_0)
    case 'ap-1.1':
      return migrateToLatest(data as AnalysisPackV1_1)
    case 'ap-2.0':
      return data as AnalysisPackV2_0
    default:
      throw new Error(`Unsupported version: ${version}`)
  }
}
```

---

# 16) 실제 코드 예시

## TypeScript/Zod 스키마 예시

### Analysis Pack 스키마
```typescript
// lib/surveys/analysis/analysisPackSchema.ts
import { z } from 'zod'

export const EvidenceItemSchema = z.object({
  id: z.string().regex(/^E\d+$/), // E1, E2, ...
  title: z.string().min(5),
  metric: z.enum(['분포', '교차표', '리드 스코어', '데이터 품질']),
  valueText: z.string().min(3), // "34% (17/50)"
  n: z.number().int().positive(),
  source: z.enum(['qStats', 'crosstab', 'derived', 'dataQuality']),
  notes: z.string().optional(),
})

export const CrosstabHighlightSchema = z.object({
  id: z.string().regex(/^H\d+$/), // H1, H2, ...
  title: z.string().min(10),
  evidenceIds: z.array(z.string().regex(/^E\d+$/)).min(2),
  statement: z.string().min(20),
  confidence: z.enum(['Confirmed', 'Directional', 'Hypothesis']),
})

export const AnalysisPackSchema = z.object({
  version: z.literal('ap-1.0'),
  campaign: z.object({
    id: z.string().uuid(),
    title: z.string(),
    analyzedAtISO: z.string().datetime(),
    sampleCount: z.number().int().positive(),
    totalQuestions: z.number().int().positive(),
  }),
  questions: z.array(QuestionStatsSchema),
  evidenceCatalog: z.array(EvidenceItemSchema).min(3),
  crosstabs: z.array(CrosstabSchema),
  highlights: z.array(CrosstabHighlightSchema).max(5),
  dataQuality: z.array(DataQualityMessageSchema),
  leadQueue: LeadQueueSchema.optional(),
})

export type AnalysisPack = z.infer<typeof AnalysisPackSchema>
```

### Decision Pack 스키마
```typescript
// lib/surveys/analysis/decisionPackSchema.ts
export const DecisionCardSchema = z.object({
  question: z.string().min(10),
  options: z.array(z.object({
    id: z.enum(['A', 'B', 'C']),
    title: z.string().min(5),
    description: z.string().min(10),
    expectedImpact: z.string().min(10),
    risks: z.string().optional(),
  })).min(2).max(3),
  recommendation: z.enum(['A', 'B', 'C']),
  evidenceIds: z.array(z.string().regex(/^E\d+$/)).min(2),
  confidence: z.enum(['Confirmed', 'Directional', 'Hypothesis']),
  rationale: z.string().min(20),
})

export const ActionItemSchema = z.object({
  owner: z.enum(['sales', 'marketing', 'ops']),
  title: z.string().min(5),
  targetCount: z.string().regex(/\d+(명|건)/), // "17명", "8건"
  kpi: z.string().min(5),
  steps: z.array(z.string().min(3)).min(1),
})

export const DecisionPackSchema = z.object({
  version: z.literal('dp-1.0'),
  decisionCards: z.array(DecisionCardSchema).min(3).max(5),
  actionBoard: z.object({
    d0: z.array(ActionItemSchema).optional(), // 24시간 내
    d7: z.array(ActionItemSchema).optional(), // 7일 내
    d14: z.array(ActionItemSchema).optional(), // 14일 내
  }),
  playbooks: z.object({
    sales: z.array(z.string()).min(1),
    marketing: z.array(z.string()).min(1),
  }),
  surveyNextQuestions: z.array(z.string()).min(1),
})

export type DecisionPack = z.infer<typeof DecisionPackSchema>
```

## API 엔드포인트 예시

```typescript
// app/api/event-survey/campaigns/[campaignId]/analysis/generate/route.ts
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  
  try {
    // 1. Analysis Pack 생성
    const analysisPack = await buildAnalysisPack(campaignId)
    
    // 2. Decision Pack 생성 (재시도 포함)
    let decisionPack: DecisionPack
    let retryCount = 0
    const maxRetries = 2
    
    while (retryCount <= maxRetries) {
      try {
        decisionPack = await generateDecisionPack(analysisPack)
        
        // 3. Linter 검증
        const linterResult = lintDecisionPack(decisionPack, analysisPack)
        
        if (!linterResult.isValid) {
          // 에러 레벨 경고가 있으면 재시도
          const hasErrors = linterResult.warnings.some(w => w.level === 'error')
          if (hasErrors && retryCount < maxRetries) {
            retryCount++
            const qualityPrompt = buildQualityPrompt(linterResult.warnings)
            decisionPack = await generateDecisionPack(analysisPack, qualityPrompt)
            continue
          }
        }
        
        break
      } catch (error: any) {
        if (retryCount < maxRetries) {
          retryCount++
          await delay(Math.pow(2, retryCount) * 1000)
          continue
        }
        throw error
      }
    }
    
    // 4. 서버 병합 및 검증
    const merged = mergeAnalysisAndDecisionPack(analysisPack, decisionPack)
    
    // 5. 최종 보고서 생성
    const reportMD = renderFinalReportMD(merged)
    
    // 6. DB 저장
    await saveReport(campaignId, {
      analysisPack,
      decisionPack,
      reportMD,
      statisticsSnapshot: buildStatisticsSnapshot(analysisPack),
    })
    
    return NextResponse.json({ success: true, data: merged })
  } catch (error: any) {
    console.error('[Analysis] 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

## 렌더링 컴포넌트 예시

```typescript
// components/analysis/DecisionCardsRenderer.tsx
export function DecisionCardsRenderer({ 
  cards 
}: { 
  cards: DecisionCard[] 
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">🎯 Decision Cards</h2>
      {cards.map((card, index) => (
        <div key={index} className="border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">{card.question}</h3>
          
          {/* Options */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {card.options.map(option => (
              <div
                key={option.id}
                className={`p-4 rounded ${
                  option.id === card.recommendation
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="font-bold mb-2">
                  {option.id === card.recommendation && '⭐ '}
                  {option.title}
                </div>
                <p className="text-sm text-gray-600">{option.description}</p>
                <p className="text-xs mt-2">
                  <strong>기대 효과:</strong> {option.expectedImpact}
                </p>
              </div>
            ))}
          </div>
          
          {/* Recommendation */}
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <p className="font-semibold">추천: {card.recommendation}</p>
            <p className="text-sm mt-2">{card.rationale}</p>
          </div>
          
          {/* Evidence */}
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              <strong>근거:</strong> {card.evidenceIds.join(', ')}
            </p>
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
              card.confidence === 'Confirmed' ? 'bg-green-100' :
              card.confidence === 'Directional' ? 'bg-yellow-100' :
              'bg-gray-100'
            }`}>
              {card.confidence}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

# 17) 운영 가이드라인

## 배포 체크리스트

### 배포 전 확인사항
- [ ] 모든 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] Linter 검증 테스트 통과
- [ ] 성능 테스트 완료 (1000명 이상 응답)
- [ ] 문서화 완료
- [ ] 환경 변수 설정 확인 (`GOOGLE_API_KEY` 등)

### 배포 순서
1. **Staging 환경 배포**
   - 테스트 데이터로 검증
   - 품질 메트릭 확인

2. **프로덕션 배포 (Canary)**
   - 소수 캠페인에만 적용
   - 모니터링 강화

3. **전면 배포**
   - 모든 캠페인에 적용
   - 롤백 계획 준비

## 트러블슈팅 가이드

### 문제 1: LLM 생성 시간이 너무 김 (>60초)
**원인:**
- 프롬프트가 너무 큼
- 네트워크 지연

**해결책:**
- Analysis Pack JSON 압축
- Evidence Catalog 상위 10개만 포함
- 타임아웃 설정 (60초)

### 문제 2: Linter 에러율이 높음 (>20%)
**원인:**
- 프롬프트가 불충분
- LLM 모델 성능 이슈

**해결책:**
- 프롬프트 강화 (예시 추가)
- 모델 버전 업그레이드
- 재시도 로직 개선

### 문제 3: 숫자 일관성 오류
**원인:**
- LLM이 Evidence Catalog를 무시하고 숫자 생성

**해결책:**
- 서버 병합 로직 강화
- 저장 전 최종 검증 추가

## 성능 튜닝 팁

1. **캐싱 활용**
   - 동일 캠페인 재분석 시 캐시 사용
   - TTL: 1시간

2. **병렬 처리**
   - 문항별 통계 병렬 계산
   - 교차표 쌍 병렬 계산

3. **데이터 샘플링**
   - 1000명 이상 시 샘플링 (1000명)
   - 무작위 샘플링 (stratified)

---

# 18) 마이그레이션 전략

## 기존 v0.9 → v1.0 전환

### 마이그레이션 스크립트
```typescript
// scripts/migrate-v09-to-v10.ts
async function migrateV09ToV10() {
  const reports = await getV09Reports()
  
  for (const report of reports) {
    try {
      // 1. 기존 Action Pack V0.9 파싱
      const v09Pack = report.action_pack as ActionPackV09
      
      // 2. Analysis Pack 생성 (기존 데이터로 재생성)
      const analysisPack = await rebuildAnalysisPack(report.campaign_id)
      
      // 3. Decision Pack 생성 (기존 insights를 Decision Cards로 변환)
      const decisionPack = convertV09ToDecisionPack(v09Pack, analysisPack)
      
      // 4. 병합 및 저장
      const merged = mergeAnalysisAndDecisionPack(analysisPack, decisionPack)
      await updateReport(report.id, {
        analysis_pack: analysisPack,
        decision_pack: decisionPack,
        report_md: renderFinalReportMD(merged),
      })
      
      console.log(`[Migration] Report ${report.id} migrated`)
    } catch (error) {
      console.error(`[Migration] Failed for report ${report.id}:`, error)
    }
  }
}
```

### 데이터 마이그레이션
- 기존 `action_pack` 필드는 유지 (하위 호환)
- 새로운 `analysis_pack`, `decision_pack` 필드 추가
- 점진적 마이그레이션 (백그라운드 작업)

## 롤백 계획

### 롤백 조건
- 에러율 > 30%
- 평균 생성 시간 > 120초
- 사용자 불만 > 임계값

### 롤백 절차
1. 새 버전 비활성화
2. 기존 v0.9로 복귀
3. 문제 분석 및 수정
4. 재배포

---

## 결론

"개선 적용 + 문항 바뀌어도 그대로 사용"은 가능하고, 위 구조가 가장 안정적입니다.

이 문서는 **설계부터 구현, 운영까지** 전체 라이프사이클을 다루는 종합 가이드입니다. 각 섹션은 독립적으로 참조 가능하며, 실제 구현 시 단계별로 따라가면 됩니다.


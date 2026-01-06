# 설문조사 AI 분석 시스템 명세서

**문서 버전**: 2.0  
**최종 업데이트**: 2026-01-06  
**현재 구현 버전**: Analysis Pack v1.0 (ap-1.0) / Decision Pack v1.0 (dp-1.0)

---

## 📋 목차

### Part 1: 현재 구현 (Current Implementation)
- [1. 개요](#1-개요)
- [2. 시스템 아키텍처](#2-시스템-아키텍처)
- [3. Analysis Pack 생성 (ap-1.0)](#3-analysis-pack-생성-ap-10)
- [4. Decision Pack 생성 (dp-1.0)](#4-decision-pack-생성-dp-10)
- [5. 병합 및 검증](#5-병합-및-검증)
- [6. 동적 처리 요약](#6-동적-처리-요약)
- [7. 개선 제안](#7-개선-제안)
- [8. 사용 예시](#8-사용-예시)
- [9. API 명세](#9-api-명세)
- [10. 데이터베이스 스키마](#10-데이터베이스-스키마)
- [11. 결론](#11-결론)

### Part 2: 향후 개선 계획 (Future Enhancements)
- [12. 향후 개선 계획](#12-향후-개선-계획)
  - [12.1 문제를 "2개 층"으로 분리](#121-문제를-2개-층으로-분리해서-고정시키기)
  - [12.2 데이터 층 설계](#122-데이터-층-설계-문항이-바뀌어도-깨지지-않게-만드는-3가지-장치)
  - [12.3 의미 층 설계](#123-의미-층-설계-문항-역할role을-일반화해서-어떤-설문이든-카드가-나오게-만들기)
  - [12.4 Analysis Pack 모듈형 설계](#124-analysis-pack을-모듈형으로-설계하기)
  - [12.5 Evidence Catalog 정규화](#125-evidence-catalog를-카드-생산용-부품으로-정규화하기)
  - [12.6 Decision Cards 템플릿](#126-decision-cards를-템플릿-라이브러리--조건부-활성화로-설계하기)
  - [12.7 품질 게이트](#127-문항이-바뀌어도-일관된-결과를-위한-품질-게이트-필수)
  - [12.8 구현 구조 제안](#128-구현-구조-제안-현재-코드-구조에-그대로-꽂히는-형태)
  - [12.9 체크리스트](#129-최종적으로-유동-문항-대응에서-가장-큰-효과를-내는-체크리스트)
  - [12.10 Decision Card 템플릿 10종](#1210-decision-card-템플릿-10종-라이브러리)
  - [12.11 ap-1.1 / dp-1.1 스키마 확장](#1211-ap-11--dp-11-zod-스키마-확장안)
  - [12.12 Role 추정 규칙 확장](#1212-role의미semantics-추정-규칙-확장)
  - [12.13 교차표 자동 선별](#1213-교차표-자동-선별-상위-k만-evidence로-승격)
  - [12.14 DB 마이그레이션](#1214-db-문항-변경증가-대응을-위한-버전스냅샷논리키-마이그레이션)
  - [12.15 프롬프트 입력 개선](#1215-generatedecisionpack-프롬프트-입력도-템플릿-기반으로-추가)
  - [12.16 lint 강화](#1216-lintdecisionpack-강화-포인트-실전에서-깨지는-것-방지)
  - [12.17 적용 순서](#1217-바로-적용-순서-추천-가장-효과-큰-것부터)
- [13. 명세서 변경 이력](#13-명세서-변경-이력)

---

# Part 1: 현재 구현 (Current Implementation)

## 1. 개요

### 1.1 목적
설문조사 응답 데이터를 기반으로 동적으로 AI 분석 보고서를 생성하는 시스템입니다. 문항 수가 변경되어도 자동으로 적응하여 분석을 수행합니다.

**구현 상태**: ✅ 완료  
**버전**: ap-1.0 / dp-1.0

### 1.2 핵심 특징
- **동적 문항 처리**: 문항 수와 유형에 관계없이 자동 분석
- **역할 기반 분석**: 문항의 역할(timeframe, project_type, followup_intent 등)을 자동 추정하여 맞춤형 분석 수행
- **2단계 분석 파이프라인**: 
  - **Analysis Pack (ap-1.0)**: 서버에서 계산하는 결정론적 통계 (Deterministic)
  - **Decision Pack (dp-1.0)**: LLM이 생성하는 의사결정 지원 카드 및 액션 플랜

### 1.3 기술 스택
- **AI 모델**: Google Gemini 2.0 Flash (`gemini-2.0-flash-exp`)
- **데이터베이스**: Supabase PostgreSQL
- **형식**: JSON (Analysis Pack) → JSON (Decision Pack) → Markdown (최종 보고서)
- **API**: RESTful API

---

## 2. 시스템 아키텍처

### 2.1 전체 흐름

```
[설문 응답 데이터]
    ↓
[Analysis Pack 생성] (서버 계산)
    ├─ 문항별 통계
    ├─ 교차표 (Crosstabs)
    ├─ 리드 신호 (Lead Signals)
    ├─ Evidence Catalog
    └─ 데이터 품질 평가
    ↓
[Decision Pack 생성] (LLM 생성)
    ├─ Decision Cards (3-5개)
    ├─ Action Board (D+0, D+7, D+14)
    ├─ Playbooks (세일즈/마케팅)
    └─ Survey Next Questions
    ↓
[병합 및 검증]
    ↓
[최종 보고서 렌더링] (Markdown)
```

### 2.2 파일 구조

```
lib/surveys/analysis/
├── buildAnalysisPack.ts          # Analysis Pack 생성 (서버 계산)
├── buildComputedMetrics.ts       # 교차표, 리드 신호, Evidence Catalog 계산
├── generateDecisionPack.ts      # Decision Pack 생성 (LLM 호출)
├── mergeAnalysisAndDecisionPack.ts  # 두 Pack 병합 및 검증
├── renderFinalReportMD.ts        # 최종 Markdown 렌더링
├── renderAnalysisPackMD.ts       # Analysis Pack만 렌더링
├── analysisPackSchema.ts        # Analysis Pack 스키마 (Zod)
├── decisionPackSchema.ts         # Decision Pack 스키마 (Zod)
└── lintDecisionPack.ts          # Decision Pack 품질 검증

app/api/event-survey/campaigns/[campaignId]/analysis/
└── generate/route.ts             # API 엔드포인트
```

---

## 3. Analysis Pack 생성 (ap-1.0)

**구현 상태**: ✅ 완료  
**버전**: ap-1.0  
**참고 파일**: `lib/surveys/analysis/buildAnalysisPack.ts`, `lib/surveys/analysis/analysisPackSchema.ts`

### 3.0 스키마 구조 (ap-1.0)

현재 구현된 Analysis Pack 스키마:

```typescript
{
  version: 'ap-1.0',
  campaign: {
    id: string (UUID),
    title: string,
    analyzedAtISO: string (ISO datetime),
    sampleCount: number (positive integer),
    totalQuestions: number (positive integer)
  },
  questions: Array<{
    questionId: string (UUID),
    questionBody: string,
    questionType: 'single' | 'multiple' | 'text',
    responseCount: number (non-negative integer),
    topChoices?: Array<{
      text: string,
      count: number,
      percentage: number (0-100)
    }>
  }>,
  evidenceCatalog: Array<{
    id: string (E1, E2, ...),
    title: string (min 5 chars),
    metric: '분포' | '교차표' | '리드 스코어' | '데이터 품질',
    valueText: string (min 3 chars),
    n: number (positive integer),
    source: 'qStats' | 'crosstab' | 'derived' | 'dataQuality',
    notes?: string
  }> (min 3 items),
  crosstabs: Array<{
    id: string,
    rowQuestionId: string (UUID),
    rowQuestionBody: string,
    colQuestionId: string (UUID),
    colQuestionBody: string,
    rowTotals: Record<string, number>,
    colTotals: Record<string, number>,
    cells: Array<{
      rowKey: string,
      colKey: string,
      count: number,
      rowPct: number (0-100),
      colPct: number (0-100),
      lift: number
    }>,
    minCellCount: number
  }>,
  highlights: Array<{
    id: string (H1, H2, ...),
    title: string (min 10 chars),
    evidenceIds: Array<string> (E1, E2, ...) (min 2 items),
    statement: string (min 20 chars),
    confidence: 'Confirmed' | 'Directional' | 'Hypothesis'
  }> (max 5 items),
  dataQuality: Array<{
    level: 'info' | 'warning',
    message: string (min 5 chars)
  }>,
  leadQueue?: {
    distribution: Array<{
      tier: 'P0' | 'P1' | 'P2' | 'P3' | 'P4',
      count: number,
      pct: number (0-100)
    }>
  }
}
```

### 3.1 동적 문항 처리

### 3.1 동적 문항 처리

#### 3.1.1 문항 조회
```typescript
// buildAnalysisPack.ts
const { data: questions } = await admin
  .from('form_questions')
  .select('*')
  .eq('form_id', campaignData.form_id)
  .order('order_no', { ascending: true })

// 문항 수에 관계없이 동적으로 처리
questions.forEach((question) => {
  // 각 문항별 통계 계산
})
```

**특징**:
- 문항 수가 3개든 10개든 자동으로 처리
- `order_no` 기준으로 정렬하여 순서 보장
- 문항 유형(single, multiple, text)에 따라 다른 처리

#### 3.1.2 문항 역할 자동 추정

```typescript
// buildAnalysisPack.ts (104-149줄)
const questionsWithRole: Question[] = questions.map((q: any) => {
  const questionText = (q.body || '').toLowerCase()
  const optionsText = JSON.stringify(parsedOptions).toLowerCase()
  
  let role: 'timeframe' | 'project_type' | 'followup_intent' | 'other' = 'other'
  
  // timeframe 추정
  if (
    questionText.includes('언제') ||
    questionText.includes('계획') ||
    optionsText.includes('1주') ||
    optionsText.includes('1개월')
  ) {
    role = 'timeframe'
  }
  // project_type 추정
  else if (
    questionText.includes('프로젝트') ||
    questionText.includes('종류') ||
    optionsText.includes('데이터센터')
  ) {
    role = 'project_type'
  }
  // followup_intent 추정
  else if (
    questionText.includes('의향') ||
    questionText.includes('요청') ||
    optionsText.includes('방문')
  ) {
    role = 'followup_intent'
  }
  
  return { ...q, role }
})
```

**역할 추정 규칙**:
- **timeframe**: "언제", "계획", "1주", "1개월" 등의 키워드
- **project_type**: "프로젝트", "종류", "데이터센터" 등의 키워드
- **followup_intent**: "의향", "요청", "방문", "미팅" 등의 키워드
- **other**: 위 조건에 해당하지 않는 경우

**동적 처리**:
- 문항이 추가/삭제되어도 역할 자동 추정
- 역할이 없는 문항도 통계는 정상 계산
- 역할 기반 분석(교차표, 리드 스코어링)은 역할이 있는 문항만 사용

### 3.2 문항별 통계 계산

```typescript
// buildAnalysisPack.ts (191-251줄)
const questionStats: any[] = []
for (const question of questions) {
  const questionAnswers = answersArray.filter(
    (a) => a.question_id === question.id
  )
  
  const stats: any = {
    questionId: question.id,
    orderNo: question.order_no,
    questionBody: question.body,
    questionType: question.type,
    totalAnswers: questionAnswers.length,
    // ...
  }
  
  // 문항 유형별 처리
  if (question.type === 'text') {
    stats.textAnswers = questionAnswers
      .map((a: any) => a.text_answer || '')
      .filter(Boolean)
  } else if (question.type === 'single' || question.type === 'multiple') {
    // 선택형: 분포 계산
    const distribution: Record<string, number> = {}
    questionAnswers.forEach((answer: any) => {
      const choiceIds = answer.choice_ids || []
      choiceIds.forEach((choiceId: string) => {
        distribution[choiceId] = (distribution[choiceId] || 0) + 1
      })
    })
    
    // Top choices 계산 (상위 5개)
    const topChoices = Object.entries(distribution)
      .map(([choiceId, count]) => ({
        text: option?.text || choiceId,
        count,
        percentage: ((count / totalAnswers) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    stats.topChoices = topChoices
  }
  
  questionStats.push(stats)
}
```

**동적 처리 특징**:
- 문항 수에 관계없이 모든 문항에 대해 통계 계산
- 문항 유형별로 다른 처리 로직 적용
- 선택형 문항은 자동으로 분포 및 Top choices 계산

### 3.3 교차표 생성 (Crosstabs)

```typescript
// buildComputedMetrics.ts (72-118줄)
export function buildCrosstabs(
  questions: Question[],
  answers: Answer[],
  submissions: Submission[]
): Crosstab[] {
  const crosstabs: Crosstab[] = []
  
  // 역할 기반으로 핵심 쌍 선택
  const timingQuestion = questions.find((q) => q.role === 'timeframe')
  const followupQuestion = questions.find((q) => q.role === 'followup_intent')
  const projectTypeQuestion = questions.find((q) => q.role === 'project_type')
  
  // Timing × Followup 교차표
  if (timingQuestion && followupQuestion) {
    crosstabs.push(calculateCrosstab(...))
  }
  
  // ProjectType × Followup 교차표
  if (projectTypeQuestion && followupQuestion) {
    crosstabs.push(calculateCrosstab(...))
  }
  
  // Timing × ProjectType 교차표
  if (timingQuestion && projectTypeQuestion) {
    crosstabs.push(calculateCrosstab(...))
  }
  
  return crosstabs
}
```

**동적 처리 특징**:
- 역할이 있는 문항만 교차표 생성
- 역할 조합에 따라 자동으로 교차표 생성
- 문항이 추가되어도 역할만 맞으면 자동으로 교차표에 포함

**교차표 계산**:
- Lift 계산: `lift = P(col|row) / P(col overall)`
- 셀별 표본 수 확인 (5 미만이면 경고)
- Row/Column 총계 자동 계산

### 3.4 리드 스코어링 (Lead Signals)

```typescript
// buildComputedMetrics.ts (237-325줄)
export function buildLeadSignals(
  questions: Question[],
  answers: Answer[],
  submissions: Submission[]
): LeadSignalsSummary {
  const timingQuestion = questions.find((q) => q.role === 'timeframe')
  const followupQuestion = questions.find((q) => q.role === 'followup_intent')
  const projectTypeQuestion = questions.find((q) => q.role === 'project_type')
  
  // 최소 조건 확인
  const leadScoringEnabled = Boolean(
    timingQuestion &&
    followupQuestion &&
    timingQuestion.id !== followupQuestion.id
  )
  
  if (!leadScoringEnabled) {
    return {
      distribution: [],
      channelPreference: {},
      timingDistribution: {},
      leadQueue: [],
    }
  }
  
  // 각 submission별 리드 스코어 계산
  submissions.forEach((submission) => {
    const timingScore = calculateTimingScore(...)
    const followupScore = calculateFollowupScore(...)
    const projectTypeScore = calculateProjectTypeScore(...)
    
    const leadScore = timingScore + followupScore + projectTypeScore
    const tier = getTierFromScore(leadScore) // P0-P4
    
    leadQueue.push({ ... })
  })
  
  return { distribution, channelPreference, timingDistribution, leadQueue }
}
```

**동적 처리 특징**:
- 역할 기반으로 자동 활성화/비활성화
- 필요한 역할이 없으면 빈 결과 반환 (에러 없음)
- 역할이 추가되면 자동으로 스코어링에 포함

**스코어링 규칙**:
- **Timing Score**: 1주일 이내(30점), 1개월(25점), 3개월(20점) 등
- **Followup Score**: 방문 요청(20점), 온라인 미팅(15점), 전화 상담(10점) 등
- **Project Type Score**: 데이터센터(15점), 보안(12점), 라우팅(10점) 등
- **Tier 분류**: P0(80+), P1(60+), P2(40+), P3(20+), P4(<20)

### 3.5 Evidence Catalog 생성

```typescript
// buildComputedMetrics.ts (562-644줄)
export function buildEvidenceCatalog(
  questionStats: any[],
  crosstabs: Crosstab[],
  crosstabHighlights: CrosstabHighlight[],
  leadSignals: LeadSignalsSummary,
  dataQuality: Array<{ level: string; message: string }>,
  sampleCount: number
): EvidenceItem[] {
  const evidence: EvidenceItem[] = []
  let evidenceIdCounter = 1
  
  // 1. 문항별 분포 (동적으로 생성)
  questionStats.forEach((stat, index) => {
    if (stat.topChoices && stat.topChoices.length > 0) {
      const topChoice = stat.topChoices[0]
      evidence.push({
        id: `E${evidenceIdCounter++}`,
        title: `${stat.questionBody} 분포`,
        metric: '분포',
        valueText: `${topChoice.percentage}% (${topChoice.count}/${sampleCount})`,
        n: sampleCount,
        source: 'qStats',
        notes: `상위 선택지: ${topChoice.text}`,
      })
    }
  })
  
  // 2. 교차표 하이라이트
  crosstabHighlights.forEach((highlight) => {
    evidence.push({
      id: `E${evidenceIdCounter++}`,
      title: `${highlight.rowQuestionBody} × ${highlight.colQuestionBody}`,
      metric: '교차표',
      valueText: `lift ${highlight.lift.toFixed(2)}, ${highlight.count}명`,
      n: highlight.count,
      source: 'crosstab',
      notes: highlight.highlight,
    })
  })
  
  // 3. 리드 스코어 분포
  leadSignals.distribution.forEach((dist) => {
    if (dist.count > 0) {
      evidence.push({
        id: `E${evidenceIdCounter++}`,
        title: `${dist.tier} 리드 분포`,
        metric: '리드 스코어',
        valueText: `${dist.pct}% (${dist.count}/${sampleCount})`,
        n: dist.count,
        source: 'derived',
      })
    }
  })
  
  return evidence
}
```

**동적 처리 특징**:
- 문항 수에 따라 Evidence ID 자동 생성 (E1, E2, E3, ...)
- 교차표가 생성된 경우에만 교차표 Evidence 추가
- 리드 스코어링이 활성화된 경우에만 리드 Evidence 추가

---

## 4. Decision Pack 생성 (dp-1.0)

**구현 상태**: ✅ 완료  
**버전**: dp-1.0  
**참고 파일**: `lib/surveys/analysis/generateDecisionPack.ts`, `lib/surveys/analysis/decisionPackSchema.ts`, `lib/surveys/analysis/lintDecisionPack.ts`

### 4.0 스키마 구조 (dp-1.0)

현재 구현된 Decision Pack 스키마:

```typescript
{
  version: 'dp-1.0',
  decisionCards: Array<{
    question: string (min 10 chars),
    options: Array<{
      id: 'A' | 'B' | 'C',
      title: string (min 5 chars),
      description: string (min 10 chars),
      expectedImpact: string (min 10 chars),
      risks?: string
    }> (2-3 items),
    recommendation: 'A' | 'B' | 'C',
    evidenceIds: Array<string> (E1, E2, ...) (min 2 items),
    confidence: 'Confirmed' | 'Directional' | 'Hypothesis',
    rationale: string (min 20 chars)
  }> (3-5 items),
  actionBoard: {
    d0?: Array<{
      owner: 'sales' | 'marketing' | 'ops',
      title: string (min 5 chars),
      targetCount: string (regex: /\d+(명|건)/),
      kpi: string (min 5 chars),
      steps: Array<string> (min 3 chars each) (min 1 item)
    }>,
    d7?: Array<ActionItem>,
    d14?: Array<ActionItem>
  },
  playbooks: {
    sales: Array<string> (min 5 chars each) (min 1 item),
    marketing: Array<string> (min 5 chars each) (min 1 item)
  },
  surveyNextQuestions: Array<{
    question: string (min 5 chars),
    answerType: 'single' | 'multiple' | 'text',
    why: string (min 10 chars)
  }> (min 1 item)
}
```

**참고**: 현재 스키마에는 `templateId` 필드가 없습니다. 향후 계획(Part 2)에서 제안됩니다.

### 4.1 생성 프로세스

```typescript
// generateDecisionPack.ts
export async function generateDecisionPackWithRetry(
  analysisPack: AnalysisPack,
  maxRetries = 4
): Promise<{ decisionPack: DecisionPack; warnings: LinterWarning[] }> {
  // 재시도 로직 포함
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const decisionPack = await generateDecisionPack(...)
      const linterResult = lintDecisionPack(decisionPack, analysisPack)
      
      if (linterResult.isValid) {
        return { decisionPack, warnings: linterResult.warnings }
      }
      
      // 품질 검증 실패 시 재시도
    } catch (error) {
      // 스키마 검증 실패 시 재시도
    }
  }
}
```

**재시도 전략**:
- 최대 4회 재시도
- 스키마 검증 실패 시 오류 정보를 프롬프트에 포함하여 재시도
- 품질 검증 실패 시 경고 정보를 프롬프트에 포함하여 재시도
- 지수 백오프 (1초, 2초, 4초, 8초)

### 4.2 프롬프트 구조

```typescript
// generateDecisionPack.ts (88-111줄)
const systemPrompt = `당신은 B2B 세일즈/마케팅 의사결정 지원 전문가입니다.

**핵심 원칙:**
1. **Evidence 기반**: 모든 결론은 반드시 Evidence Catalog의 ID를 참조해야 합니다 (예: "E1", "E2")
2. **구체적 액션**: 각 액션은 담당자, 대상 수량, 목표 KPI를 포함해야 합니다
3. **명확한 추천**: Decision Cards는 A/B/C 옵션을 비교하고 명확한 추천을 제시해야 합니다
4. **실행 가능성**: Action Board는 24시간/7일/14일 단위로 구체적인 실행 계획을 포함해야 합니다

**필수 출력 형식:**
- Decision Cards: 정확히 3-5개 (반드시 포함)
- Action Board: d0 (24시간), d7 (7일), d14 (14일) 각각 최소 1개 이상 (반드시 포함)
- Playbooks: 세일즈/마케팅 각각 최소 3개 이상 (반드시 포함)
- Survey Next Questions: 최소 2개 이상 (반드시 포함)
`
```

**동적 처리**:
- Analysis Pack의 Evidence Catalog를 그대로 전달
- 문항 수에 관계없이 동일한 프롬프트 구조 사용
- Evidence ID는 동적으로 생성되므로 문항 수에 따라 자동 조정

### 4.3 Decision Cards 생성

**필수 질문 (최소 3개 포함)**:
1. "지금 바로 컨택해야 하는 리드는 몇 명인가?"
2. "영업 리소스가 제한될 때, 어느 채널에 몇 슬롯을 배정해야 하나?"
3. "마케팅은 어떤 메시지/오퍼로 어떤 세그먼트를 먼저 치면 되나?"
4. "다음 설문에서 어떤 질문을 추가해야 하나?" (선택)

**각 카드 구조**:
```typescript
{
  question: string,              // 의사결정 질문
  options: [
    {
      id: "A" | "B" | "C",       // 옵션 ID (반드시 A/B/C)
      title: string,              // 옵션 제목
      description: string,        // 옵션 설명
      expectedImpact: string,    // 기대 효과
      risks?: string             // 리스크 (선택)
    }
  ],
  recommendation: "A" | "B" | "C", // 추천 옵션
  evidenceIds: string[],         // Evidence ID 참조 (최소 2개)
  confidence: "Confirmed" | "Directional" | "Hypothesis",
  rationale: string             // 추천 이유 (최소 20자)
}
```

**동적 처리**:
- Evidence Catalog의 ID를 동적으로 참조
- 문항 수가 많으면 더 많은 Evidence를 활용 가능
- 문항 수가 적어도 최소 3개의 Decision Cards 생성

### 4.4 Action Board 생성

```typescript
{
  actionBoard: {
    d0: [                        // 24시간 내 실행
      {
        owner: "sales" | "marketing" | "ops",
        title: string,
        targetCount: string,     // "17명", "8건" 형식
        kpi: string,             // "미팅 전환율 40%"
        steps: string[]          // 실행 단계
      }
    ],
    d7: [...],                   // 7일 내 실행
    d14: [...]                   // 14일 내 실행
  }
}
```

**동적 처리**:
- Evidence Catalog의 숫자를 참조하여 targetCount 생성
- 리드 스코어링 결과를 활용하여 우선순위 결정
- 문항 수가 많으면 더 세분화된 액션 생성 가능

---

## 5. 병합 및 검증

### 5.1 병합 프로세스

```typescript
// mergeAnalysisAndDecisionPack.ts
export function mergeAnalysisAndDecisionPack(
  analysisPack: AnalysisPack,
  decisionPack: DecisionPack
): MergedReport {
  // 1. Action Board의 숫자 검증 및 덮어쓰기
  // 2. Decision Cards의 evidenceIds 유효성 확인
  // 3. 최종 MergedReport 생성
}
```

**검증 항목**:
- Action Board의 targetCount가 Evidence Catalog와 일치하는지 확인
- Decision Cards의 evidenceIds가 실제 존재하는 Evidence인지 확인
- 숫자 불일치 시 서버 계산값으로 자동 교정

---

## 6. 동적 처리 요약

### 6.1 문항 수 변경 시 자동 적응

| 구성 요소 | 동적 처리 방식 |
|---------|--------------|
| **문항별 통계** | 모든 문항에 대해 for 루프로 자동 계산 |
| **교차표** | 역할이 있는 문항 조합에 따라 자동 생성 |
| **리드 스코어링** | 필요한 역할이 있으면 활성화, 없으면 비활성화 |
| **Evidence Catalog** | 문항 수에 따라 Evidence ID 자동 생성 (E1, E2, ...) |
| **Decision Cards** | Evidence Catalog를 참조하여 동적으로 생성 |
| **Action Board** | Evidence의 숫자를 참조하여 동적으로 생성 |

### 6.2 문항 역할 변경 시 자동 적응

| 역할 | 영향 범위 |
|-----|---------|
| **timeframe 추가** | Timing × Followup 교차표 자동 생성, 리드 스코어링 활성화 |
| **project_type 추가** | ProjectType × Followup 교차표 자동 생성, 리드 스코어링 활성화 |
| **followup_intent 추가** | 모든 관련 교차표 자동 생성, 리드 스코어링 활성화 |
| **역할 없음** | 통계는 계산되지만 교차표/리드 스코어링에는 미사용 |

### 6.3 문항 유형 변경 시 자동 적응

| 유형 | 처리 방식 |
|-----|---------|
| **single** | 선택 분포 계산, Top choices 추출 |
| **multiple** | 복수 선택 분포 계산, Top choices 추출 |
| **text** | 텍스트 응답 수집 (분석은 LLM이 수행) |

---

## 7. 개선 제안

### 7.1 현재 구조의 장점
✅ 문항 수에 관계없이 자동 처리  
✅ 역할 기반으로 맞춤형 분석  
✅ Evidence 기반으로 일관성 있는 분석  
✅ 재시도 로직으로 안정성 확보  

### 7.2 개선 가능 영역

#### 7.2.1 문항 역할 추정 정확도 향상
- **현재**: 키워드 기반 추정 (정확도 약 70-80%)
- **개선안**: 
  - ML 모델 기반 역할 분류
  - 사용자 수동 지정 옵션 제공
  - 역할 추정 결과 검증 UI

#### 7.2.2 교차표 생성 전략 개선
- **현재**: 역할 기반으로만 교차표 생성 (최대 3개)
- **개선안**:
  - 모든 문항 쌍에 대해 교차표 생성 (N×N)
  - Lift가 높은 교차표만 선별
  - 사용자가 관심 있는 문항 쌍 지정 가능

#### 7.2.3 Evidence Catalog 확장
- **현재**: 문항 분포, 교차표, 리드 스코어만 포함
- **개선안**:
  - 텍스트 응답 키워드 분석 결과
  - 응답 시간 분포
  - 응답 완료율 등 추가 메트릭

#### 7.2.4 Decision Cards 질문 커스터마이징
- **현재**: 고정된 4개 질문 중 3-5개 선택
- **개선안**:
  - 사용자가 원하는 질문 추가 가능
  - 도메인별 템플릿 제공 (B2B, B2C, 이벤트 등)

---

## 8. 사용 예시

### 8.1 3개 문항 설문조사
```
문항 1: 프로젝트 계획 시기 (timeframe)
문항 2: 프로젝트 유형 (project_type)
문항 3: 후속 액션 의향 (followup_intent)

→ 생성되는 분석:
- 3개 문항별 통계
- 3개 교차표 (Timing×Followup, ProjectType×Followup, Timing×ProjectType)
- 리드 스코어링 활성화
- Evidence Catalog: E1-E6 (문항 3개 + 교차표 3개)
- Decision Cards: 3-4개
```

### 8.2 5개 문항 설문조사
```
문항 1: 프로젝트 계획 시기 (timeframe)
문항 2: 프로젝트 유형 (project_type)
문항 3: 후속 액션 의향 (followup_intent)
문항 4: 예산 확보 여부 (other)
문항 5: 의사결정 권한 (other)

→ 생성되는 분석:
- 5개 문항별 통계
- 3개 교차표 (역할 기반)
- 리드 스코어링 활성화
- Evidence Catalog: E1-E8 (문항 5개 + 교차표 3개)
- Decision Cards: 4-5개 (더 많은 Evidence 활용)
```

### 8.3 10개 문항 설문조사
```
문항 1-10: 다양한 문항 (역할 자동 추정)

→ 생성되는 분석:
- 10개 문항별 통계
- 역할이 있는 문항 조합에 따른 교차표
- Evidence Catalog: E1-E15+ (문항 10개 + 교차표 + 리드)
- Decision Cards: 5개 (최대)
- 더 풍부한 인사이트 제공
```

---

## 9. API 명세

### 9.1 분석 보고서 생성

**엔드포인트**: `POST /api/event-survey/campaigns/[campaignId]/analysis/generate`

**요청 본문**:
```typescript
{
  lens?: 'general' | 'sales' | 'marketing'  // 분석 관점 (기본값: 'general')
}
```

**응답**:
```typescript
{
  success: true,
  report: {
    id: string,
    campaign_id: string,
    analyzed_at: string,
    sample_count: number,
    total_questions: number,        // 동적으로 계산됨
    lens: string,
    report_title: string,
    summary: string,
    action_pack: DecisionPack | null,
    created_at: string
  }
}
```

**처리 시간**:
- Analysis Pack 생성: 1-3초
- Decision Pack 생성: 10-30초 (LLM 호출)
- 총 소요 시간: 15-35초

---

## 10. 데이터베이스 스키마

### 10.1 survey_analysis_reports 테이블

```sql
CREATE TABLE survey_analysis_reports (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL,
  sample_count INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,        -- 동적으로 저장됨
  
  -- 보고서 내용
  report_content TEXT NOT NULL,            -- 최종 Markdown
  report_content_full_md TEXT NOT NULL,    -- 완성본
  report_md TEXT,                          -- v2 Markdown
  
  -- 스냅샷 (JSONB)
  statistics_snapshot JSONB NOT NULL,      -- Analysis Pack + Decision Pack
  analysis_pack JSONB,                     -- Analysis Pack
  decision_pack JSONB,                     -- Decision Pack
  
  -- 메타데이터
  lens TEXT DEFAULT 'general',
  references_used JSONB,
  generation_warnings JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL
);
```

**동적 필드**:
- `total_questions`: 문항 수에 따라 자동 저장
- `statistics_snapshot`: 문항 수에 따라 구조가 달라짐
- `analysis_pack`: 문항 수에 따라 `questions` 배열 크기 변경
- `decision_pack`: Evidence 수에 따라 `evidenceIds` 배열 크기 변경

---

## 11. 결론

### 11.1 현재 시스템의 강점
1. **완전한 동적 처리**: 문항 수, 유형, 역할에 관계없이 자동 분석
2. **역할 기반 맞춤 분석**: 문항의 역할을 자동 추정하여 최적화된 분석 수행
3. **Evidence 기반 일관성**: 모든 분석이 Evidence Catalog를 참조하여 일관성 유지
4. **안정적인 재시도**: 스키마/품질 검증 실패 시 자동 재시도

### 11.2 향후 개선 방향
1. **역할 추정 정확도 향상**: ML 모델 또는 사용자 지정 옵션
2. **교차표 생성 전략 개선**: 모든 문항 쌍 분석 후 선별
3. **Evidence Catalog 확장**: 더 다양한 메트릭 추가
4. **Decision Cards 커스터마이징**: 사용자 정의 질문 지원

---

---

# Part 2: 향후 개선 계획 (Future Enhancements)

**구현 상태**: ⏳ 계획 중  
**예상 버전**: ap-1.1 / dp-1.1  
**예상 일정**: TBD

---

## 12. 향후 개선 계획

### 12.1 개요

아래 설계는 **"디시전카드(Decision Cards)가 핵심"**이라는 전제를 유지하면서, **설문 문항이 늘어나거나/바뀌어도 자동으로 분석이 적응**하도록 만드는 구조입니다. 현재 시스템이 이미 채택한 **2단계 파이프라인(Analysis Pack → Decision Pack)**을 기반으로, "문항 유동성" 때문에 깨지기 쉬운 지점을 **스키마/버전/역할(semantic role)/모듈형 분석/카드 템플릿**으로 고정시키는 방식입니다. 

---

### 12.1 문제를 "2개 층"으로 분리해서 고정시키기

설문 문항이 유동적일 때 깨지는 이유는 거의 항상 2가지입니다.

1. **데이터 층의 불안정**

* 문항 ID/선택지 ID가 바뀜
* 오픈 중에 문항 텍스트/선택지가 수정됨
* 기존 응답과 새 응답이 “같은 질문”인지 “다른 질문”인지 애매해짐

2. **해석 층(디시전카드)의 불안정**

* 카드가 특정 문항(예: ‘타임프레임’, ‘후속컨택 의향’)을 전제로 설계되어 있는데, 문항이 빠지거나 이름이 바뀌면 카드 생성이 무너짐
* 근거(evidence)가 어떤 문항에서 나오는지 못 찾아서 “추정”이 섞임

그래서 설계의 핵심은:

* **데이터 층**: “문항이 바뀌어도 분석 가능한 형태로 스냅샷/버전/정규화”
* **해석 층**: “문항이 바뀌어도 카드가 생성되도록 ‘역할(role) 기반 + 모듈형 카드 선택’”

---

### 12.2 데이터 층 설계: 문항이 바뀌어도 깨지지 않게 만드는 3가지 장치

#### 12.2.1 "Published Form Version(발행 버전)" 개념으로 혼합 응답을 차단/관리

오픈된 설문에서 문항을 편집하면, 현실적으로 **응답 데이터는 섞입니다.**
이걸 방치하면 분석 신뢰도가 급락합니다.

권장 전략(둘 중 하나):

**전략 1) 오픈 상태에서는 문항 구조 잠금**

* `forms.status = open`이면 `form_questions` 수정/삭제 제한
* 바꾸려면 `closed` → 수정 → 다시 `open`

**전략 2) 오픈 상태에서 수정 허용하되 “버전 발행”**

* `forms.published_version` (int) 도입
* 질문은 `(form_id, version, order_no)` 단위로 스냅샷
* 제출은 `submission.form_version`에 해당 버전 번호를 저장

> 이 방식이면 “문항이 바뀌었다”는 사실이 데이터 구조로 고정돼서, 분석 시 **버전별로 분리/비교/병합**을 할 수 있습니다.

---

#### 12.2.2 답변에 "질문/선택지 스냅샷" 저장 (가장 현실적인 안전장치)

지금처럼 `form_answers`가 `question_id`를 참조하는 구조는 좋은데,
운영자가 문항 텍스트나 선택지 텍스트를 수정하면 **과거 응답의 의미가 바뀌어 보일 수 있어요.**

그래서 제출 시점에 아래를 같이 저장하는 걸 추천합니다:

* `form_answers.question_body_snapshot`
* `form_answers.option_snapshot` (선택형일 때 선택지 텍스트/ID 리스트)
* (가능하면) `form_answers.question_role_snapshot` (아래 role 추정 결과)

이러면 나중에 질문 텍스트가 바뀌어도, 분석 보고서는 **“응답자가 실제로 본 질문/선택지”** 기준으로 재현 가능합니다.

---

#### 12.2.3 "Logical Question Key"로 유사 문항 자동 병합/추적

문항이 “살짝 바뀌는” 케이스(문구 수정, 선택지 순서 변경 등)에서는 운영자가 기대하는 건 보통:

* “그 질문 계속 같은 질문이야. 하나로 보고 싶어.”

이를 위해 질문마다 **논리 키(logical key)**를 두세요.

예:

* `form_questions.logical_key = "timeline"`
* `form_questions.logical_key = "budget_confirmed"`
* `form_questions.logical_key = "authority_level"`

부여 방식은 3단계:

1. 운영자가 직접 지정(최고 정확)
2. 없으면 서버가 role/classification으로 자동 부여(아래 3절)
3. 그래도 못하면 해시 기반 임시 키 생성(문항 body 기반)

> 이 logical_key가 있으면 질문 ID가 바뀌어도 “같은 질문”으로 묶어서 추이를 낼 수 있습니다.

---

### 12.3 의미 층 설계: 문항 "역할(Role)"을 일반화해서 어떤 설문이든 카드가 나오게 만들기

현재 명세에서 role을 `timeframe / project_type / followup_intent / other`로 추정하고, 그 role을 기반으로 교차표/리드스코어를 켜는 구조가 이미 잡혀있죠. 
이 방향이 맞습니다. 다만 “문항이 유동적”이면 role taxonomy(역할 분류)를 조금 더 확장해야 **카드가 항상 만들어집니다.**

#### 12.3.1 추천 Role Taxonomy (최소 10~14개로 확장)

B2B 설문에서 디시전카드가 가장 잘 나오는 축을 기준으로 role을 확장합니다:

* **intent_followup**: 미팅/연락/데모 의향
* **timeline**: 도입 시기/구매 시점
* **need_pain**: 문제/니즈/우선순위
* **usecase_project_type**: 프로젝트 유형/적용 분야
* **budget_status**: 예산 확보 여부/범위
* **authority**: 의사결정 권한/역할
* **company_profile**: 산업/규모/직무
* **current_stack_vendor**: 현재 솔루션/벤더
* **channel_preference**: 선호 채널(이메일/전화/방문 등)
* **satisfaction_nps**: 만족/추천/평점
* **barrier_risk**: 장애요인/우려/리스크
* **free_text_voice**: 자유응답/코멘트
* **other**

이렇게 해두면, 어떤 설문이 들어와도 최소한:

* “세그먼트는 어떻게 나뉘나?”
* “지금 당장 액션(영업/마케팅)은 뭐부터 하나?”
* “다음 설문에서 뭘 물어야 하나?”
  카드는 항상 생성 가능합니다.

---

### 12.4 Analysis Pack을 "모듈형"으로 설계하기

현재 구조(Analysis Pack은 결정론적 통계, Decision Pack은 LLM 생성)를 그대로 유지하되 ,
**Analysis Pack 안에 ‘분석 계획(analysisPlan)’을 명시적으로 포함**시키면 문항이 바뀌어도 안정성이 크게 올라갑니다.

#### 12.4.1 Analysis Pack에 "Question Semantics"를 표준 필드로 추가

각 문항에 대해 아래를 계산/저장:

* `role` (위 taxonomy)
* `measureType`: `categorical_single | categorical_multi | numeric | text`
* `isKeyDriverCandidate`: 핵심 드라이버 후보인지
* `qualityFlags`: 표본 부족/편향/결측률 등

> 이 정보가 있으면 Decision Pack 단계에서 LLM이 “어떤 문항이 중요한지”를 추측하지 않아도 됩니다.

---

#### 12.4.2 교차표를 "역할 기반 + 자동 상위선별"로 확장

현재는 `timeframe/followup_intent/project_type` 조합 중심의 3개 교차표 정도만 만들죠. 
문항이 늘어나는 상황에서는 다음이 더 안정적입니다:

1. 후보 쌍 생성

* categorical 문항들 중에서
* role이 `intent_followup, timeline, budget_status, authority, usecase_project_type, channel_preference` 같은 “의사결정 관련 role” 우선

2. 각 쌍에 대해 빠르게 스코어링

* lift 최대값
* Cramér’s V(가능하면)
* 최소 셀 표본수(예: cell n<5 패널티)

3. 상위 K개만 Evidence로 승격 (예: K=5~10)

이러면 문항이 5개 → 15개로 늘어도 “분석 가치 있는 교차표만” 자동으로 올라오고, 디시전카드 근거가 풍부해집니다.

---

#### 12.4.3 텍스트 문항은 "결정론 + LLM 요약"을 분리

텍스트는 결정론으로 100% 처리하기 어렵습니다. 대신:

**서버(결정론)**

* 응답 수, 빈도, 길이 분포, 공백/중복률, 상위 키워드(간단 토큰화) 정도까지만

**LLM(해석)**

* 토픽 3~7개
* 대표 인용(짧게, 개인정보 제거)
* “리스크/기회/요구사항” 분류

그리고 이것도 Evidence Catalog에 ID로 넣습니다.

---

### 12.5 Evidence Catalog를 "카드 생산용 부품"으로 정규화하기

현재 Evidence Catalog가 이미 “E1..En”으로 잘 되어 있어요. 
여기서 한 단계 더 나가면, 디시전카드가 문항이 바뀌어도 훨씬 튼튼해집니다.

#### 12.5.1 Evidence를 타입 기반으로 표준화

예를 들어:

* `type: "distribution_top1"` (문항 분포 Top1)
* `type: "distribution_entropy"` (분포가 갈리는 질문)
* `type: "crosstab_lift_high"` (교차표 lift가 높은 셀)
* `type: "lead_tier_distribution"` (P0~P4 분포)
* `type: "text_topic"` (텍스트 토픽)
* `type: "data_quality_warning"` (품질 경고)

그리고 각 evidence는 공통 필드:

* `id`
* `title`
* `n`
* `valueText`
* `sourcePointer` (questionId/logical_key/crosstab ids)
* `reliability` (Confirmed/Directional/Hypothesis)

이렇게 하면 **Decision Card 템플릿이 “질문 ID”가 아니라 “evidence 타입”을 찾게** 만들 수 있어요.

---

### 12.6 Decision Cards를 "템플릿 라이브러리 + 조건부 활성화"로 설계하기

문항이 바뀔 때 카드가 깨지는 이유는 “항상 같은 3~5개 질문을 카드로 만들려고” 하기 때문입니다.

해결책은 간단합니다:

* 카드 유형을 10개 내외로 정의하고
* 각 카드 유형마다 “필요한 evidence 조건”을 정의
* 가능한 카드들 중에서 top 3~5개를 자동 선택

#### 12.6.1 카드 템플릿 예시 (필요 evidence 조건 포함)

1. **즉시 컨택해야 하는 리드는 몇 명인가?**

* 조건: `leadSignals.enabled = true` AND `lead_tier_distribution evidence 존재`

2. **제한된 영업 리소스 배분(채널/세그먼트)은?**

* 조건: `channel_preference` role 문항 존재 OR 텍스트/기타에서 채널 언급 토픽 존재

3. **가장 먼저 칠 메시지/오퍼는?**

* 조건: `usecase_project_type` 분포 + (가능하면) `project_type × intent_followup` 교차표 하이라이트

4. **예산/권한(Authority) 기반 우선순위는?**

* 조건: `budget_status` or `authority` role 문항 존재 + 해당 분포/교차표

5. **다음 설문에서 무엇을 추가해야 하나?**

* 조건: 항상 가능 (missing roles + data quality + 텍스트 토픽 기반)

> 이런 식이면, 설문 문항 구성이 바뀌어도 “가능한 카드 조합”이 자동으로 바뀌면서 3~5장을 안정적으로 뽑습니다.

---

### 12.7 "문항이 바뀌어도 일관된 결과"를 위한 품질 게이트 (필수)

현재도 Decision Pack에 대해 스키마 검증/린터/재시도 구조가 있죠. 
유동 문항 대응에서는 아래 3가지 게이트를 추가하면 안정성이 확 올라갑니다.

#### 12.7.1 Gate 1: 카드별 최소 Evidence 규칙

* 카드 1장당 `evidenceIds >= 2`
* evidence가 모두 `Hypothesis`면 그 카드는 제외/대체

#### 12.7.2 Gate 2: 숫자 검증은 "서버가 최종 권위"

* LLM이 targetCount를 말하면
* merge 단계에서 Evidence 숫자와 불일치 시 서버 계산값으로 교정(현재 방향 유지) 

#### 12.7.3 Gate 3: "문항 버전 혼합" 경고 자동 생성

* form_version이 2개 이상 섞여 있으면:

  * Decision Pack confidence를 낮추거나
  * 보고서 상단에 “버전 혼합” 경고 배너를 생성

---

### 12.8 구현 구조 제안 (현재 코드 구조에 그대로 꽂히는 형태)

현재 파일 구조가 이미 파이프라인 형태로 잘 나뉘어 있으니 , 아래만 확장하면 됩니다.

#### 12.8.1 buildAnalysisPack.ts 확장 포인트

* `inferQuestionRole()`을 taxonomy 확장 버전으로 교체
* `inferQuestionSemantics()` 결과를 `analysisPack.questions[]`에 포함
* `buildCrosstabs()`를 “상위 K 자동 선별” 버전으로 확장
* `analysisPlan` 필드 추가 (이번 분석에서 활성화된 모듈/카드 후보)

#### 12.8.2 buildComputedMetrics.ts 확장 포인트

* crosstab 후보군 확장 + 스코어링 + 상위 K 선택
* 텍스트 문항에 대한 최소 결정론 지표 추가(길이/빈도/결측)

#### 12.8.3 generateDecisionPack.ts 확장 포인트

* 프롬프트에 “카드 템플릿 목록 + 활성 조건”을 포함
* LLM이 카드 유형을 선택하도록(임의 생성 금지)
* evidence 타입 기반으로 근거를 찾도록 유도

---

### 12.9 최종적으로 "유동 문항 대응"에서 가장 큰 효과를 내는 체크리스트

1. **오픈 중 문항 변경을 어떻게 처리할지** (잠금 vs 발행버전)
2. **답변에 스냅샷 저장**(질문/선택지 텍스트)
3. **role taxonomy 확장 + 자동 분류 + (가능하면) 운영자 override UI**
4. **교차표/인사이트를 ‘전수 생성’이 아니라 ‘상위 선별’로**
5. **디시전카드는 템플릿 라이브러리 + 조건부 활성화**
6. **Evidence 타입 정규화 + 서버 숫자 교정**

---

원하면, 위 설계를 기준으로 **(a) Zod 스키마(AnalysisPack/DecisionPack) 변경안**, **(b) role taxonomy 분류 규칙(키워드+LLM 하이브리드) 상세**, **(c) 카드 템플릿 10종 세트(JSON 예시 포함)**까지 바로 내려줄게요. 



---

## 12.10 Decision Card 템플릿 10종 라이브러리

**구현 상태**: ⏳ 계획 중  
**예상 파일**: `lib/surveys/analysis/cardTemplates.ts` (신규 생성 예정)

### 12.10.1 핵심 원칙

* LLM이 "카드 내용을 마음대로 창작"하지 않고 **정해진 템플릿 중에서만 고르게** 해야 문항이 바뀌어도 안정적입니다.
* 카드 템플릿은 "질문 ID"가 아니라 **Evidence 타입 + Role 존재 여부**로 활성화됩니다.
* 카드 1장당 evidenceIds **최소 2개**, 그리고 reliability가 전부 Hypothesis면 제외(또는 "가설 카드"로 표시).

### 12.10.2 CardTemplateRegistry (서버 상수)

**예상 파일**: `lib/surveys/analysis/cardTemplates.ts` (신규 생성 예정)

```ts
export type CardTemplateId =
  | 'lead_immediate_contact'
  | 'channel_slot_allocation'
  | 'message_offer_priority'
  | 'timeline_focus'
  | 'budget_authority_priority'
  | 'barrier_risk_handling'
  | 'segment_playbook'
  | 'followup_script'
  | 'survey_gap_next_questions'
  | 'data_quality_actions'

export type EvidenceType =
  | 'lead_tier_distribution'
  | 'lead_top_reasons'
  | 'distribution_top1'
  | 'distribution_entropy_high'
  | 'crosstab_lift_high'
  | 'text_topic'
  | 'data_quality_warning'
  | 'missing_role_gap'

export type QuestionRole =
  | 'intent_followup'
  | 'timeline'
  | 'usecase_project_type'
  | 'budget_status'
  | 'authority'
  | 'channel_preference'
  | 'need_pain'
  | 'barrier_risk'
  | 'company_profile'
  | 'current_stack_vendor'
  | 'satisfaction_nps'
  | 'free_text_voice'
  | 'other'

export interface CardTemplate {
  id: CardTemplateId
  title: string
  primaryQuestion: string
  activation: {
    minSampleCount?: number
    requiresModulesAny?: Array<'leadSignals' | 'crosstabs' | 'textTopics' | 'segments'>
    requiresRolesAny?: QuestionRole[]
    requiresEvidenceTypesAny?: EvidenceType[]
    requiresEvidenceTypesAll?: EvidenceType[]
  }
  // 카드 생성 시 evidence를 고르는 규칙(서버가 preselect해서 LLM에 주는 것도 추천)
  evidencePick: {
    preferredTypes: EvidenceType[]
    minEvidence: number // 보통 2
    maxEvidence: number // 보통 4~6
  }
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'lead_immediate_contact',
    title: '즉시 컨택 리드 규모와 SLA 결정',
    primaryQuestion: '지금 바로 컨택해야 하는 리드는 몇 명이고, SLA를 어떻게 잡아야 하나?',
    activation: {
      minSampleCount: 10,
      requiresModulesAny: ['leadSignals'],
      requiresEvidenceTypesAny: ['lead_tier_distribution'],
    },
    evidencePick: { preferredTypes: ['lead_tier_distribution', 'lead_top_reasons'], minEvidence: 2, maxEvidence: 6 },
  },
  {
    id: 'channel_slot_allocation',
    title: '제한된 영업 리소스: 채널별 슬롯 배분',
    primaryQuestion: '영업 리소스가 제한될 때, 어느 채널에 몇 슬롯을 배정해야 하나?',
    activation: {
      minSampleCount: 10,
      requiresRolesAny: ['channel_preference', 'intent_followup'],
      requiresEvidenceTypesAny: ['distribution_top1', 'crosstab_lift_high'],
    },
    evidencePick: { preferredTypes: ['crosstab_lift_high', 'distribution_top1'], minEvidence: 2, maxEvidence: 5 },
  },
  {
    id: 'message_offer_priority',
    title: '메시지/오퍼 우선순위',
    primaryQuestion: '마케팅은 어떤 메시지/오퍼로 어떤 세그먼트를 먼저 치면 되나?',
    activation: {
      minSampleCount: 10,
      requiresRolesAny: ['usecase_project_type', 'need_pain'],
      requiresEvidenceTypesAny: ['crosstab_lift_high', 'text_topic', 'distribution_top1'],
    },
    evidencePick: { preferredTypes: ['crosstab_lift_high', 'text_topic', 'distribution_top1'], minEvidence: 2, maxEvidence: 6 },
  },
  {
    id: 'timeline_focus',
    title: '타임라인 기반 우선순위',
    primaryQuestion: '도입 시기(타임라인) 기준으로 무엇부터 쳐야 하나?',
    activation: {
      minSampleCount: 10,
      requiresRolesAny: ['timeline'],
      requiresEvidenceTypesAny: ['distribution_top1', 'distribution_entropy_high', 'crosstab_lift_high'],
    },
    evidencePick: { preferredTypes: ['distribution_top1', 'crosstab_lift_high'], minEvidence: 2, maxEvidence: 5 },
  },
  {
    id: 'budget_authority_priority',
    title: '예산/권한 기반 우선순위',
    primaryQuestion: '예산/권한(Authority) 상태에 따라 세일즈 접근을 어떻게 분기할까?',
    activation: {
      minSampleCount: 10,
      requiresRolesAny: ['budget_status', 'authority'],
      requiresEvidenceTypesAny: ['distribution_top1', 'crosstab_lift_high'],
    },
    evidencePick: { preferredTypes: ['distribution_top1', 'crosstab_lift_high'], minEvidence: 2, maxEvidence: 6 },
  },
  {
    id: 'barrier_risk_handling',
    title: '장애요인/리스크 대응',
    primaryQuestion: '가장 큰 장애요인(리스크)은 무엇이고, 이를 어떻게 제거할까?',
    activation: {
      minSampleCount: 10,
      requiresModulesAny: ['textTopics'],
      requiresEvidenceTypesAny: ['text_topic'],
      requiresRolesAny: ['barrier_risk', 'free_text_voice'],
    },
    evidencePick: { preferredTypes: ['text_topic', 'data_quality_warning'], minEvidence: 2, maxEvidence: 5 },
  },
  {
    id: 'segment_playbook',
    title: '세그먼트 플레이북',
    primaryQuestion: '세그먼트를 어떻게 나누고, 세그먼트별 플레이북을 무엇으로 할까?',
    activation: {
      minSampleCount: 15,
      requiresModulesAny: ['segments'],
      requiresEvidenceTypesAny: ['crosstab_lift_high', 'distribution_entropy_high'],
    },
    evidencePick: { preferredTypes: ['crosstab_lift_high', 'distribution_entropy_high'], minEvidence: 2, maxEvidence: 6 },
  },
  {
    id: 'followup_script',
    title: '후속 컨택 스크립트/동선',
    primaryQuestion: '후속 컨택 의향에 따라 어떤 토크트랙/동선을 써야 하나?',
    activation: {
      minSampleCount: 10,
      requiresRolesAny: ['intent_followup'],
      requiresEvidenceTypesAny: ['distribution_top1', 'crosstab_lift_high'],
    },
    evidencePick: { preferredTypes: ['distribution_top1', 'crosstab_lift_high'], minEvidence: 2, maxEvidence: 6 },
  },
  {
    id: 'survey_gap_next_questions',
    title: '다음 설문에서 무엇을 더 물어야 하나',
    primaryQuestion: '다음 설문에서 어떤 질문을 추가해야 의사결정이 쉬워질까?',
    activation: {
      // 항상 가능(표본이 너무 적으면 dataQuality가 대신 경고)
    },
    evidencePick: { preferredTypes: ['missing_role_gap', 'data_quality_warning'], minEvidence: 2, maxEvidence: 5 },
  },
  {
    id: 'data_quality_actions',
    title: '데이터 품질/해석 리스크 관리',
    primaryQuestion: '해석 리스크(표본/편향/버전 혼합)는 무엇이고, 어떻게 보정할까?',
    activation: {
      requiresEvidenceTypesAny: ['data_quality_warning'],
    },
    evidencePick: { preferredTypes: ['data_quality_warning'], minEvidence: 2, maxEvidence: 5 },
  },
]
```

---

### 12.10.3 "카드 자동 선택" 로직 (서버에서 결정 추천)

LLM에게 “아무거나 3~5개 만들라” 하면 문항 유동 시 깨져.
아래처럼 서버가 먼저 **활성 카드 후보를 계산**하고, LLM은 그 후보 중에서만 선택하도록 하는 게 안정적이야.

* 입력: `analysisPack.analysisPlan` + `evidenceCatalog`
* 출력: `candidateTemplates[]` (최대 7~8개)
* 최종 선택: LLM이 3~5개 고르되, 서버에서 `mustInclude` 1개 정도(예: survey_gap) 강제 가능

---

## 12.11 ap-1.1 / dp-1.1 Zod 스키마 확장안

**구현 상태**: ⏳ 계획 중  
**현재 버전**: ap-1.0 / dp-1.0  
**계획 버전**: ap-1.1 / dp-1.1

현재 스키마/구조는 잘 잡혀있고(Analysis Pack 결정론 / Decision Pack 생성 + 린트/재시도), 여기에 "문항 유동성 대응" 필드만 더하는 방향입니다.

### 12.11.1 AnalysisPack(ap-1.1) 핵심 추가 필드

**현재 (ap-1.0)에는 없는 필드들**:

* `questions[].semantics` (role, measureType, confidence 등) - ⏳ 계획 중
* `analysisPlan` (이번 분석에서 활성화된 모듈/카드 후보) - ⏳ 계획 중
* `evidenceCatalog[].type` (evidence 타입 표준화) - ⏳ 계획 중
* `evidenceCatalog[].reliability` (Confirmed/Directional/Hypothesis) - ⏳ 계획 중

#### 스키마 예시(요지)

```ts
// lib/surveys/analysis/analysisPackSchema.ts
import { z } from 'zod'

export const QuestionRoleZ = z.enum([
  'intent_followup',
  'timeline',
  'usecase_project_type',
  'budget_status',
  'authority',
  'channel_preference',
  'need_pain',
  'barrier_risk',
  'company_profile',
  'current_stack_vendor',
  'satisfaction_nps',
  'free_text_voice',
  'other',
])

export const MeasureTypeZ = z.enum([
  'categorical_single',
  'categorical_multi',
  'numeric',
  'text',
])

export const EvidenceTypeZ = z.enum([
  'lead_tier_distribution',
  'lead_top_reasons',
  'distribution_top1',
  'distribution_entropy_high',
  'crosstab_lift_high',
  'text_topic',
  'data_quality_warning',
  'missing_role_gap',
])

export const ReliabilityZ = z.enum(['Confirmed', 'Directional', 'Hypothesis'])

export const QuestionSemanticsZ = z.object({
  role: QuestionRoleZ,
  roleConfidence: z.number().min(0).max(1),
  measureType: MeasureTypeZ,
  logicalKey: z.string().max(64).optional(),
  isKeyDriverCandidate: z.boolean().default(false),
  qualityFlags: z.array(z.enum(['low_n', 'high_missing', 'version_mixed'])).default([]),
})

export const EvidenceItemZ = z.object({
  id: z.string().regex(/^E\d+$/),
  type: EvidenceTypeZ,
  title: z.string(),
  metric: z.string().optional(), // 기존 호환
  valueText: z.string(),
  n: z.number().int().nonnegative(),
  reliability: ReliabilityZ,
  source: z.enum(['qStats', 'crosstab', 'derived', 'text', 'quality']),
  sourcePointer: z.object({
    questionId: z.string().optional(),
    logicalKey: z.string().optional(),
    crosstabKey: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
})

export const AnalysisPlanZ = z.object({
  detectedRoles: z.array(QuestionRoleZ),
  activatedModules: z.array(z.enum(['crosstabs', 'leadSignals', 'textTopics', 'segments'])),
  candidateCardTemplates: z.array(z.string()), // CardTemplateId를 넣어도 됨(순환 참조 방지 위해 string도 OK)
  versionMixWarning: z.boolean().default(false),
})

export const AnalysisPackZ = z.object({
  version: z.literal('ap-1.1'),
  // ... 기존 필드들
  questions: z.array(z.object({
    questionId: z.string(),
    orderNo: z.number(),
    questionBody: z.string(),
    questionType: z.enum(['single', 'multiple', 'text']),
    // ... 기존 stats 필드들
    semantics: QuestionSemanticsZ,
  })),
  evidenceCatalog: z.array(EvidenceItemZ),
  analysisPlan: AnalysisPlanZ,
})
```

---

### 12.11.2 DecisionPack(dp-1.1) 핵심 추가 필드

**현재 (dp-1.0)에는 없는 필드들**:

* `decisionCards[].templateId` 필수 (템플릿 기반) - ⏳ 계획 중
* `decisionCards[].evidenceIds`는 기존처럼 최소 2개 유지 - ✅ 현재 유지 

```ts
// lib/surveys/analysis/decisionPackSchema.ts
export const DecisionCardZ = z.object({
  templateId: z.string().min(3), // CardTemplateId로 좁히면 더 좋음
  question: z.string().min(5),
  options: z.array(z.object({
    id: z.enum(['A','B','C']),
    title: z.string().min(2),
    description: z.string().min(10),
    expectedImpact: z.string().min(5),
    risks: z.string().optional(),
  })).length(3),
  recommendation: z.enum(['A','B','C']),
  evidenceIds: z.array(z.string().regex(/^E\d+$/)).min(2),
  confidence: z.enum(['Confirmed','Directional','Hypothesis']),
  rationale: z.string().min(20),
})
```

---

## 12.12 Role/의미(Semantics) 추정 규칙 확장

**구현 상태**: ⏳ 계획 중  
**현재**: 키워드 기반으로 timeframe/project_type/followup_intent만 추정  
**계획**: Role Taxonomy를 10-14개로 확장

문항이 늘어날수록 "의사결정 축"이 다양해져서 taxonomy 확장이 필요합니다.

### 12.12.1 Role rule set (키워드 사전) – 실전형

* Body 키워드 + Options 키워드 + (부정 키워드)로 점수화
* roleConfidence를 같이 계산해서, 애매하면 `other`로 떨구거나 “수동 오버라이드 필요” 플래그를 세움

#### 예시 코드

```ts
type Role = /* 위에서 정의한 QuestionRole */

type RoleRule = {
  bodyAny?: string[]
  optionAny?: string[]
  negativeAny?: string[]
}

const ROLE_RULES: Record<Role, RoleRule> = {
  timeline: {
    bodyAny: ['언제', '시기', '도입', '계획', '구매', '예정', '타임라인', '기간'],
    optionAny: ['즉시', '1주', '2주', '1개월', '3개월', '6개월', '올해', '내년'],
  },
  intent_followup: {
    bodyAny: ['의향', '연락', '미팅', '데모', '상담', '제안', '자료', '방문', '컨택'],
    optionAny: ['방문', '전화', '온라인', '데모', '자료', '관심 없음', '추후'],
  },
  usecase_project_type: {
    bodyAny: ['프로젝트', '유형', '영역', '적용', '용도', '사용', '구축'],
    optionAny: ['데이터센터', '보안', '네트워크', '클라우드', '스위치', '라우팅', '무선'],
  },
  budget_status: {
    bodyAny: ['예산', '비용', '가격', 'budget', '견적'],
    optionAny: ['확보', '미확보', '검토 중', '예정', '없음'],
  },
  authority: {
    bodyAny: ['의사결정', '결정권', '구매', '담당자', '권한', '승인'],
    optionAny: ['최종결정', '추천', '실무', '정보수집', '영향력'],
  },
  channel_preference: {
    bodyAny: ['선호', '연락 방법', '채널', '어떻게 연락', '접촉'],
    optionAny: ['이메일', '전화', '문자', '카카오', '방문', '온라인 미팅'],
  },
  need_pain: {
    bodyAny: ['문제', '어려움', '니즈', '필요', '개선', '과제', '요구'],
    optionAny: ['성능', '비용', '안정성', '보안', '운영', '확장'],
  },
  barrier_risk: {
    bodyAny: ['우려', '리스크', '장애', '걱정', '반대', '제약'],
    optionAny: ['예산', '승인', '인력', '기술', '보안', '기존벤더'],
  },
  company_profile: { bodyAny: ['산업', '업종', '규모', '직무', '부서'], optionAny: [] },
  current_stack_vendor: { bodyAny: ['현재', '사용 중', '벤더', '솔루션', 'vendor'], optionAny: [] },
  satisfaction_nps: { bodyAny: ['만족', '추천', '평점', 'nps'], optionAny: ['0', '10', '매우 만족', '불만족'] },
  free_text_voice: { bodyAny: ['자유', '기타 의견', '코멘트', '추가로'], optionAny: [] },
  other: {},
}

function scoreRole(rule: RoleRule, body: string, optionsText: string) {
  let score = 0
  const b = body.toLowerCase()
  const o = optionsText.toLowerCase()

  const hit = (arr?: string[], text?: string) =>
    (arr ?? []).some((k) => text?.includes(k.toLowerCase()))

  if (hit(rule.bodyAny, b)) score += 0.55
  if (hit(rule.optionAny, o)) score += 0.35
  if (hit(rule.negativeAny, b) || hit(rule.negativeAny, o)) score -= 0.6

  return Math.max(0, Math.min(1, score))
}

export function inferQuestionSemantics(q: { body?: string; type: string; options?: any }) {
  const body = q.body ?? ''
  const optionsText = JSON.stringify(q.options ?? '')

  // measureType
  const measureType =
    q.type === 'text' ? 'text'
    : q.type === 'multiple' ? 'categorical_multi'
    : 'categorical_single'

  let bestRole: Role = 'other'
  let best = 0

  ;(Object.keys(ROLE_RULES) as Role[]).forEach((role) => {
    const s = scoreRole(ROLE_RULES[role], body, optionsText)
    if (s > best) { best = s; bestRole = role }
  })

  // 임계값 미달이면 other 처리(오판 줄이기)
  const role = best >= 0.55 ? bestRole : 'other'
  const roleConfidence = role === 'other' ? best : best

  // logicalKey 예시(원하면 더 촘촘히)
  const logicalKey =
    role === 'timeline' ? 'timeline'
    : role === 'intent_followup' ? 'intent_followup'
    : role === 'budget_status' ? 'budget_status'
    : role === 'authority' ? 'authority'
    : undefined

  return {
    role,
    roleConfidence,
    measureType,
    logicalKey,
    isKeyDriverCandidate: ['timeline','intent_followup','budget_status','authority','usecase_project_type'].includes(role),
    qualityFlags: [] as string[],
  }
}
```

---

### 12.12.2 운영자 오버라이드 (강력 추천)

키워드 기반 자동 추정은 “유동 문항”에서 70~85% 수준이 한계야. 
그래서 아래 2개만 UI로 열어두면 정확도가 급상승함:

* `form_questions.role_override` (nullable)
* `form_questions.logical_key` (nullable)

오버라이드가 있으면 자동 추정보다 우선.

---

## 12.13 교차표 자동 선별 (상위 K만 Evidence로 승격)

**구현 상태**: ⏳ 계획 중  
**현재**: 역할 3개 조합(timeframe/followup/project_type)에만 교차표 생성 (최대 3개)  
**계획**: 모든 categorical 문항 쌍에 대해 교차표 생성 후 상위 K개 선별

문항이 10개, 20개로 늘면 현재 방식은 인사이트가 빈약해질 수 있습니다.

### 12.13.1 추천: "후보 전수 생성 → 스코어링 → 상위 K"

* 후보: categorical_single 위주(단일 선택 우선)
* multi×multi는 계산비용이 커서 **선택적으로만**
* 스코어: `maxLift` + `표본 패널티` + `coverage`

#### 스코어링 기준(가벼운 버전)

* `maxLift = max over cells ( P(col|row) / P(col overall) )`
* `minCellCount`가 작으면 패널티
* `support = cellCount / sampleCount`가 너무 작으면 패널티

### 12.13.2 buildCrosstabs() 확장 의사코드

```ts
type PairScore = {
  q1Id: string
  q2Id: string
  score: number
  maxLift: number
  minCellCount: number
}

function scoreCrosstab(cells: Array<{count:number; rowPct:number; colPct:number}>) {
  let maxLift = 0
  let minCell = Infinity
  for (const c of cells) {
    // colPct는 "전체에서 해당 col 비율"로 쓰는 게 좋고,
    // rowPct는 "row 내에서 해당 col 비율"로 쓰면 lift = rowPct / colPct
    const lift = c.colPct > 0 ? (c.rowPct / c.colPct) : 0
    if (lift > maxLift) maxLift = lift
    if (c.count < minCell) minCell = c.count
  }

  // 표본 패널티: minCell이 작으면 점수 크게 깎음
  const penalty =
    minCell < 5 ? 0.2 :
    minCell < 10 ? 0.6 : 1.0

  const score = maxLift * penalty
  return { score, maxLift, minCellCount: Number.isFinite(minCell) ? minCell : 0 }
}

// 후보 만들기: categorical 문항들에서 role 우선순위 적용
// 상위 K개만 crosstabs + highlights + evidence로 승격
```

### 12.13.3 Evidence로 승격할 때 reliability 자동 부여

현재도 “셀 표본 수 기반 신뢰도”를 쓰고 있는데 ,
이를 evidence.type 표준화와 함께 고정해두면 카드가 훨씬 안정적으로 근거를 고른다.

* `minCellCount >= 10` → Confirmed
* `5 <= minCellCount < 10` → Directional
* `< 5` → Hypothesis

---

## 12.14 DB: 문항 변경/증가 대응을 위한 "버전+스냅샷+논리키" 마이그레이션

**구현 상태**: ⏳ 계획 중  
**현재**: 문항 수 변경에 자동 적응 (통계 계산)  
**계획**: 오픈 중 문항 수정 대응 (버전 관리 + 스냅샷)

명세에도 "문항 수 변경에 자동 적응"은 되어 있지만, 실제 운영에서 제일 위험한 것은 **오픈 중 문항 수정으로 의미가 섞이는 것**입니다.

### 12.14.1 최소 추가 컬럼 (현실적인 1차안)

**form_questions**

* `logical_key text null`
* `role_override text null`
* `revision int not null default 1`  (문항 body/options 변경 시 +1)

**form_submissions**

* `form_revision int not null default 1` (제출 시점의 revision 묶음)

**form_answers**

* `question_body_snapshot text null`
* `options_snapshot jsonb null` (선택지 텍스트/ID)
* `question_logical_key_snapshot text null`
* `question_role_snapshot text null`

#### 마이그레이션 예시(SQL)

```sql
alter table public.form_questions
  add column if not exists logical_key text,
  add column if not exists role_override text,
  add column if not exists revision int not null default 1;

alter table public.form_submissions
  add column if not exists form_revision int not null default 1;

alter table public.form_answers
  add column if not exists question_body_snapshot text,
  add column if not exists options_snapshot jsonb,
  add column if not exists question_logical_key_snapshot text,
  add column if not exists question_role_snapshot text;
```

### 12.14.2 제출 시점 스냅샷 저장 규칙

* 제출 처리 API에서:

  * `question_body_snapshot = form_questions.body`
  * `options_snapshot = form_questions.options`
  * `question_role_snapshot = (role_override ?? inferRole(body/options))`
  * `question_logical_key_snapshot = logical_key`

이러면 나중에 질문이 바뀌어도 보고서가 “당시 화면 기준”으로 재현돼.

---

## 12.15 generateDecisionPack 프롬프트 입력도 "템플릿 기반"으로 추가

**구현 상태**: ⏳ 계획 중  
**현재**: Evidence 기반 생성/검증 구조  
**계획**: 템플릿 기반 프롬프트 추가

현재도 Evidence 기반 생성/검증 구조가 있으니 프롬프트에 아래 2개만 더 넣으면 효과가 큽니다.

### 12.15.1 LLM 입력에 포함할 것

* `analysisPlan.candidateCardTemplates`
* `CARD_TEMPLATES`(id/title/question/activation 요약)
* `evidenceCatalog`(type/reliability 포함)
* “반드시 templateId를 포함해서 3~5개만 출력” 규칙

### 12.15.2 System Prompt에 추가할 규칙 (핵심만)

* “템플릿 목록에 없는 templateId 금지”
* “각 카드 evidenceIds 최소 2개”
* “Hypothesis evidence만으로 구성된 카드는 만들지 말 것(대신 survey_gap 카드로 대체)”

---

## 12.16 lintDecisionPack 강화 포인트 (실전에서 깨지는 것 방지)

**구현 상태**: ⚠️ 부분 구현  
**현재**: 기본 lint 기능 구현됨 (`lib/surveys/analysis/lintDecisionPack.ts`)  
**계획**: 아래 4개 항목 추가로 실패율 감소 예상

현재도 lint가 있지만, 문항 유동 대응에서는 아래 4개를 추가하면 실패율이 크게 줄어듭니다.

1. **templateId 유효성 체크**

* registry에 없는 templateId → 재시도

2. **카드별 evidence 타입 조건 검사**

* 예: `lead_immediate_contact`인데 `lead_tier_distribution` evidence가 하나도 없다 → 재시도

3. **reliability 게이트**

* 카드의 evidence가 전부 Hypothesis → 경고 또는 카드 제거 후 다른 카드로 대체

4. **targetCount 숫자 교정(서버 권위)**

* 지금도 하는 방향 유지 
* “Evidence 숫자와 불일치 → 서버 계산값으로 덮어쓰기”를 templateId별로 더 엄격하게

---

## 12.17 바로 적용 순서 추천 (가장 효과 큰 것부터)

**우선순위**:

1. **Evidence.type + reliability 추가** (카드 근거가 안정화) - ⏳ 계획 중
2. **CardTemplateRegistry + templateId 강제** (문항 변화에도 카드 깨짐 최소화) - ⏳ 계획 중
3. **교차표 상위 K 자동 선별** (문항 늘어날수록 인사이트가 더 좋아짐) - ⏳ 계획 중
4. **(운영 안정) form_answers 스냅샷 + logical_key/role_override** - ⏳ 계획 중

---

---

## 13. 명세서 변경 이력

| 버전 | 날짜 | 변경 내용 |
|-----|------|----------|
| 2.0 | 2026-01-06 | 현재 구현과 향후 계획 분리, 버전 정보 명확화, 실제 스키마와 일치하도록 수정 |
| 1.0 | 2026-01-06 | 초기 명세서 작성 |

---

**작성일**: 2026-01-06  
**최종 업데이트**: 2026-01-06  
**작성자**: AI Assistant  
**검토자**: AI Assistant 

# AI 보고서 시스템 명세서 (Action Pack V0.9)

## 목차
1. [시스템 개요](#1-시스템-개요)
2. [아키텍처](#2-아키텍처)
3. [데이터 처리 흐름](#3-데이터-처리-흐름)
4. [프롬프트 설계](#4-프롬프트-설계)
5. [스키마 구조](#5-스키마-구조)
6. [에러 처리 및 재시도](#6-에러-처리-및-재시도)
7. [렌더링 로직](#7-렌더링-로직)
8. [개선 포인트](#8-개선-포인트)

---

## 1. 시스템 개요

### 1.1 목적
설문조사 응답 데이터를 분석하여 실행 가능한 인사이트와 액션 플랜을 제공하는 AI 기반 분석 보고서 생성 시스템

### 1.2 현재 버전
- **Action Pack V0.9**: 단순화된 스키마로 LLM 통과율 최우선 설계
- **모델**: Gemini 2.0 Flash
- **출력 형식**: JSON (ActionPackV0.9) → Markdown 렌더링

### 1.3 핵심 원칙
1. **데이터 기반 분석**: 서버에서 계산한 통계만 사용, AI는 해석만 수행
2. **구체적 근거 필수**: 모든 인사이트는 숫자(퍼센트, 분수, 카운트) 포함
3. **실행 가능한 액션**: 담당자, 기한, 실행 단계 명시
4. **명확한 표현**: 추정형 문장 금지, 사실만 기술

---

## 2. 아키텍처

### 2.1 파일 구조

```
lib/surveys/analysis/
├── gemini.ts                    # Gemini API 호출 및 프롬프트 관리
├── actionPackSchema.ts          # Zod 스키마 정의 (V0.9, V2)
├── renderMarkdown.ts            # Action Pack → Markdown 렌더링
├── buildComputedMetrics.ts      # 통계 메트릭 계산 (crosstabs, leadSignals)
└── reportLinter.ts              # 보고서 품질 검증 (미사용)

app/api/event-survey/campaigns/[campaignId]/analysis/
└── generate/route.ts            # API 엔드포인트 (데이터 수집 → AI 호출 → 저장)
```

### 2.2 데이터 흐름

```
1. API 요청 (POST /api/.../analysis/generate)
   ↓
2. 데이터 수집 (route.ts)
   - 캠페인 정보 조회
   - 설문 응답(entries) 조회
   - 문항(questions) 조회
   - 답변(answers) 조회
   ↓
3. 통계 계산 (buildComputedMetrics.ts)
   - questionStats: 문항별 분포
   - crosstabs: 교차표 분석
   - leadSignals: 리드 신호 (티어 분포, 채널 선호도)
   - dataQuality: 데이터 품질 평가
   ↓
4. AI 생성 (gemini.ts)
   - 프롬프트 구성 (system + user)
   - Gemini API 호출
   - JSON 파싱
   - Zod 검증
   ↓
5. 재시도 로직 (검증 실패 시)
   - Zod issues 추출
   - 프롬프트에 오류 정보 포함
   - 최대 2회 재시도
   ↓
6. Markdown 렌더링 (renderMarkdown.ts)
   - Action Pack → Markdown 변환
   - 신뢰 문구 삽입
   - 레퍼런스 요약 포함
   ↓
7. DB 저장 (route.ts)
   - survey_analysis_reports 테이블에 저장
   - action_pack (JSON), report_md (Markdown) 저장
```

---

## 3. 데이터 처리 흐름

### 3.1 입력 데이터 수집 (`route.ts`)

#### 3.1.1 캠페인 정보
```typescript
{
  id: string
  title: string
  form_id: string
  client_id: string
  agency_id: string
}
```

#### 3.1.2 설문 응답 (Entries)
```typescript
{
  form_submission_id: string  // 실제 답변 데이터 참조
}[]
```

#### 3.1.3 문항 (Questions)
```typescript
{
  id: string
  order_no: number
  body: string
  type: 'single' | 'multiple' | 'text'
  options: JSON  // 선택형 문항의 선택지
}[]
```

#### 3.1.4 답변 (Answers)
```typescript
{
  question_id: string
  submission_id: string
  choice_ids: string[]  // 선택형
  text_answer: string   // 텍스트형
}[]
```

### 3.2 통계 계산 (`buildComputedMetrics.ts`)

#### 3.2.1 문항별 통계 (questionStats)
```typescript
{
  questionId: string
  orderNo: number
  questionBody: string
  questionType: string
  totalAnswers: number
  options: any[]
  choiceDistribution: Record<string, number>  // 선택지별 카운트
  topChoices: Array<{
    text: string
    count: number
    percentage: string
  }>
  textAnswers: string[]  // 텍스트 문항의 경우
  role: 'timeframe' | 'project_type' | 'followup_intent' | 'other'
}
```

**역할 자동 추정 로직**:
- `timeframe`: "언제", "계획", "1주", "1개월" 키워드 감지
- `project_type`: "프로젝트", "종류", "데이터센터", "네트워크" 키워드 감지
- `followup_intent`: "의향", "요청", "방문", "미팅", "관심 없음" 키워드 감지

#### 3.2.2 교차표 분석 (crosstabs)
```typescript
{
  question1Id: string
  question2Id: string
  question1Role: string
  question2Role: string
  cells: Array<{
    rowKey: string
    colKey: string
    count: number
    rowPct: number
    colPct: number
  }>
  rowTotals: Record<string, number>
  colTotals: Record<string, number>
}[]
```

**생성 기준**:
- 상위 3-4개 "분석 가치" 문항 쌍
- 예: Timing × Followup, ProjectType × Followup

#### 3.2.3 리드 신호 (leadSignals)
```typescript
{
  distribution: Array<{
    tier: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
    count: number
    pct: number
  }>
  channelPreference: Record<string, number>
  timingDistribution: Record<string, number>
  leadQueue: Array<{
    entry_id: string
    survey_no: number
    leadScore: number
    tier: string
    recommendedNextStep: string
    reasons: string[]
  }>
}
```

**리드 스코어 계산**:
- Timing 점수: 1주 이내(+30), 1개월(+25), 1~3개월(+20), ...
- Followup 점수: 방문 요청(+20), 온라인 미팅(+15), 전화 상담(+10), ...
- ProjectType 점수: 데이터센터(+15), 네트워크 보안(+12), ...
- `leadScore = clamp(timing + followup + projectType, 0, 100)`

**티어 분류**:
- P0: 80~100 (즉시 컨택)
- P1: 60~79
- P2: 40~59
- P3: 20~39
- P4: 0~19

#### 3.2.4 데이터 품질 (dataQuality)
```typescript
Array<{
  level: 'info' | 'warning'
  message: string
}>
```

**평가 항목**:
- 표본 수 충분성
- 응답률
- 교차표 셀 표본 수
- 데이터 편향 가능성

### 3.3 AI 입력 데이터 구조

```typescript
interface GenerateActionPackInput {
  campaignId: string
  campaignTitle: string
  analyzedAtISO: string
  sampleCount: number
  totalQuestions: number
  questionStats: any[]           // 문항별 통계
  crosstabs: any[]               // 교차표 분석
  leadSignals: {
    distribution: Array<{tier, count, pct}>
    channelPreference: Record<string, number>
    timingDistribution: Record<string, number>
  }
  dataQuality: any[]             // 데이터 품질 평가
  lens: 'sales' | 'marketing' | 'general'
}
```

---

## 4. 프롬프트 설계

### 4.1 System Prompt 구조

**위치**: `lib/surveys/analysis/gemini.ts` (line 227-401)

#### 4.1.1 역할 정의
```
당신은 B2B 세일즈/마케팅 인사이트 분석가입니다.
설문조사 데이터를 분석하여 실행 가능한 인사이트와 액션 플랜을 제공합니다.
```

#### 4.1.2 핵심 원칙
1. **데이터 기반 분석**: 입력으로 제공된 통계 데이터와 computed 값만 사용
2. **구체적 근거 필수**: 모든 인사이트는 반드시 숫자(퍼센트, 분수, 카운트) 포함
3. **실행 가능한 액션**: 각 인사이트마다 구체적인 담당자, 기한, 실행 단계 제시
4. **명확한 표현**: "예상됩니다/가능성이 높습니다/추정됩니다" 같은 모호한 표현 금지

#### 4.1.3 출력 품질 기준

**Executive Summary**:
- 최소 80자 이상 (현재는 120자 이상으로 강화됨)
- 단순 숫자 나열 금지
- 비즈니스 의미와 다음 액션 포함
- 나쁜 예/좋은 예 제공

**Insights**:
- 최소 3개 이상
- 각 인사이트는 title, evidence, soWhat, nextActions 포함
- evidence는 반드시 숫자 포함
- nextActions는 owner, due, steps 포함

**Priority Queue**:
- 최소 3개 이상 (모든 티어 P0-P4 포함 권장)
- count, pct는 숫자 타입
- SLA는 구체적으로 명시
- script는 실제 사용 가능한 토크트랙 (최소 50자 이상)

**Segments**:
- 최소 2개 이상 (필수)
- 명확한 기준으로 분류
- size(count, pct), playbook(최소 3개), evidence(최소 2개) 포함

**Marketing Pack**:
- 최소 2개 이상 (필수)
- theme, targetSegment, suggestedAssets(최소 3개), distribution(최소 3개), rationale(최소 50자) 포함

**Survey Next Questions**:
- 최소 2개 이상
- BANT/MEDDIC 관점에서 제안
- question, answerType, why 포함

**Data Quality**:
- 최소 3개 이상 (필수)
- 플레이스홀더 금지 ("ℹ️ 정보:" 같은 것)
- 구체적인 평가 내용

#### 4.1.4 형식 주의사항
- executiveSummary는 객체 `{ oneLiner: "..." }` 형식 (배열 아님)
- insights는 객체 배열
- priorityQueue는 객체 배열
- 모든 숫자 필드(count, pct)는 숫자 타입
- campaign 필드는 만들지 않음 (서버에서 주입)

#### 4.1.5 JSON 예시
프롬프트에 완전한 JSON 예시 포함:
- Executive Summary 예시
- Insights 예시 (1개)
- Priority Queue 예시 (P0, P1, P2)
- Segments 예시 (2개)
- Marketing Pack 예시 (2개)
- Survey Next Questions 예시 (2개)
- Data Quality 예시 (5개)

### 4.2 User Prompt 구조

**위치**: `lib/surveys/analysis/gemini.ts` (line 542-633)

#### 4.2.1 구성 요소

1. **캠페인 정보** (참고용, JSON에 포함하지 않음)
   - 캠페인 제목
   - 총 응답 수
   - 분석 문항 수
   - 분석 관점 (lens)

2. **문항별 통계 데이터**
   ```json
   [
     {
       "questionId": "...",
       "questionBody": "...",
       "choiceDistribution": {...},
       "topChoices": [...],
       "role": "timeframe"
     }
   ]
   ```

3. **교차표 분석 (Crosstabs)**
   ```json
   [
     {
       "question1Id": "...",
       "question2Id": "...",
       "cells": [...],
       "rowTotals": {...},
       "colTotals": {...}
     }
   ]
   ```

4. **리드 신호 요약**
   - 티어별 분포
   - 채널 선호도
   - Timing 분포

5. **데이터 품질**
   ```json
   [
     {
       "level": "info",
       "message": "..."
     }
   ]
   ```

#### 4.2.2 분석 지침

**1. 핵심 발견사항 식별 (insights - 최소 3개 이상)**
- Timing 관점
- Followup 관점
- ProjectType 관점
- 교차 분석

**2. 리드 우선순위 분류 (priorityQueue - 최소 3개 이상)**
- 모든 티어 포함
- 실제 데이터 기반 계산
- 구체적인 SLA
- 실행 가능한 토크트랙

**3. 세그먼트 플레이북 (segments - 최소 2개 이상)**
- 명확한 기준으로 분류
- 예시 제공

**4. 마케팅 팩 (marketingPack - 최소 2개 이상)**
- 구체적이고 실행 가능한 캠페인
- 각 필드별 최소 요구사항 명시

**5. 설문 개선 제안 (surveyNextQuestions - 최소 2개 이상)**
- BANT/MEDDIC 관점
- Budget, Authority, Need, Timeline

**6. 데이터 품질 평가 (dataQuality - 최소 3개 이상)**
- 표본 수 평가
- 응답률 평가
- 교차표 분석 품질
- 데이터 편향 가능성
- 추가 데이터 필요성

### 4.3 재시도 프롬프트 (Retry Prompt)

**위치**: `lib/surveys/analysis/gemini.ts` (line 216-224)

스키마 검증 실패 시 이전 오류를 포함:

```typescript
**이전 응답의 검증 오류 (반드시 수정하세요):**
- insights.1.nextActions.0.owner: Invalid option: expected one of "sales"|"marketing"|"ops"
- priorityQueue.0.count: Expected number, received string

위 오류를 모두 수정한 올바른 JSON만 반환하세요.
```

---

## 5. 스키마 구조

### 5.1 Action Pack V0.9 Schema

**위치**: `lib/surveys/analysis/actionPackSchema.ts` (line 149-221)

```typescript
{
  version: '0.9'
  lens: 'sales' | 'marketing' | 'general'
  
  executiveSummary: {
    oneLiner: string (min 10)
  }
  
  insights: Array<{
    title: string (min 5)
    evidence: string (min 5)  // "34% (17/50)" 형식
    soWhat: string (min 10)
    nextActions: Array<{
      owner: 'sales' | 'marketing' | 'ops'
      due: string (min 2)  // "D+2", "48시간 내" 등
      steps: string[] (min 1, 각 항목 min 3)
    }> (min 1)
  }> (min 3)
  
  priorityQueue: Array<{
    tier: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
    count: number (int, >= 0)
    pct: number (0-100)
    sla: string (min 3)
    script: string (min 10)
  }> (min 3)
  
  segments?: Array<{
    name: string (min 3)
    definition: string (min 5)
    size: {
      count: number (int, >= 0)
      pct: number (0-100)
    }
    playbook: string[] (min 2, 각 항목 min 5)
    evidence: string[] (min 1, 각 항목 min 5)
  }> (min 2)  // optional이지만 프롬프트에서 필수 요구
  
  marketingPack?: Array<{
    theme: string (min 3)
    targetSegment: string (min 3)
    suggestedAssets: string[] (min 1, 각 항목 min 3)
    distribution: string[] (min 1, 각 항목 min 3)
    rationale: string (min 10)
  }>  // optional이지만 프롬프트에서 필수 요구
  
  surveyNextQuestions: Array<{
    question: string (min 5)
    answerType: 'single' | 'multiple' | 'text'
    why: string (min 10)
  }> (min 1)  // 프롬프트에서는 최소 2개 요구
  
  dataQuality?: string[] (각 항목 min 5)  // optional이지만 프롬프트에서 필수 요구
}
```

### 5.2 스키마 설계 철학

**V0.9의 단순화 전략**:
1. 중첩 구조 최소화
2. campaign은 서버에서 주입 (LLM이 생성하지 않음)
3. enum/숫자 타입 강제 약화 (문자열 허용 후 서버에서 정규화)
4. optional 필드 활용 (프롬프트로 필수 강제)

**V2와의 차이점**:
- V2는 더 복잡한 구조 (topWins, correlationFindings 등)
- V0.9는 LLM 통과율 최우선 설계

---

## 6. 에러 처리 및 재시도

### 6.1 재시도 로직

**위치**: `lib/surveys/analysis/gemini.ts` (line 639-670)

```typescript
export async function generateActionPackWithRetry(
  input: GenerateActionPackInput,
  maxRetries = 2
): Promise<ActionPackV09>
```

**동작 방식**:
1. 최대 3회 시도 (초기 1회 + 재시도 2회)
2. 스키마 검증 실패 시 Zod issues 추출
3. 다음 시도에 issues를 프롬프트에 포함
4. 지수 백오프: 1초, 2초, 4초

**에러 분류**:
- **스키마 검증 실패**: issues 추출하여 재시도
- **API 오류**: 즉시 실패
- **JSON 파싱 오류**: 즉시 실패

### 6.2 에러 처리 흐름

```
1. Gemini API 호출
   ↓
2. 응답 확인
   ├─ 성공 → JSON 파싱
   │         ├─ 성공 → Zod 검증
   │         │         ├─ 성공 → 반환
   │         │         └─ 실패 → issues 추출 → 재시도
   │         └─ 실패 → 에러 반환
   └─ 실패 → 에러 반환
```

### 6.3 Structured Output 비활성화

**이유**: 중첩 깊이 제한으로 인해 Structured Output 사용 불가

**현재 상태**:
- `responseJsonSchema = undefined`
- 일반 JSON 모드 사용 (`responseMimeType: 'application/json'`)
- 강화된 프롬프트로 형식 강제

---

## 7. 렌더링 로직

### 7.1 Markdown 렌더링

**위치**: `lib/surveys/analysis/renderMarkdown.ts` (line 37-163)

#### 7.1.1 렌더링 순서

1. **신뢰 문구** (`TRUST_STATEMENT`)
   - 고정 템플릿
   - AAPOR/ISO/ESOMAR/BANT/MEDDIC 언급

2. **분석 대상**
   - 캠페인 제목
   - 분석 시점
   - 총 응답 수
   - 분석 문항 수
   - 분석 관점

3. **관련 레퍼런스 요약** (`SURVEY_ANALYSIS_REFERENCES`)
   - 고정 템플릿
   - 각 레퍼런스 요약

4. **Executive Summary**
   - oneLiner만 표시

5. **주요 인사이트**
   - 각 인사이트별로:
     - 제목
     - 근거
     - 해석
     - 액션 (담당자, 기한, 단계)

6. **Priority Queue & SLA**
   - 각 티어별로:
     - 수량
     - 비율
     - SLA
     - 토크트랙

7. **세그먼트 플레이북** (있을 경우)
   - 각 세그먼트별로:
     - 정의
     - 크기
     - 플레이북
     - 근거

8. **Marketing Pack** (있을 경우)
   - 각 팩별로:
     - 타겟 세그먼트
     - 제안 자산
     - 배포 채널
     - 근거

9. **설문 개선 제안**
   - 각 제안별로:
     - 질문
     - 중요성
     - 답변 유형

10. **데이터 품질** (있을 경우)
    - 각 항목별로 리스트

11. **하단 문구**
    - "본 보고서는 Action Pack V0.9 형식으로 생성되었습니다."

### 7.2 신뢰 문구 및 레퍼런스

**위치**: `lib/references/survey-analysis-references.ts`

**TRUST_STATEMENT**:
```
본 보고서는 캠페인 설문 응답을 기반으로, 리서치/방법론 공개 원칙(AAPOR Transparency)과 시장조사 품질/윤리 가이드라인(ISO 20252, ICC/ESOMAR Code)을 참고하여 작성되었습니다. 또한 리드 우선순위와 후속 액션 제안은 BANT 및 MEDDIC 프레임워크 관점으로 구조화했습니다.
```

**레퍼런스 요약**:
- AAPOR Transparency
- ISO 20252
- ICC/ESOMAR Code
- BANT
- MEDDIC

---

## 8. 개선 포인트

### 8.1 현재 문제점

#### 8.1.1 프롬프트와 스키마 불일치
- **문제**: 프롬프트에서는 `segments`, `marketingPack`, `dataQuality`를 필수로 요구하지만 스키마는 optional
- **영향**: AI가 필드를 생성하지 않아도 검증 통과
- **해결**: 스키마를 필수로 변경하거나, 프롬프트 강화

#### 8.1.2 Executive Summary 품질
- **문제**: 최소 80자 요구하지만 실제로는 짧게 생성됨
- **영향**: 보고서 품질 저하
- **해결**: 최소 길이를 120자로 강화 (이미 적용됨)

#### 8.1.3 Data Quality 섹션 비어있음
- **문제**: "ℹ️ 정보:" 같은 플레이스홀더만 생성
- **영향**: 유용한 정보 부족
- **해결**: 프롬프트에 구체적인 예시 추가 및 플레이스홀더 금지 명시 (이미 적용됨)

#### 8.1.4 Marketing Pack 품질
- **문제**: suggestedAssets와 distribution이 부실함
- **영향**: 실행 가능성 낮음
- **해결**: 최소 개수 요구사항 강화 (이미 적용됨)

### 8.2 개선 제안

#### 8.2.1 스키마 개선
```typescript
// segments, marketingPack, dataQuality를 필수로 변경
segments: z.array(...).min(2),  // optional 제거
marketingPack: z.array(...).min(2),  // optional 제거
dataQuality: z.array(...).min(3),  // optional 제거
```

#### 8.2.2 프롬프트 개선
1. **더 구체적인 예시 제공**
   - 각 섹션별 실제 사용 예시 추가
   - 다양한 관점의 인사이트 예시

2. **품질 게이트 강화**
   - evidence에 숫자 포함 여부 정규식 검증
   - 최소 길이 검증
   - 플레이스홀더 감지

3. **Few-shot 예시 추가**
   - 성공적인 보고서 예시 2-3개 포함
   - 다양한 캠페인 유형 대응

#### 8.2.3 Linter 구현
**위치**: `lib/surveys/analysis/reportLinter.ts` (현재 미사용)

**검증 규칙**:
```typescript
- executiveSummary.topWins.length >= 3
- 각 topWin.evidence는 정규식 /\d+%|\(\d+\/\d+\)/ 만족
- correlationFindings.length >= 2 (crosstab가 존재할 때)
- "예상됩니다/가능성이 높습니다/추정" 같은 표현 금지
```

#### 8.2.4 데이터 품질 개선
1. **교차표 분석 강화**
   - 더 많은 문항 쌍 분석
   - Lift 계산 정확도 향상

2. **리드 스코어 개선**
   - 가중치 조정 가능하도록
   - 캠페인별 커스터마이징

#### 8.2.5 렌더링 개선
1. **Markdown 포맷 개선**
   - 표 형식 활용
   - 이모지 일관성
   - 섹션 구분 명확화

2. **PDF 생성** (향후)
   - HTML 템플릿 생성
   - Puppeteer로 PDF 변환
   - 그래프 포함

---

## 9. API 엔드포인트

### 9.1 보고서 생성

**엔드포인트**: `POST /api/event-survey/campaigns/[campaignId]/analysis/generate`

**Request Body**:
```json
{
  "lens": "sales" | "marketing" | "general"  // 기본값: "general"
}
```

**Response**:
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "campaign_id": "uuid",
    "analyzed_at": "ISO 8601",
    "sample_count": 50,
    "total_questions": 3,
    "lens": "general",
    "report_title": "...",
    "summary": "...",
    "action_pack": {...},
    "created_at": "ISO 8601"
  }
}
```

**에러 코드**:
- `INSUFFICIENT_SAMPLES`: 응답 수 부족
- `NO_QUESTIONS`: 문항 없음
- `AI_GENERATION_FAILED`: AI 생성 실패
- `VALIDATION_FAILED`: 스키마 검증 실패

### 9.2 권한 확인

**필요 권한**:
- Super Admin: 모든 캠페인
- Client Member: `owner`, `admin`, `operator`, `analyst` 역할
- Agency Member: `owner`, `admin` 역할

---

## 10. Gemini API 설정

### 10.1 모델 정보
- **모델**: `gemini-2.0-flash`
- **API 버전**: `v1beta`
- **엔드포인트**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

### 10.2 Generation Config
```typescript
{
  temperature: 0.3,        // 일관성 우선
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,    // 충분한 토큰
  responseMimeType: 'application/json',
  // responseJsonSchema: undefined  // Structured Output 비활성화
}
```

### 10.3 요청 구조
```typescript
{
  systemInstruction: {
    parts: [{ text: systemPrompt }]
  },
  contents: [{
    parts: [{
      text: userPrompt
    }]
  }],
  generationConfig: {...}
}
```

---

## 11. 데이터베이스 스키마

### 11.1 survey_analysis_reports 테이블

**주요 컬럼**:
- `id`: UUID
- `campaign_id`: UUID (FK)
- `analyzed_at`: timestamptz
- `sample_count`: integer
- `total_questions`: integer
- `lens`: text ('sales', 'marketing', 'general')
- `report_title`: text
- `summary`: text (executiveSummary.oneLiner)
- `report_content`: text (v1 호환)
- `report_content_md`: text (간단 요약)
- `report_content_full_md`: text (완성본)
- `report_md`: text (v0.9 Markdown)
- `statistics_snapshot`: jsonb (통계 스냅샷)
- `action_pack`: jsonb (ActionPackV0.9 JSON)
- `references_used`: jsonb
- `generation_warnings`: jsonb
- `created_by`: UUID (FK to profiles)
- `created_at`: timestamptz

---

## 12. 현재 프롬프트 전문

### 12.1 System Prompt (전체)

```typescript
당신은 B2B 세일즈/마케팅 인사이트 분석가입니다. 설문조사 데이터를 분석하여 실행 가능한 인사이트와 액션 플랜을 제공합니다.

**핵심 원칙:**
1. **데이터 기반 분석**: 입력으로 제공된 통계 데이터와 computed 값만 사용하세요. 임의로 계산하거나 추정하지 마세요.
2. **구체적 근거 필수**: 모든 인사이트는 반드시 숫자(퍼센트, 분수, 카운트)를 포함한 근거가 있어야 합니다.
3. **실행 가능한 액션**: 각 인사이트마다 구체적인 담당자, 기한, 실행 단계를 제시하세요.
4. **명확한 표현**: "예상됩니다/가능성이 높습니다/추정됩니다" 같은 모호한 표현을 사용하지 마세요. 데이터가 보여주는 사실만 기술하세요.

**출력 품질 기준:**
- **executiveSummary.oneLiner**: 핵심 발견사항을 **최소 80자 이상**으로 상세히 요약하세요...
- **insights**: 각 인사이트는 다음을 포함해야 합니다...
- **priorityQueue**: 리드 우선순위별로 분류...
- **surveyNextQuestions**: 설문 개선을 위한 제안...

**필수 필드 요구사항:**
- insights: 최소 3개 이상 반드시 포함
- priorityQueue: 최소 3개 이상 반드시 포함 (P0, P1, P2 등)
- surveyNextQuestions: 최소 1개 이상 반드시 포함

**형식 주의사항:**
- executiveSummary는 객체 { oneLiner: "..." } 형식입니다. 배열이 아닙니다!
- insights는 객체 배열 [{ title, evidence, soWhat, nextActions }] 형식입니다.
- priorityQueue는 객체 배열 [{ tier, count, pct, sla, script }] 형식입니다.
- 모든 숫자 필드(count, pct)는 숫자 타입입니다. 문자열이 아닙니다!
- campaign 필드는 만들지 마세요. 서버에서 자동으로 추가됩니다.

**JSON 형식 예시 (정확히 이 구조를 따라주세요):**
[완전한 JSON 예시 포함]

위 JSON 예시 구조를 정확히 따라주세요. 반드시 유효한 JSON만 출력하고, 코드 블록이나 마크다운 형식은 사용하지 마세요.
```

### 12.2 User Prompt (전체)

```typescript
다음 설문조사 데이터를 [lens] 분석하여 ActionPackV0.9 JSON을 생성하세요.

## 캠페인 정보 (참고용 - JSON에 포함하지 마세요)
- 캠페인 제목: ...
- 총 응답 수: ...명
- 분석 문항 수: ...개
- 분석 관점: ...

## 문항별 통계 데이터
[JSON 형식의 questionStats]

## 교차표 분석 (Crosstabs)
[JSON 형식의 crosstabs]

## 리드 신호 요약
- 티어별 분포: [...]
- 채널 선호도: {...}
- Timing 분포: {...}

## 데이터 품질
[JSON 형식의 dataQuality]

---

## 분석 지침 (매우 중요 - 모든 섹션을 반드시 생성하세요)

위 데이터를 **다각도로 깊이 있게** 분석하여 다음을 수행하세요:

### 1. 핵심 발견사항 식별 (insights - 최소 3개 이상)
[상세 지침]

### 2. 리드 우선순위 분류 (priorityQueue - 최소 3개 이상, 모든 티어 포함)
[상세 지침]

### 3. 세그먼트 플레이북 (segments - 최소 2개 이상, 필수)
[상세 지침]

### 4. 마케팅 팩 (marketingPack - 최소 2개 이상, 필수)
[상세 지침]

### 5. 설문 개선 제안 (surveyNextQuestions - 최소 2개 이상)
[상세 지침]

### 6. 데이터 품질 평가 (dataQuality - 최소 3개 이상, 필수)
[상세 지침]

**품질 기준 (반드시 지켜주세요):**
[품질 기준 목록]

위 데이터를 기반으로 **모든 섹션을 포함한** 고품질 ActionPackV0.9 JSON을 생성하세요.
```

---

## 13. 개선 로드맵

### 13.1 단기 개선 (1-2주)

1. **스키마 필수 필드 강화**
   - segments, marketingPack, dataQuality를 필수로 변경
   - 최소 개수 요구사항 스키마에 반영

2. **프롬프트 품질 강화**
   - Executive Summary 최소 길이 120자로 강화 (완료)
   - Data Quality 플레이스홀더 금지 (완료)
   - Marketing Pack 최소 개수 강화 (완료)

3. **Linter 활성화**
   - reportLinter.ts 구현
   - 품질 게이트 적용

### 13.2 중기 개선 (1개월)

1. **Few-shot 예시 추가**
   - 성공적인 보고서 예시 2-3개 프롬프트에 포함
   - 다양한 캠페인 유형 대응

2. **Structured Output 재시도**
   - Gemini 2.5 또는 3.0 모델로 업그레이드
   - 단순화된 스키마로 Structured Output 재도입

3. **PDF 생성**
   - HTML 템플릿 구현
   - Puppeteer 통합
   - 그래프 포함

### 13.3 장기 개선 (3개월+)

1. **V2 스키마 전환**
   - ActionPackV2로 마이그레이션
   - 더 풍부한 분석 제공

2. **캠페인별 커스터마이징**
   - 리드 스코어 가중치 조정
   - 프롬프트 템플릿 커스터마이징

3. **실시간 모니터링**
   - 보고서 생성 성공률 추적
   - 품질 메트릭 대시보드

---

## 14. 참고 파일

- `lib/surveys/analysis/gemini.ts`: Gemini API 호출 및 프롬프트
- `lib/surveys/analysis/actionPackSchema.ts`: Zod 스키마 정의
- `lib/surveys/analysis/renderMarkdown.ts`: Markdown 렌더링
- `lib/surveys/analysis/buildComputedMetrics.ts`: 통계 계산
- `app/api/event-survey/campaigns/[campaignId]/analysis/generate/route.ts`: API 엔드포인트
- `lib/references/survey-analysis-references.ts`: 신뢰 문구 및 레퍼런스

---

**작성일**: 2025-01-XX  
**버전**: 1.0  
**작성자**: AI Assistant



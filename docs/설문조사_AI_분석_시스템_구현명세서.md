아래는 **“설문 문항이 늘어나거나 바뀌어도 자동 적응하는 Decision Card 중심 설문 AI 분석 시스템”**을 실제로 구현할 수 있게 만든 **구현 명세서(v1.0)** 입니다. 현재 EventFlow(Next.js 16 + Supabase) 구조/패턴과, 이미 정의된 **Analysis Pack(서버 결정론) → Decision Pack(LLM) 2단계 파이프라인**을 전제로 합니다.   

---

# 설문조사 AI 분석 시스템 구현 명세서 v1.0

## 0. 문서 정보

* 문서명: 설문조사 AI 분석(Decision Card) 구현 명세서
* 버전: v1.0
* 작성일: 2026-01-06
* 전제: **Analysis Pack + Decision Pack** 파이프라인 기반 
* 기술 스택: Next.js App Router, TypeScript, Supabase(Postgres), Vercel Serverless  

---

## 1. 목표와 성공 기준

### 1.1 목표

1. **문항 수/문항 유형/문항 텍스트가 변경되어도 분석 파이프라인이 깨지지 않고 자동 적응**
2. 최종 산출물의 핵심은 **Decision Cards(3~5개)**: “무엇을 결정해야 하는가” + “A/B/C 옵션” + “추천” + “근거(Evidence ID)”
3. AI가 임의로 숫자를 만들지 못하도록 **Evidence 기반 강제 + 서버 검증/교정(Merge 단계)**

> 위 목표는 기존 설계의 “동적 문항 처리 + 역할(role) 추정 + Evidence Catalog + Decision Pack” 구조를 구현 레벨로 고도화하는 것입니다. 

### 1.2 성공 기준 (DoD)

* [ ] 문항이 3개 → 10개로 늘어나도 **API/리포트 생성이 성공**한다.
* [ ] 문항 텍스트/선택지가 변경돼도 **스키마 검증/렌더링이 깨지지 않는다**.
* [ ] Decision Card는 3~5개 생성되며, **각 카드가 Evidence ID(최소 2개)를 참조**한다.
* [ ] LLM 결과가 Evidence ID를 잘못 참조하면 **서버 linter가 감지하고 재시도** 또는 폴백한다.
* [ ] Decision Pack 실패 시 **Analysis Pack만 저장/렌더링**하는 폴백이 동작한다. 

---

## 2. 시스템 범위

### 2.1 포함

* 설문 캠페인 단위 AI 분석 리포트 생성
* Analysis Pack 생성(서버 결정론 통계)
* Decision Pack 생성(LLM → Decision Cards/Action Board/Playbooks/Next Questions)
* 리포트 저장 및 렌더링(Markdown)
* 권한/멀티테넌시 준수(agency/client 격리)  

### 2.2 제외 (v1에서 하지 않음)

* 장기 트렌드(캠페인 간 비교) 자동 분석
* 실시간(스트리밍) 분석
* 자동 스케줄링(크론) 기반 리포트 발행

---

## 3. 핵심 컨셉 정의

### 3.1 Pack 정의

* **Analysis Pack (ap-1.0)**: 서버에서 계산한 결정론 데이터 (문항별 분포/교차표/리드신호/데이터품질/근거카탈로그) 
* **Decision Pack (dp-1.0)**: LLM 생성 의사결정 지원 구조물(Decision Cards + Action Board + Playbooks + Next Questions) 

### 3.2 Decision Card 정의 (핵심 산출물)

* “지금 운영자가 결정을 내려야 하는 질문”을 카드로 표현
* 각 카드는:

  * 질문(Decision Question)
  * 옵션 A/B/C (상호 배타적 선택지)
  * 추천 옵션
  * 근거 Evidence ID 리스트 (최소 2개)
  * 신뢰도(Confirmed/Directional/Hypothesis)
  * 추천 이유(20자 이상)

---

## 4. 데이터 소스 및 저장소

### 4.1 입력 데이터 (Supabase)

* `event_survey_campaigns`: 캠페인 메타
* `forms`, `form_questions`: 폼/문항
* `event_survey_entries`: 참여자 엔트리(동의/기본정보 포함)
* `form_submissions`, `form_answers`: 실제 응답/답변

> 위 구조는 현재 EventFlow 설문 캠페인/폼 시스템 구현과 일치합니다.  

### 4.2 출력 데이터 (리포트 저장)

* `survey_analysis_reports` (이미 정의된 형태를 기준으로 확장/정리) 

권장 컬럼(최종안):

```sql
-- 핵심: 스냅샷(analysis_pack/decision_pack) + 렌더 결과(markdown) + 메타
create table if not exists public.survey_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.event_survey_campaigns(id) on delete cascade,

  analyzed_at timestamptz not null default now(),
  lens text not null default 'general', -- 'general'|'sales'|'marketing'

  sample_count int not null,
  total_questions int not null,

  report_title text not null,
  summary text not null,

  report_md text not null,                -- 최종 MD (v2)
  report_content_full_md text not null,   -- 전체 MD(필요 시 동일값)
  report_content text not null,           -- 레거시 호환(필요 시)

  analysis_pack jsonb not null,
  decision_pack jsonb,                    -- 실패 가능(폴백)
  statistics_snapshot jsonb not null,     -- analysis_pack + decision_pack + warnings

  generation_warnings jsonb,
  references_used jsonb,

  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_sar_campaign_analyzed
  on public.survey_analysis_reports (campaign_id, analyzed_at desc);

create index if not exists idx_sar_campaign_lens_analyzed
  on public.survey_analysis_reports (campaign_id, lens, analyzed_at desc);

create index if not exists idx_sar_analysis_pack_gin
  on public.survey_analysis_reports using gin (analysis_pack);

create index if not exists idx_sar_decision_pack_gin
  on public.survey_analysis_reports using gin (decision_pack);
```

---

## 5. 권한 및 멀티테넌시 규칙

### 5.1 접근 가능한 사용자

* Super Admin: 전체 접근
* Agency Member: owner/admin/analyst(정책에 맞춰)
* Client Member: owner/admin/operator/analyst/viewer(정책에 맞춰)

**패턴**

* 분석 생성/조회 API는 서버에서 `createAdminSupabase()`로 데이터 조회(필요 시 RLS 우회) 후,
* 애플리케이션 레벨에서 “이 유저가 해당 campaign의 agency/client에 속하는지” 확인.  

---

## 6. API 명세

### 6.1 분석 생성

`POST /api/event-survey/campaigns/[campaignId]/analysis/generate`

**Request**

```ts
{
  lens?: 'general' | 'sales' | 'marketing'
  force?: boolean // optional: 캐시 무시하고 재생성
}
```

**Response**

```ts
{
  success: true
  report: {
    id: string
    campaign_id: string
    analyzed_at: string
    sample_count: number
    total_questions: number
    lens: string
    report_title: string
    summary: string
    analysis_pack: any
    decision_pack: any | null
    report_md: string
    generation_warnings?: any
  }
}
```

**에러 코드(권장)**

* `INSUFFICIENT_SAMPLES`
* `NO_QUESTIONS`
* `AI_GENERATION_FAILED`
* `VALIDATION_FAILED`
* `FORBIDDEN`

> 엔드포인트/흐름은 현재 “Analysis Pack → Decision Pack → 병합/검증 → MD 렌더링” 구조를 따른다. 

### 6.2 최신 리포트 조회(권장 추가)

`GET /api/event-survey/campaigns/[campaignId]/analysis/latest?lens=general`

* UI에서 “가장 최신 리포트”를 빠르게 로드하는 용도

---

## 7. 구현 디렉토리/모듈(권장)

기존 설계 파일 구조를 유지하면서, “문항 변경에 강한” 모듈화를 추가합니다. 

```
lib/surveys/analysis/
├── buildAnalysisPack.ts
├── buildComputedMetrics.ts
├── roleInference.ts              # (추가) role 추정/override
├── crosstabSelection.ts          # (추가) 교차표 후보 선택 전략
├── generateDecisionPack.ts
├── decisionPackSchema.ts
├── analysisPackSchema.ts
├── lintDecisionPack.ts
├── mergeAnalysisAndDecisionPack.ts
├── renderFinalReportMD.ts
└── utils/
    ├── normalizeQuestions.ts     # options 파싱/정규화
    ├── normalizeAnswers.ts       # choice_ids/text_answer 정규화
    └── statsMath.ts              # pct/lift 등 안전 계산
```

---

## 8. Analysis Pack(ap-1.0) 상세 명세

### 8.1 입력 로딩 규칙

1. campaign 조회 → form_id 확보
2. `form_questions`를 `order_no`로 정렬해서 로드
3. entries/submissions/answers를 campaign 기준으로 로드
4. **options 파싱은 “문자열 JSON / JSONB / 배열 / 객체” 모두 대응**(이미 샘플 생성/통계에서 이슈가 있었던 포인트) 

### 8.2 문항 정규화 (필수)

정규화 결과 타입(권장):

```ts
type NormalizedQuestion = {
  id: string
  orderNo: number
  body: string
  type: 'single'|'multiple'|'text'
  options: Array<{ id: string; text: string }> // 선택형만
  role: 'timeframe'|'project_type'|'followup_intent'|'other'
  roleSource: 'override'|'heuristic'|'unknown'
}
```

#### 8.2.1 options 파싱 규칙

* `options`가 string이면 `JSON.parse` 시도
* 실패하면 `[]`로 폴백 + dataQuality warning 기록
* option id가 없으면 `id = hash(text)`로 생성(단, **가급적 기존 id 유지 우선**)

### 8.3 Role 추정(문항 역할 인식) v1

기존 키워드 기반을 “안전한 기본값”으로 유지하되, **수동 override**를 허용하는 구조로 만듭니다. (문항이 바뀌어도 분석이 유지되는 핵심) 

#### 8.3.1 Role override 저장 방식(권장)

* `form_questions`에 nullable 컬럼 추가:

  * `analysis_role_override text null` (`timeframe|project_type|followup_intent|other`)
* 운영자가 폼 관리 UI에서 “이 문항은 timeframe” 같은 설정을 해둘 수 있게 함

> v1에서는 UI가 없어도, 컬럼만 있어도 운영/디버깅이 쉬워집니다.

#### 8.3.2 Heuristic 룰(기본)

* timeframe: “언제/시기/계획/기간/1주/1개월/3개월…” 등
* project_type: “프로젝트/분야/영역/종류/데이터센터/보안/네트워크…” 등
* followup_intent: “의향/요청/미팅/방문/연락/상담…” 등
  (현 설계와 동일 계열)  

### 8.4 문항별 통계(questionStats) 생성 규칙

모든 문항을 “for-loop”로 처리 (문항 수가 유동적이어도 동일 동작). 

#### 8.4.1 선택형(single/multiple)

* `totalAnswers`: 해당 question의 응답 개수
* `distribution`: optionId → count
* `topChoices`: 상위 N개(기본 5개)
* `missingRate`: (전체 제출 대비 이 문항 응답이 비어있는 비율) *선택*

#### 8.4.2 텍스트(text)

* `textAnswers`: 빈 값 제거 후 배열
* 프롬프트에는 **전체를 넣지 말고 샘플링**:

  * 예: 최대 50개만 포함(랜덤/최근순)
  * 나머지는 count만 제공

### 8.5 교차표(Crosstabs) 생성 전략

기존 “역할 기반 3개”는 유지하되, 문항이 많아질 때를 대비해 “확장 전략”을 명세합니다. 

#### 8.5.1 기본(역할 기반 우선)

* timeframe × followup_intent
* project_type × followup_intent
* timeframe × project_type

#### 8.5.2 확장(옵션, v1에 포함 권장)

* 역할이 없거나 문항이 많을 때:

  * 선택형 문항들 중에서 후보 pair를 만들고,
  * “분석가치 점수”로 상위 K개만 교차표 생성 (K=3~7 권장)

**분석가치 점수(권장)**

* 각 pair에 대해:

  * 최소 표본 조건(각 셀 count ≥ 5인 셀 존재 여부)
  * max lift(또는 chi-square 근사)를 계산
  * `score = maxLift * log(1 + minCellCount)` 같은 형태로 정렬

> 이렇게 하면 문항이 20개로 늘어도 “교차표 폭발(N²)”을 막으면서, 의미 있는 조합만 자동 선택됩니다.

### 8.6 Lead Signals(리드 신호) 생성(조건부)

* 기존 정책 유지: 최소 timeframe + followup_intent가 있어야 활성화 
* (권장) project_type은 있으면 가산, 없으면 0점

#### 8.6.1 스코어 매핑 방식

* v1에서는 “선택지 텍스트 기반 매핑”을 기본으로 두되,
* **옵션 ID 기반 매핑 테이블(설정 JSON)**을 도입하면 문항 텍스트가 바뀌어도 안정적입니다.

권장 구조:

```ts
type LeadScoringConfig = {
  timing: Record<string /* optionId */, number>
  followup: Record<string /* optionId */, number>
  projectType?: Record<string /* optionId */, number>
  tierThresholds: { P0: number; P1: number; P2: number; P3: number } // P4는 else
}
```

저장 위치(선택):

* (간단) 코드 상수 + 추후 캠페인별 override
* (권장) `event_survey_campaigns.analysis_config` JSONB

### 8.7 Evidence Catalog 생성 규칙

* Evidence는 “LLM이 숫자를 만들지 못하게 하는” 안전장치
* EvidenceItem은 반드시:

  * id(E1…En)
  * valueText(예: “34% (17/50)”)
  * n(표본)
  * source(qStats/crosstab/derived)
  * notes(선택)

> Evidence Catalog를 기반으로 Decision Pack에서 모든 주장을 Evidence ID로 연결하는 방식은 기존 설계의 핵심입니다. 

### 8.8 Data Quality 생성 규칙

최소 3개 이상 생성(정보/경고 혼합):

* 표본 수 경고(예: n<30)
* 텍스트 응답 비율이 너무 낮음
* 교차표 셀 표본 수 부족(셀<5) 등

---

## 9. Decision Pack(dp-1.0) 상세 명세

### 9.1 생성 원칙

* LLM은 “계산”이 아니라 “해석/액션 구조화”만 수행
* 모든 결론은 Evidence ID 참조
* 출력은 JSON only (코드블럭 금지)

> 이 원칙은 기존 Action Pack(V0.9)에서도 강조되었고, 현재 Decision Pack에서도 동일하게 유지합니다.  

### 9.2 프롬프트 구성(권장)

#### 9.2.1 System Prompt 핵심 요구사항

* Decision Cards 3~5개 필수
* 각 카드:

  * options는 반드시 A/B/C
  * evidenceIds 최소 2개
  * confidence는 Confirmed/Directional/Hypothesis 중 하나
* Action Board: d0/d7/d14 각각 최소 1개
* Playbooks: sales/marketing 각각 최소 3개
* Survey Next Questions: 최소 2개

(현재 설계와 동일 계열) 

#### 9.2.2 User Prompt에 포함할 데이터(권장 최소집합)

* campaignTitle, analyzedAt, sampleCount, lens
* role 추정 결과 요약(어떤 문항이 timeframe인지 등)
* questionStats(선택형은 topChoices 중심)
* crosstabHighlights(상위 lift 셀만)
* leadSignals summary(티어 분포)
* evidence catalog 전체(핵심)

> **중요:** 질문이 많아질수록 prompt 토큰이 커지므로, “원본 분포 전체”보다 “topChoices + evidence + highlight” 중심으로 보내세요.

### 9.3 Decision Pack 스키마(구현 기준)

```ts
type DecisionPack = {
  version: 'dp-1.0'
  lens: 'general'|'sales'|'marketing'
  decisionCards: Array<{
    question: string
    options: Array<{
      id: 'A'|'B'|'C'
      title: string
      description: string
      expectedImpact: string
      risks?: string
    }>
    recommendation: 'A'|'B'|'C'
    evidenceIds: string[] // min 2
    confidence: 'Confirmed'|'Directional'|'Hypothesis'
    rationale: string // min 20 chars
  }> // 3~5
  actionBoard: {
    d0: Array<{ owner:'sales'|'marketing'|'ops'; title:string; targetCount:string; kpi:string; steps:string[] }>
    d7: Array<{ ... }>
    d14: Array<{ ... }>
  }
  playbooks: {
    sales: Array<{ title:string; when:string; steps:string[]; evidenceIds:string[] }>
    marketing: Array<{ title:string; when:string; steps:string[]; evidenceIds:string[] }>
  }
  surveyNextQuestions: Array<{ question:string; answerType:'single'|'multiple'|'text'; why:string }>
  meta?: { model?:string; generatedAt?:string; warnings?:string[] }
}
```

---

## 10. 품질 게이트: Linter + Retry + Merge(서버 보증)

### 10.1 Linter 규칙(필수)

`lintDecisionPack(decisionPack, analysisPack)`에서 아래를 검사:

1. **Evidence 존재성**

* decisionPack 내 모든 evidenceIds가 analysisPack.evidenceCatalog에 존재해야 함
* 없으면 `INVALID_EVIDENCE_ID` 경고/실패

2. **Decision Cards 개수/형식**

* 3~5개인지
* options가 정확히 A/B/C인지
* recommendation이 A/B/C 중 하나인지
* rationale 최소 길이

3. **Action Board 최소 요건**

* d0/d7/d14 각각 1개 이상
* steps 최소 1개 이상
* owner enum 제한

4. **플레이스홀더 금지**

* “TBD”, “추후”, “예: …” 같은 템플릿 문구 감지

> 이 방식은 기존 “재시도 + 스키마 검증 + 품질 검증 실패 시 재시도” 패턴을 그대로 확장한 것입니다.  

### 10.2 Retry 전략(필수)

* 최대 4회
* 실패 종류:

  * JSON 파싱 실패
  * Zod 스키마 검증 실패
  * Linter 실패
    → 실패 원인을 다음 프롬프트에 “오류 목록”으로 포함하여 재생성

### 10.3 Merge 단계(필수: 숫자/정합성 보증)

`mergeAnalysisAndDecisionPack(analysisPack, decisionPack)`에서:

* decisionPack.actionBoard.targetCount가 “근거 없는 숫자”로 보이면:

  * 서버 계산값(leadSignals, sampleCount, evidence)로 **자동 교정**하거나
  * “범위형 표현(예: ‘P0 12명’)”으로 강제 치환
* 최종적으로:

  * `statistics_snapshot = { analysisPack, decisionPack, warnings }` 생성 후 DB 저장

---

## 11. 렌더링(Markdown) 구현 명세

### 11.1 렌더 순서(권장)

1. 리포트 헤더(캠페인명/표본/분석시점/lens)
2. Executive Summary(Decision Pack의 핵심 요약이 있으면 표시, 없으면 Analysis Pack highlights 요약)
3. Decision Cards (핵심)
4. Action Board (D+0/D+7/D+14)
5. Playbooks (Sales/Marketing)
6. Survey Next Questions
7. Evidence Catalog 요약(선택)
8. Data Quality 경고

> “Decision Cards가 핵심”이므로, UI/MD 모두 Decision Cards를 가장 상단에 배치하세요.

---

## 12. 성능/안정성 설계 (문항 증가 대응)

### 12.1 계산 비용 상한

* 문항 수 Q가 커질 때:

  * questionStats: O(Q * answers)
  * crosstab: O(K * answers) (K는 상위 선택 pair 수로 제한)
* 권장 제한:

  * topChoices: 5개 고정
  * 교차표: role기반 3개 + 확장 최대 4개 = 총 7개 이내
  * 텍스트 답변 프롬프트 포함: 최대 50개 샘플

### 12.2 서버리스 타임아웃 대응

* LLM 호출은 가장 느린 구간이므로:

  * 재시도는 “빠른 실패 + 짧은 백오프”로 설계
  * Decision Pack 실패 시 즉시 폴백하여 Analysis Pack 리포트라도 저장 

---

## 13. 테스트 계획

### 13.1 단위 테스트(권장)

* options 파싱(문자열/JSONB/깨진 JSON)
* role inference(override 우선 적용)
* distribution/topChoices 계산 정확성
* lift 계산(분모 0 방지)
* evidence 생성 id 연속성(E1…)
* linter: evidenceIds 존재성 검증

### 13.2 통합 테스트(권장)

* generate API 호출 → DB 저장 → report_md 반환
* 문항 3개/5개/10개 케이스
* timeframe/followup_intent 없을 때 leadSignals 비활성화 & 정상 생성 

---

## 14. 단계적 롤아웃(권장)

1. **ap-1.0만 먼저 안정화**(리포트는 Analysis Pack 기반 MD라도 생성)
2. dp-1.0 도입:

   * 성공률/실패율 로깅
   * linter 실패 사유 수집 → 프롬프트 개선
3. role override 컬럼/설정 UI 추가(필요 시)

---

# 결론: “문항 변화에 강한” 핵심 설계 포인트 요약

* **문항 수/형이 바뀌어도**: 모든 문항을 동적 루프로 통계 생성 
* **문항 의미(역할)가 바뀌어도**: role override(수동 지정) + heuristic(자동 추정) 이중화
* **Decision Card 품질/일관성**: Evidence Catalog 기반 + linter + merge 교정으로 서버가 최종 보증 
* **실패해도 깨지지 않음**: Decision Pack 실패 시 Analysis Pack만으로 폴백 저장/렌더 

---

원하면, 위 명세를 기준으로 **(1) Zod 스키마 파일 초안**, **(2) buildAnalysisPack/buildComputedMetrics 함수 시그니처와 실제 TypeScript 코드 스켈레톤**, **(3) 프롬프트 템플릿(system/user/retry) 원문**, **(4) role override 컬럼 추가 마이그레이션 SQL**까지 “바로 커밋 가능한 형태”로 더 구체화해서 같이 만들어줄게요.

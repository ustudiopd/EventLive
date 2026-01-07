According to a document from **2026-01-07**, 현재 만들어진 “중간 지침(Guideline)”은 **(1) 분석 목적/의사결정 질문 → (2) 문항 역할 매핑 → (3) 교차표 계획 → (4) 리드 스코어링 설정**까지 포함하고 있어서, “디시즌카드 중심”의 분석을 설계하는 **중간 레이어**로 방향이 아주 좋습니다.

다만 지금 단계의 핵심은 **“그렇게 만들 수 있는 엔진(하드코딩 없이)”**이므로, 아래는 *문항이 늘거나 바뀌어도* 같은 형태의 지침을 **자동 생성/수정/버전관리/적용**할 수 있는 **Guideline Engine 전체 구현 명세서**입니다.
(현재 시스템이 이미 **Analysis Pack(ap-1.0)** 과 **Decision Pack(dp-1.0)** 파이프라인을 갖고 있다는 전제에서, 그 사이에 **Guideline Pack(gp-1.0)** 을 끼워 넣는 설계입니다.

---

## 1. 목표

### 1.1 제품 목표

* 설문 문항이 **추가/삭제/수정/순서변경**되어도:

  * 지침을 **자동으로 생성**하고
  * 운영자가 **UI에서 수정**할 수 있으며
  * 그 지침을 기반으로 **분석(Analysis Pack) + 디시전(Decision Pack)** 생성이 **깨지지 않게** 한다.

### 1.2 “하드코딩 제거”의 정의

* “특정 문항 ID/문항 문구/선택지 값”에 의존하는 로직을 코드에 박지 않는다.
* 대신 아래를 **데이터(Registry)로 외부화**한다.

  1. 역할(Role taxonomy)
  2. 역할 분류 규칙(키워드/정규식/LLM 분류 프롬프트)
  3. 교차표 후보 선정 규칙
  4. 리드 스코어링 모델(컴포넌트/가중치/티어 임계값)
  5. 디시즌카드 템플릿(조건부 활성화 + evidence 타입 요구사항)

> 이 방향은 기존 명세에서도 “CardTemplateRegistry + templateId 강제”, “logical_key/role_override”, “Evidence.type + reliability”, “교차표 상위 K 자동선별”로 정리되어 있습니다.

---

## 2. 현재 상태와 연결점

### 2.1 이미 구현된 것(현 파이프라인)

* **Analysis Pack(ap-1.0)**: 서버 결정론적 통계/교차표/증거(Evidence) 생성
* **Decision Pack(dp-1.0)**: LLM이 Evidence Catalog 기반으로 의사결정 카드 생성 + Zod 검증 + Linter + 재시도
* 병합/렌더링 및 DB 저장까지 완료

### 2.2 지금 필요한 추가 레이어

* 현재도 role 기반 동적 처리는 있지만, “문항 유동성”이 커질수록:

  * role 추정 정확도(운영자 오버라이드 필요)
  * 교차표 전수 생성 비용/노이즈(상위 K 선별 필요)
  * 디시전카드의 일관성(templateId/registry 기반 제한 필요)
    가 중요해집니다.

---

## 3. 핵심 개념 정의

### 3.1 Form Fingerprint

* 특정 설문 폼의 “문항 구조(문항 텍스트/유형/선택지)”를 해시로 만든 값.
* Guideline은 **반드시 어떤 Fingerprint 기준**으로 생성되었는지 저장합니다(예시 가이드라인에 이미 포함).

### 3.2 Logical Key

* 문항 ID가 바뀌어도 “같은 의미의 문항”을 추적/병합하기 위한 키.
* `form_questions.logical_key`, `form_questions.role_override`, `revision`, 그리고 제출 시점 snapshot 저장을 권장(기존 명세에 구체적으로 제시).

### 3.3 Role Taxonomy

* 문항을 “의미 역할”로 일반화 (예: timeline, budget_status, authority, intent_followup …)
* 기존 방향이 맞고, 더 확장 가능해야 함(역할 확장 + 자동 분류 + 운영자 override).

---

## 4. 아키텍처 개요

### 4.1 새로 추가되는 팩

* **Guideline Pack (gp-1.0)**:
  “이 설문을 어떤 의사결정 구조로 분석할지”를 정의하는 실행 가능한 설정 묶음

### 4.2 전체 흐름

1. (기존) 서버가 응답 데이터를 읽어 **Analysis Pack(ap-1.0)** 생성
2. (신규) Analysis Pack + Form Schema로 **Guideline Pack(gp-1.0) 초안 생성**
3. (신규) 운영자가 UI에서 Guideline 편집 → **Publish**
4. (기존/개선) Publish된 Guideline을 입력으로 **Decision Pack(dp-1.1 권장)** 생성
5. 보고서 렌더링/저장

> “중간지침 → 교차표 계획 → 리드 스코어링 설정” 같은 구조가 실제 guideline 문서에 이미 나타납니다.

---

## 5. 데이터 모델 (DB) 명세

### 5.1 필수 마이그레이션(문항 유동 대응 베이스)

기존 명세의 최소안 그대로 채택합니다.

* `form_questions`

  * `logical_key text null`
  * `role_override text null`
  * `revision int not null default 1`
* `form_submissions`

  * `form_revision int not null default 1`
* `form_answers`

  * `question_body_snapshot text null`
  * `options_snapshot jsonb null`
  * `question_logical_key_snapshot text null`
  * `question_role_snapshot text null`

### 5.2 Guideline 저장 테이블 (신규)

`survey_analysis_guidelines`

```sql
create table if not exists public.survey_analysis_guidelines (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null references public.event_survey_campaigns(id) on delete cascade,
  form_id uuid not null references public.forms(id) on delete cascade,

  form_fingerprint text not null,
  form_revision int not null default 1,

  status text not null default 'draft', -- draft | published | archived
  version int not null default 1,

  guideline_pack jsonb not null,         -- gp-1.0 canonical
  guideline_pack_compiled jsonb null,    -- 실행용으로 정규화된 컴파일 결과
  guideline_md text null,                -- 사람이 보는 요약(선택)

  warnings jsonb null,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sag_campaign
  on public.survey_analysis_guidelines(campaign_id, status, version desc);

create index if not exists idx_sag_fingerprint
  on public.survey_analysis_guidelines(form_id, form_fingerprint);
```

### 5.3 “하드코딩 제거”를 위한 Registry 테이블(신규)

아래 3개는 **코드 상수로 두지 않고 DB로 외부화**합니다.

#### 5.3.1 Role Registry

`survey_engine_roles`

* `role_key` (pk) : 예) `timeline`, `budget_status`, `authority`, `intent_followup`
* `label_ko`, `label_en`
* `allowed_question_types` (jsonb) : `["single","multiple","text"]`
* `pattern_rules` (jsonb) : 키워드/정규식/옵션패턴
* `default_is_key_driver` (bool)
* `default_scoring_hint` (jsonb)

#### 5.3.2 Option Grouping Template Registry

`survey_engine_option_templates`

* `template_key` (pk) : `time_buckets`, `yes_no`, `likert_5`, `none`
* `detection_rules` (jsonb) : “선택지에 ‘개월/년/주’ 포함하면 time_buckets”
* `canonical_groups` (jsonb) : 그룹 정의(정렬/라벨/점수 기본값 등)

> 예: 가이드라인 v1에서 timeline을 “단기/중기/장기/계획없음” 그룹으로 나누고 가중치를 두는 구조가 이미 존재합니다.

#### 5.3.3 Decision Card Template Registry

`survey_engine_card_templates`

* `template_id` (pk)
* `title`, `description`
* `required_roles` (jsonb)
* `required_evidence_types` (jsonb)
* `prompt_snippet` (text) : LLM에게 카드 생성 규칙
* `output_constraints` (jsonb) : “A/B/C 옵션”, “evidenceIds 최소 2개”, 등

> 기존 명세에서 “templateId 유효성 체크”, “카드별 evidence 타입 조건 검사”, “reliability gate”, “targetCount 서버 교정”이 필요하다고 했고, 이게 바로 템플릿 기반 엔진의 품질 게이트가 됩니다.

---

## 6. Guideline Pack (gp-1.0) 스키마 명세

> **사람이 읽는 MD는 파생물**, **정답은 JSON(gp-1.0)** 입니다.
> (UI 편집/검증/컴파일/버전관리 모두 JSON 기준)

### 6.1 Top-level

```ts
interface GuidelinePackV10 {
  version: "gp-1.0"
  status: "draft" | "published"
  formFingerprint: string
  formRevision: number
  lens: "general" | "sales" | "marketing"

  decisionObjectives: {
    primaryQuestions: string[]   // 3~7개 권장
    successMetrics?: string[]    // 선택
  }

  questionMap: QuestionGuideline[]

  analysisPlan: {
    crosstabs: CrosstabPlan[]
    leadScoring?: LeadScoringPlan
    segments?: SegmentPlan[]
    decisionCardPlan: DecisionCardPlan   // 템플릿 기반
  }

  changeLog?: { message: string; createdAt: string }[]
}
```

### 6.2 QuestionGuideline

```ts
interface QuestionGuideline {
  questionId: string
  logicalKey?: string

  roleKey: string              // role registry의 key
  roleConfidence: "high" | "medium" | "low"
  importance: "key" | "support" | "ignore"

  optionTemplateKey?: string   // option template registry
  optionGroups?: Array<{
    groupKey: string
    label: string
    optionIds: string[]
    score?: number
  }>

  scoring?: {
    enabled: boolean
    scoringMode: "option" | "group" | "none"
    weight?: number
  }
}
```

### 6.3 CrosstabPlan

```ts
interface CrosstabPlan {
  id: string
  row: { selector: "roleKey" | "logicalKey"; value: string }
  col: { selector: "roleKey" | "logicalKey"; value: string }
  minCellCount: number
  topK: number
  note?: string
}
```

> 가이드라인 예시에서도 “행 역할/열 역할/최소 셀 수/상위 행·열” 형태로 존재합니다.

### 6.4 LeadScoringPlan

```ts
interface LeadScoringPlan {
  tiers: Array<{ tier: "P0"|"P1"|"P2"|"P3"|"P4"; minScore: number }>
  components: Array<{ selector: "roleKey"|"logicalKey"; value: string; weight: number }>
  tierActions: Array<{ tier: "P0"|"P1"|"P2"|"P3"|"P4"; action: string }>
}
```

> 실제 가이드라인에도 티어 임계값/컴포넌트 가중치/티어별 액션이 들어가 있습니다.

### 6.5 DecisionCardPlan

```ts
interface DecisionCardPlan {
  minCards: number   // 3
  maxCards: number   // 5

  allowedTemplateIds: string[]   // registry 기반 (하드코딩 금지)
  selectionPolicy: "auto" | "manual"

  // auto일 때: role/evidence 충족 템플릿만 후보
  constraints: {
    minEvidencePerCard: number   // 2
    forbidAllHypothesis?: boolean
  }
}
```

---

## 7. Guideline 생성 엔진 동작 명세

### 7.1 입력

* Form Schema (문항/선택지/유형/순서)
* Analysis Pack 요약(표본 수, 문항별 분포, 존재하는 evidence 타입 목록 등)
* Registry 데이터(role/option/card templates)
* (선택) 캠페인 컨텍스트(업종/목표/세일즈 사이클)

### 7.2 생성 단계

#### Step A. Form Fingerprint 계산

* canonical JSON으로 serialize 후 sha256
* 기준 필드: questionId, body, type, options(id,text), order(선택)

#### Step B. 역할(Role) 부여 (Hard rule + Override + LLM fallback)

우선순위:

1. `form_questions.role_override`가 있으면 최우선
2. Role Registry의 `pattern_rules`로 점수화(키워드/정규식/옵션패턴)
3. 애매하면 **LLM role 분류 호출(짧은 호출 1회)** → roleKey + confidence 반환

#### Step C. logical_key 자동 제안

우선순위:

1. `form_questions.logical_key` 존재 시 사용
2. roleKey 기반 기본 매핑(단, 이 매핑 자체도 “DB 규칙”로 외부화)
3. 실패 시 body 해시 기반 임시키

> 기존 명세에서도 logical key 부여 3단계를 제안합니다.

#### Step D. Option Grouping 자동 제안

* option template registry의 detection_rules로 template 선정
* template이 있으면 canonical group 생성(예: timeline bucket, yes/no 등)
* 스코어링 기본값(점수/가중치)은 template의 디폴트로 세팅
  (운영자 UI에서 수정 가능)

#### Step E. 분석 계획(교차표/리드스코어/카드플랜) 생성

* 규칙 기반 1차 생성:

  * key driver 후보 role을 우선 선택(Registry에 `default_is_key_driver`)
  * crosstab은 (1) “권한/예산/의향/타임라인” 류 role 우선, (2) categorical×categorical만
* LLM 기반 2차 보강(선택):

  * “의사결정 질문(primaryQuestions)” 문장 생성
  * 교차표 plan에 note 보강
  * 카드 템플릿 후보 중 우선순위 추천

#### Step F. Lint & Compile (서버에서 결정론적)

* gp-1.0 Zod 검증
* 존재하지 않는 questionId/roleKey/templateId 참조 제거
* min/max cards, min evidence 등 제약 정규화
* “실행용 compiled config” 생성:

  * roleKey/logicalKey → 현재 폼의 실제 questionId로 resolve
  * 같은 logicalKey가 여러 개면 우선순위 룰(최신 revision/가장 응답 많은 문항)로 1개 선택

---

## 8. Guideline 편집/퍼블리시 UI 명세

### 8.1 화면 구성(권장)

1. **Overview 탭**

   * lens, primaryQuestions 편집
   * formFingerprint 표시(변경 감지)
2. **Question Map 탭**

   * 문항 리스트 테이블
   * 컬럼: 문항 / 유형 / roleKey(드롭다운) / importance / logicalKey / option template / 그룹 편집 / scoring(weight)
3. **Crosstab Plan 탭**

   * row/col selector 설정
   * minCellCount/topK 조정
4. **Lead Scoring 탭**

   * tier 임계값, role 가중치 편집
   * 티어별 액션 문구 편집
5. **Decision Cards 탭**

   * allowedTemplateIds 선택(체크박스)
   * “현재 데이터로 활성화 가능한 템플릿”만 강조 표시
6. **Publish & History 탭**

   * 버전 목록, diff, publish 버튼
   * publish 시 status=published + lock(원칙: published 수정 불가, 새 버전 생성)

### 8.2 권한/접근 패턴

* 프로젝트 표준 Guard Pattern 사용:

  * `requireAuth()`, `requireAgencyMember()`, `requireClientMember()` 등
* DB 조회는 필요 시 `createAdminSupabase()` 패턴(표준)

---

## 9. API 명세 (Next.js App Router)

> 기존 분석 생성 API와 같은 결로 `/app/api/event-survey/campaigns/[campaignId]/...` 추천

### 9.1 Guideline 생성

`POST /api/event-survey/campaigns/[campaignId]/guidelines/generate`

* Request

```json
{
  "lens": "general",
  "mode": "from_form" | "from_analysis_pack",
  "forceNewVersion": false
}
```

* Response

```json
{ "success": true, "guidelineId": "uuid", "status": "draft", "version": 3 }
```

### 9.2 Guideline 조회

`GET /api/event-survey/campaigns/[campaignId]/guidelines?status=draft|published`

### 9.3 Guideline 수정(부분 업데이트)

`PATCH /api/event-survey/guidelines/[guidelineId]`

* body는 `guideline_pack` 전체 또는 JSON Patch(선택)

### 9.4 Compile / Validate

`POST /api/event-survey/guidelines/[guidelineId]/compile`

* 서버 lint + compiled config 생성
* warnings 반환

### 9.5 Publish

`POST /api/event-survey/guidelines/[guidelineId]/publish`

* publish 시:

  * 동일 campaign_id에서 기존 published는 archived 처리
  * 새 published 1개 유지

---

## 10. 보고서 생성(Decision Pack)과의 결합 명세

### 10.1 보고서 생성 시 Guideline 선택 규칙

1. campaign_id 기준 published guideline이 있고 fingerprint가 일치 → 사용
2. fingerprint가 불일치 → (a) 자동 rebase로 draft 생성, (b) 운영자에게 경고
3. guideline이 없으면 → “최소 guideline”을 즉석 생성(규칙 기반만) 후 진행

### 10.2 Decision Pack에 templateId 도입(dp-1.1 권장)

* dp-1.0은 templateId가 없고, 향후 계획으로 언급되어 있습니다.
* dp-1.1에서는 decisionCards에 `templateId` 필드를 추가하고, LLM은 **allowedTemplateIds 안에서만 선택**하도록 강제합니다.
* 품질 게이트(필수):

  1. templateId 유효성 체크(Registry에 없으면 재시도)
  2. template별 required_evidence_types 충족 여부(불충족이면 재시도/카드 제거)
  3. reliability gate(전부 Hypothesis면 경고/대체)
  4. targetCount 서버 권위로 숫자 교정

---

## 11. “문항이 바뀌는” 상황 처리 규칙

### 11.1 질문 문구/선택지 수정

* `revision++`
* 응답 저장 시 snapshot 필드로 “당시 질문/선택지” 보존

### 11.2 질문 추가/삭제/순서 변경

* fingerprint 변경 감지
* Guideline Rebase 로직:

  * 기존 guideline의 questionMap을 logical_key로 새 폼에 매칭
  * 매칭 실패 문항은 importance=ignore로 보관(히스토리), 새 문항은 role 추정해서 추가
  * 운영자에게 “새 문항 role 미확정” 리스트 표시

---

## 12. 테스트/완료 기준(DoD)

### 12.1 자동화 테스트

* role inference:

  * override 우선 적용
  * pattern match로 correct role 선택
  * LLM fallback이 스키마를 준수
* compile:

  * roleKey/logicalKey resolve 성공
  * 유효하지 않은 참조 제거
* publish:

  * published 1개 유지, 이전 archived

### 12.2 시나리오 테스트(중요)

* 문항 5개 → 12개로 증가

  * guideline 자동 생성
  * 교차표 후보 자동 선별
  * Decision Cards 3~5개 유지
* 문항 wording 변경 + 선택지 순서 변경

  * 과거 보고서 재현 가능(answers snapshot)
  * 새 guideline rebase 성공(logical_key 기준)

### 12.3 완료 기준

* 운영자가 **지침을 만들고(자동 초안)** → **수정** → **publish** → **AI 분석 생성**까지 UI로 완결
* 문항 변경이 있어도 **코드 수정 없이** guideline 재생성/재베이스로 대응

---

## 13. 구현 우선순위(추천)

1. **DB 스냅샷/논리키/오버라이드 컬럼** 먼저(문항 유동성의 기반)
2. Guideline 저장 테이블 + CRUD API
3. Role/Option/Card Template Registry(DB) + seed 데이터 마이그레이션
4. guideline generate(규칙 기반) → compile → UI 편집 → publish
5. Decision Pack에 templateId 도입 + 품질 게이트 적용
6. (고도화) 교차표 전수 생성 후 상위 K 선별, reliability/evidence type 확장

---

원하면, 다음 단계로 **(A) gp-1.0 Zod 스키마 파일 초안**, **(B) Role/Option/Card Template registry seed JSON**, **(C) generate/compile/publish API route.ts 골격(Next.js App Router)**까지 “바로 코드로 옮길 수 있게” 더 구체적으로 내려드릴게요.

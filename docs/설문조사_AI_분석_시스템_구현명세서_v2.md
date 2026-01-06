가능해요. 그리고 지금 주신 5개 문항 셋(타임라인/영역/예산/권한/후속의향)은 **현재 파이프라인에도 “부분 대응”은 되지만**, “예산/권한”이 **디시즌카드의 핵심 축으로 들어가게 하려면** 말씀하신 **중간 단계(문항 분석 + 디시전 방향 지침)**를 넣는 설계가 더 안정적입니다. 아래에 **실제 구현용 명세서** 형태로 정리해드릴게요.

---

## 1) 먼저 답: 지금 문항에 “대응” 되고 있나?

현재 시스템은 “문항 수/구성이 바뀌어도” 분석이 돌아가도록 **동적 문항 처리 + 역할(role) 자동추정** 구조를 이미 갖고 있어요. (Analysis Pack → Decision Pack 2단계) 

다만, 역할 자동추정이 기본적으로 아래 3개만 강하게 잡습니다. 

* `timeframe` (언제/계획/1주/1개월 등)
* `project_type` (프로젝트/종류/데이터센터 등)
* `followup_intent` (의향/요청/방문/관심없음 등)

그래서 질문 5개를 현재 룰에 대입하면:

1. **프로젝트 계획 시기** → `timeframe` ✅
2. **프로젝트 영역(보안/데이터센터/라우팅/캠퍼스...)** → `project_type` ✅
3. **예산 확보 여부** → 현재는 `other`(통계는 계산됨) ⚠️
4. **Authorized Buyer 여부(권한)** → 현재는 `other`(통계는 계산됨) ⚠️
5. **HPE 상세 안내 의향** → `followup_intent` ✅

즉,

* **문항별 분포/Top choice/Evidence Catalog에는 3번/4번도 들어가서**, LLM이 보고서에 언급은 할 수 있음 ✅ 
* 하지만 **교차표/리드스코어링은 role 기반(타임라인/프로젝트/후속의향 중심)으로만 돌아가므로**,
  “예산/권한이 있는 단기 리드 우선 컨택” 같은 **디시전카드 핵심 질문**이 자동으로 강화되진 않음 ⚠️ 

➡️ 결론: **대응은 되지만(분포/근거는 확보), 디시전카드 중심 설계로는 아직 부족**합니다.

---

## 2) 제안: “AI 보고서 이전”에 중간 단계 추가하는 게 맞다

사용자 제안(문항 분석 → 디시전 방향 지침 → 그 지침으로 AI 분석 실행)은, 설문 문항이 유동적인 환경에서 특히 강력합니다.

### 2.1 왜 필요한가

* 문항이 바뀌면 “이 문항이 타임라인인지/예산인지/권한인지”를 매번 자동 추정해야 하는데, **키워드 룰만으로는 한계**가 있음
* 디시전카드는 “우리가 어떤 결정을 하려는가”가 먼저 고정돼야 함
  (예: “P0 리드 정의”, “예산+권한 있는 사람 우선 컨택”, “영역별 메시지 분기”)
* 그래서 **(1) 문항 의미를 구조화하고, (2) 분석 방향을 사람이 수정 가능하게 만든 뒤, (3) 그 지침으로 분석을 돌리는 구조**가 안정적입니다.

---

## 3) 최종 아키텍처: 3단계 Pack 구조로 확장

기존:
**Analysis Pack(서버 계산)** → **Decision Pack(LLM)** 

개선:
**Guideline Pack(중간 지침)** → **Analysis Pack** → **Decision Pack**

### 3.1 전체 흐름

```
[설문 폼/문항/선택지]
    ↓
(신규) [Guideline Pack 생성]  (LLM + 규칙 + 사람이 수정/확정)
    ↓
[Analysis Pack 생성] (서버 결정론 통계 + 지침 기반 파생지표)
    ↓
[Decision Pack 생성] (LLM, 지침 + evidence 기반 디시전카드 생성)
    ↓
[렌더링/저장]
```

* Guideline Pack은 “문항이 무엇을 의미하는지 / 어떤 결정을 지원해야 하는지”를 구조화한 **설계도**입니다.
* 사람이 **수정/확정(Publish)**할 수 있어야 하고, 보고서 생성은 **Publish된 지침을 기준**으로 돌아가야 합니다.

---

## 4) 실제 구현 명세서

아래는 **DB/스키마/API/서버 모듈/UI/검증**까지 포함한 구현용 명세입니다.
(프로젝트 스택: Next.js Route Handler + Supabase + TS 기준)

---

# A. Guideline Pack (GP-1.0) 명세

## A.1 목적

* 설문 문항이 바뀌어도 **“의사결정 카드” 중심 분석**이 유지되도록
* 문항의 의미(역할)와 분석 의도를 **구조화 + 사람이 편집 가능**하게 저장

## A.2 핵심 기능

1. 문항 의미/역할(Role) 분류 (LLM + 룰)
2. 선택지 정규화/그룹핑 (예: 1주/1개월/1~3개월 → “단기”)
3. 디시전카드 질문 세트/우선순위 정의
4. 교차표 계획(crosstab plan) 정의
5. 리드 스코어링 규칙을 “질문 기반”으로 정의 (예: 예산+권한 반영)
6. 폼 변경 감지(지침 stale 여부)

---

## A.3 Role taxonomy (권장)

기존 3개에서 확장해서 BANT를 안정적으로 커버:

* `timeline` (기존 timeframe)
* `need_area` (기존 project_type)
* `budget_status` (신규)
* `authority_level` (신규)
* `engagement_intent` (기존 followup_intent)
* `other`

> 지금 문항셋은 정확히 `timeline/need_area/budget_status/authority_level/engagement_intent`로 매핑됩니다.

---

## A.4 Guideline Pack JSON 스키마 (요약)

```ts
type GPVersion = 'gp-1.0'

type Role =
  | 'timeline'
  | 'need_area'
  | 'budget_status'
  | 'authority_level'
  | 'engagement_intent'
  | 'other'

interface GuidelinePack {
  version: GPVersion

  // 폼 변경 감지용
  formId: string
  formFingerprint: string // sha256(canonical form blueprint)

  // 분석 목적(디시전 중심)
  objectives: {
    primaryDecisionQuestions: string[]   // 디시전카드 질문 후보(우선순위 순)
    reportLensDefault: 'general' | 'sales' | 'marketing'
  }

  // 문항 매핑
  questionMap: Array<{
    questionId: string
    orderNo: number
    role: Role
    importance: 'core' | 'supporting'
    label?: string

    // 선택지 정규화/그룹핑(선택형 문항에서 특히 중요)
    optionGroups?: Array<{
      groupKey: string        // e.g. "short_term"
      groupLabel: string      // e.g. "단기(≤3개월)"
      choiceIds: string[]     // 해당 그룹에 포함할 선택지 id들
    }>

    // 스코어링에 쓰는 규칙(질문별)
    scoring?: {
      enabled: boolean
      weightsByGroupKey?: Record<string, number> // optionGroups 사용 시
      weightsByChoiceId?: Record<string, number> // raw choiceId 사용 시
      defaultWeight?: number
    }
  }>

  // 교차표 계획(“어떤 쌍을 의미있게 볼지”를 지침으로 고정)
  crosstabPlan: Array<{
    rowRole: Role
    colRole: Role
    minCellN: number   // e.g. 5
    topKRows: number   // e.g. 5
    topKCols: number   // e.g. 5
    note?: string
  }>

  // 리드 스코어(질문/그룹 기반)
  leadScoring: {
    enabled: boolean
    tierThresholds: { P0: number; P1: number; P2: number; P3: number } // P4는 그 미만
    components: Array<{
      role: Role
      weight: number // component multiplier
    }>
    recommendedActionsByTier: Record<'P0'|'P1'|'P2'|'P3'|'P4', string>
  }
}
```

> Zod 스키마는 `lib/surveys/analysis/guidelinePackSchema.ts`로 구현.

---

# B. DB 설계

## B.1 신규 테이블: `survey_analysis_guidelines`

지침 버전 관리 + Publish 개념 필요.

```sql
create table if not exists public.survey_analysis_guidelines (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null references public.event_survey_campaigns(id) on delete cascade,
  form_id uuid not null references public.forms(id) on delete cascade,

  status text not null check (status in ('draft','published','archived')) default 'draft',
  version_int int not null default 1,

  title text,
  description text,

  form_fingerprint text not null,
  guideline_pack jsonb not null,

  agency_id uuid,
  client_id uuid,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists idx_sag_campaign on public.survey_analysis_guidelines (campaign_id, status);
create unique index if not exists uq_sag_campaign_published
  on public.survey_analysis_guidelines (campaign_id)
  where status = 'published';
```

* “캠페인당 published는 1개”를 강제(위 partial unique index)
* draft는 여러 개 가능(실험/복제 용)

## B.2 기존 테이블 확장: `survey_analysis_reports`

보고서가 어떤 지침으로 생성됐는지 추적(재현성).

```sql
alter table public.survey_analysis_reports
  add column if not exists guideline_id uuid references public.survey_analysis_guidelines(id),
  add column if not exists guideline_pack jsonb;
```

* `guideline_pack`는 **스냅샷**(나중에 지침이 바뀌어도 보고서 재현 가능)

> 기존 보고서 구조(analysis_pack/decision_pack 저장)는 그대로 유지합니다. 

## B.3 RLS/권한

프로젝트 권한 패턴 그대로:

* 서버 Route Handler는 `createAdminSupabase()`로 조회/저장 후 앱 레벨 가드로 권한 체크
* 허용 역할(권장): client `owner/admin/operator/analyst`, agency `owner/admin/analyst`, super admin 전부

---

# C. API 명세

경로는 기존 분석 API 패턴과 동일한 캠페인 하위로 둡니다.

## C.1 Guideline 자동 생성 (초안 생성)

`POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/generate`

### Request

```json
{
  "mode": "fresh" | "refresh",
  "title": "optional"
}
```

* `fresh`: 새로운 draft 생성
* `refresh`: 현재 published(또는 최신 draft) 기반으로 재생성(폼 변경 대응)

### Response

```json
{
  "success": true,
  "guideline": {
    "id": "uuid",
    "status": "draft",
    "version_int": 1,
    "form_fingerprint": "sha256...",
    "guideline_pack": { ...GP-1.0... }
  }
}
```

### 동작

1. campaign → form_id → questions 로드
2. `formFingerprint` 생성
3. (룰 기반) 1차 role 추정
4. (LLM) GuidelinePack 생성 (JSON mode) + Zod 검증 + lint
5. DB 저장(draft)

## C.2 Guideline 조회

`GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines`

Response: draft/published 목록

## C.3 Guideline 단건 조회

`GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]`

## C.4 Guideline 수정(편집 저장)

`PATCH /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]`

Request (부분 업데이트)

```json
{
  "title": "...",
  "description": "...",
  "guideline_pack": { ... }
}
```

* 서버에서 `guideline_pack` Zod 검증 + lint 후 저장

## C.5 Publish

`POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/publish`

동작:

* 기존 published가 있으면 `archived`로 변경
* 해당 guideline을 `published`로 변경 + `published_at`

## C.6 보고서 생성(기존 API 확장)

`POST /api/event-survey/campaigns/[campaignId]/analysis/generate`

Request

```json
{
  "lens": "general" | "sales" | "marketing",
  "guidelineId": "optional uuid"
}
```

동작 우선순위:

1. guidelineId가 오면 그걸 사용(단, draft도 허용할지 정책 결정: 권장은 draft도 허용)
2. 없으면 published 사용
3. published도 없으면: 임시 auto-guideline 생성(런타임) 후 사용(보고서에는 스냅샷 저장)

---

# D. 서버 코드 구조(파일/모듈)

기존 `lib/surveys/analysis/*` 패턴을 그대로 확장합니다. 

```
lib/surveys/analysis/
  guidelinePackSchema.ts
  buildFormFingerprint.ts
  buildSurveyBlueprint.ts
  inferQuestionRoles.ts           // 규칙 기반 1차 추정
  generateGuidelinePack.ts        // LLM 호출(JSON mode)
  lintGuidelinePack.ts
  applyGuidelineToMetrics.ts      // crosstabs/lead scoring 계획 반영
  buildAnalysisPack.ts            // (기존) + guideline 적용 훅 추가
  generateDecisionPack.ts         // (기존) + guideline을 프롬프트에 포함
```

## D.1 buildFormFingerprint.ts

* 입력: questions(order_no 정렬), options(정렬)
* 출력: sha256 해시
* 목적: “폼이 바뀌면 지침이 stale” 감지

## D.2 buildSurveyBlueprint.ts

* Guideline 생성용 최소 구조(문항/선택지/타입/순서)로 정리

## D.3 generateGuidelinePack.ts (LLM)

System prompt 핵심:

* “너는 설문 설계/세일즈 운영 분석가”
* 역할 taxonomy 강제
* optionGroups 생성 규칙(특히 timeline)
* crosstabPlan 최소 2개 이상(예: timeline×engagement, authority×engagement, budget×timeline 등)
* leadScoring component는 최소 3개 이상 포함(권장: timeline, engagement, authority, budget)

**중요**: 기존 Decision Pack처럼 **JSON only + Zod 검증 + retry** 패턴 동일 적용 

## D.4 buildAnalysisPack.ts 변경 포인트

현재는 역할(timeframe/project_type/followup) 기반으로 교차표/리드스코어링 on/off가 결정됩니다. 
→ 앞으로는 guideline이 있으면:

* `question.role`은 guideline의 매핑을 우선(override)
* 교차표는 `crosstabPlan`대로 생성
* 리드스코어는 `leadScoring`대로 생성
* Evidence Catalog에 “그룹 분포(단기/중기/장기)” 같은 **정규화 결과**도 증거로 추가

---

# E. UI/UX 명세 (운영 콘솔에 탭 추가)

기존 설문조사 캠페인 콘솔 구조에 “분석 지침” 탭을 추가합니다.

## E.1 탭 구성

* 개요 / 폼 관리 / 공개페이지 / 참여자 관리 / 설정
* **(신규) 분석 지침**
* 분석 보고서(기존 섹션)

## E.2 “분석 지침” 화면 요구사항

### 1) 상태 영역

* 현재 선택된 guideline: (published/draft), 생성일, 폼 fingerprint 상태
* 폼 변경 감지:

  * “현재 폼과 지침이 불일치(stale)” 뱃지
  * 버튼: “지침 재생성(초안)”

### 2) 문항 매핑 에디터

문항 리스트 테이블:

* order_no, question body, type, role(dropdown), importance(dropdown)
* role dropdown: timeline/need_area/budget_status/authority_level/engagement_intent/other

### 3) 옵션 그룹핑 UI (선택형만)

* 타임라인 문항: “단기/중기/장기/계획없음” 그룹핑을 드래그/체크로 구성
* engagement 문항: “방문/온라인미팅/전화/관심없음” 등 그룹핑 가능

### 4) 리드 스코어링 설정

* enabled 토글
* tier thresholds (P0/P1/P2/P3)
* component weight 조정 (role별 가중치)
* (고급) choice/group별 점수표 편집

### 5) 교차표 계획 설정

* rowRole/colRole 선택 + minCellN 설정
* “기본 추천 템플릿” 버튼 제공

  * timeline×engagement
  * authority×engagement
  * budget×timeline
  * need_area×engagement

### 6) 디시전카드 질문 선택

* 체크리스트 형태로 5~8개 후보 제공
* 최종 생성은 3~5개로 제한(기존 정책 유지) 

### 7) 액션

* “저장”(draft)
* “Publish”
* “이 지침으로 보고서 생성”

---

# F. Lint/검증 규칙 (Guideline Pack 품질 게이트)

`lintGuidelinePack.ts`에서 아래를 경고/에러로 분리:

## F.1 에러(저장/생성 불가)

* `questionMap`에 동일 role이 **여러 개 core**로 지정되어 충돌(예: timeline core 2개)
* leadScoring.enabled인데 timeline/engagement가 모두 없음
* formFingerprint 누락

## F.2 경고(저장은 가능, UI에 표시)

* budget/authority가 other로 남아있음(이번 캠페인 목적상)
* crosstabPlan이 1개 이하
* optionGroups가 없어서 timeline이 raw choice로만 남아 있음(보고서 가독성 저하)

---

# G. “지금 문항셋(HPE 네트워크)”에 대한 권장 Guideline 기본값

이 캠페인의 디시전카드 목적을 “영업 우선순위 + 메시지/채널 분기”로 잡으면, 기본 세팅은 이렇게 추천합니다:

## G.1 Role 매핑

* Q1(언제) → timeline(core)
* Q2(영역) → need_area(core)
* Q3(예산) → budget_status(core)
* Q4(권한) → authority_level(core)
* Q5(의향) → engagement_intent(core)

## G.2 Timeline 그룹 예시

* short_term: 1주일 이내, 1~3개월
* mid_term: 6~12개월
* long_term: 1년 이후
* none: 계획없음

## G.3 리드 스코어 예시(개념)

* timeline(short_term)+30 / mid+15 / long+5 / none+0
* engagement(방문/미팅)+20 / 전화+10 / 관심없음+0
* authority(예)+15 / 아니오+0
* budget(예)+15 / 아니오+0

→ P0: 70+, P1: 55+, P2: 40+, P3: 20+ (예시)

이렇게 하면 디시전카드 질문이 자연스럽게:

* “**단기 + 예산확보 + 권한자 + 상담의향** 리드가 몇 명인가?”
* “권한 없거나 예산 미확보지만 관심 있는 그룹은 어떤 nurture가 맞나?”
* “영역(보안/데이터센터/라우팅/캠퍼스)별로 어떤 메시지를 먼저 쏠까?”

로 정렬됩니다.

---

# H. 마이그레이션/구현 순서(추천)

1. DB migration: guidelines 테이블 + reports 확장
2. GuidelinePack 스키마(Zod) + fingerprint 함수
3. generate guideline API + UI 초안 화면(읽기 전용)
4. UI 편집 + 저장(PATCH)
5. publish API
6. analysis/generate에서 guideline 적용
7. Decision Pack 프롬프트에 guideline 포함(“이번 보고서는 이 지침을 따른다”)
8. 보고서 화면에 guideline 정보 표시(“본 보고서는 Guideline vX 기반”)

---

## 5) 정리: 질문하신 “중간 과정 추가”는 어떤 가치가 있나?

* 문항이 늘거나 바뀌어도, **“디시전카드가 어떤 결정을 지원해야 하는지”가 먼저 고정**
* 역할 분류(특히 예산/권한 같은 BANT)가 **룰/키워드에 덜 의존**
* 사람이 수정 가능하니 “이번 캠페인은 예산보다 권한을 더 보자” 같은 운영 의도를 반영 가능
* 보고서 재현성(어떤 지침으로 생성됐는지)까지 확보

---

원하시면, 위 명세를 기준으로 **GP-1.0 Zod 스키마 초안 코드**, 그리고 **Route Handler 뼈대(Next.js 16)**까지 바로 이어서 작성해드릴게요.

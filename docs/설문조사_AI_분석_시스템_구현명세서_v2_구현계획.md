# 설문조사 AI 분석 시스템 구현명세서 v2 - 전체 구현 계획

**기준 문서**: `docs/설문조사_AI_분석_시스템_구현명세서_v2.md`  
**작성일**: 2026-01-06  
**현재 시스템**: Analysis Pack (ap-1.0) + Decision Pack (dp-1.0) 2단계 파이프라인

---

## 📋 전체 구현 로드맵 개요

### 목표
**Guideline Pack (GP-1.0) 추가로 3단계 파이프라인 구축**
- 기존: Analysis Pack → Decision Pack
- 개선: **Guideline Pack → Analysis Pack → Decision Pack**

### 구현 범위
1. **Backend**: DB 스키마, API 엔드포인트, 서버 로직
2. **Frontend**: UI 컴포넌트, 편집 화면
3. **Integration**: 기존 파이프라인과 통합

---

## 🎯 Phase별 구현 계획

---

## Phase 1: 핵심 기능 확장 (즉시 구현 가능, 빠른 ROI)

**목표**: 예산/권한 문항이 교차표/리드스코어링에 포함되도록

**예상 기간**: 1-2일  
**우선순위**: ⭐⭐⭐⭐⭐ (최우선)

### 1.1 Role Taxonomy 확장

**작업 내용:**
- `lib/surveys/analysis/roleInference.ts` 수정
  - `QuestionRole` 타입에 `budget_status`, `authority_level` 추가
  - `ROLE_KEYWORDS`에 예산/권한 키워드 추가
  - Heuristic 추정 로직 확장

**파일 수정:**
```
lib/surveys/analysis/roleInference.ts
  - QuestionRole 타입 확장
  - ROLE_KEYWORDS에 budget_status, authority_level 키워드 추가
```

**키워드 예시:**
- `budget_status`: ['예산', '확보', '예산이', '예산은', '예산이 있', '예산이 없']
- `authority_level`: ['권한', '담당자', '의사결정', '구매', 'Authorized Buyer', '결정권']

### 1.2 DB 스키마 확장

**작업 내용:**
- `form_questions.analysis_role_override` 체크 제약조건 확장
  - 기존: `('timeframe', 'project_type', 'followup_intent', 'other')`
  - 확장: `('timeframe', 'project_type', 'followup_intent', 'budget_status', 'authority_level', 'other')`

**마이그레이션 파일:**
```sql
-- 048_extend_role_override_check_constraint.sql
ALTER TABLE public.form_questions
  DROP CONSTRAINT IF EXISTS form_questions_analysis_role_override_check;

ALTER TABLE public.form_questions
  ADD CONSTRAINT form_questions_analysis_role_override_check
  CHECK (analysis_role_override IN (
    'timeframe', 
    'project_type', 
    'followup_intent',
    'budget_status',
    'authority_level',
    'other'
  ));
```

### 1.3 교차표/리드스코어링 로직 확장

**작업 내용:**
- `lib/surveys/analysis/buildComputedMetrics.ts` 수정
  - `buildCrosstabs`: budget_status, authority_level 기반 교차표 추가
  - `buildLeadSignals`: budget_status, authority_level 스코어링 추가

**교차표 추가:**
- Budget × Timeline
- Authority × Engagement
- Budget × Authority
- Authority × Timeline

**리드 스코어링 확장:**
- `calculateBudgetScore()` 함수 추가
- `calculateAuthorityScore()` 함수 추가
- 총점 계산에 budget + authority 점수 포함

### 1.4 UI 개선 (선택사항)

**작업 내용:**
- 운영 콘솔의 폼 관리 탭에서 `analysis_role_override` 드롭다운 확장
- 새 역할 옵션 추가

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/FormManagementTab.tsx
  - role 드롭다운 옵션 확장
```

**예상 결과:**
- ✅ 예산/권한 문항이 교차표에 포함
- ✅ 리드 스코어링에 예산/권한 반영
- ✅ "예산+권한 있는 단기 리드" 같은 복합 조건 분석 가능

---

## Phase 2: Guideline Pack 기본 구조 (핵심 인프라)

**목표**: Guideline Pack 생성/저장/조회 기본 기능

**예상 기간**: 3-5일  
**우선순위**: ⭐⭐⭐⭐

### 2.1 DB 마이그레이션

**작업 내용:**
- `survey_analysis_guidelines` 테이블 생성
- `survey_analysis_reports` 테이블 확장

**마이그레이션 파일:**
```sql
-- 049_create_survey_analysis_guidelines.sql
CREATE TABLE IF NOT EXISTS public.survey_analysis_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.event_survey_campaigns(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('draft','published','archived')) DEFAULT 'draft',
  version_int int NOT NULL DEFAULT 1,
  title text,
  description text,
  form_fingerprint text NOT NULL,
  guideline_pack jsonb NOT NULL,
  agency_id uuid,
  client_id uuid,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sag_campaign 
  ON public.survey_analysis_guidelines (campaign_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sag_campaign_published
  ON public.survey_analysis_guidelines (campaign_id)
  WHERE status = 'published';

-- reports 테이블 확장
ALTER TABLE public.survey_analysis_reports
  ADD COLUMN IF NOT EXISTS guideline_id uuid REFERENCES public.survey_analysis_guidelines(id),
  ADD COLUMN IF NOT EXISTS guideline_pack jsonb;
```

### 2.2 Guideline Pack 스키마 (Zod)

**작업 내용:**
- `lib/surveys/analysis/guidelinePackSchema.ts` 생성
- GP-1.0 스키마 정의

**파일 생성:**
```
lib/surveys/analysis/guidelinePackSchema.ts
  - GuidelinePackSchema (Zod)
  - Role 타입 (timeline/need_area/budget_status/authority_level/engagement_intent/other)
  - 모든 중첩 스키마 정의
```

**주요 스키마:**
- `GuidelinePackSchema`
- `QuestionMapSchema`
- `OptionGroupSchema`
- `CrosstabPlanSchema`
- `LeadScoringSchema`

### 2.3 Form Fingerprint 함수

**작업 내용:**
- `lib/surveys/analysis/buildFormFingerprint.ts` 생성
- 폼 구조를 정규화하여 SHA256 해시 생성

**파일 생성:**
```
lib/surveys/analysis/buildFormFingerprint.ts
  - buildFormFingerprint(questions, options) 함수
  - 정규화 로직 (order_no 정렬, options 정렬)
  - SHA256 해시 생성
```

### 2.4 Survey Blueprint 함수

**작업 내용:**
- `lib/surveys/analysis/buildSurveyBlueprint.ts` 생성
- Guideline 생성용 최소 구조 정리

**파일 생성:**
```
lib/surveys/analysis/buildSurveyBlueprint.ts
  - buildSurveyBlueprint(formId, questions) 함수
  - 문항/선택지/타입/순서만 추출
```

### 2.5 Guideline 생성 API (자동 생성)

**작업 내용:**
- `POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/generate` 구현
- LLM 호출하여 Guideline Pack 생성

**파일 생성:**
```
app/api/event-survey/campaigns/[campaignId]/analysis-guidelines/generate/route.ts
  - 권한 확인
  - 폼 조회
  - formFingerprint 생성
  - LLM 호출 (generateGuidelinePack)
  - Zod 검증
  - DB 저장 (draft)
```

**의존성:**
- `lib/surveys/analysis/generateGuidelinePack.ts` (Phase 2.6에서 구현)

### 2.6 Guideline Pack 생성 함수 (LLM)

**작업 내용:**
- `lib/surveys/analysis/generateGuidelinePack.ts` 생성
- Gemini API 호출 (JSON mode)
- 재시도 로직 포함

**파일 생성:**
```
lib/surveys/analysis/generateGuidelinePack.ts
  - generateGuidelinePackWithRetry() 함수
  - System prompt (설문 설계/세일즈 운영 분석가 역할)
  - JSON mode 사용
  - Zod 검증
  - 재시도 로직 (최대 3회)
```

**System Prompt 핵심:**
- 역할 taxonomy 강제
- optionGroups 생성 규칙 (특히 timeline)
- crosstabPlan 최소 2개 이상
- leadScoring component 최소 3개 이상

### 2.7 Guideline Linter

**작업 내용:**
- `lib/surveys/analysis/lintGuidelinePack.ts` 생성
- 품질 검증 규칙 적용

**파일 생성:**
```
lib/surveys/analysis/lintGuidelinePack.ts
  - lintGuidelinePack() 함수
  - 에러 검증 (저장 불가)
  - 경고 검증 (저장 가능, UI 표시)
```

**검증 규칙:**
- 에러: 동일 role이 여러 개 core로 지정, leadScoring.enabled인데 timeline/engagement 없음
- 경고: budget/authority가 other, crosstabPlan 1개 이하

### 2.8 Guideline 조회 API

**작업 내용:**
- `GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines` 구현
- `GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]` 구현

**파일 생성:**
```
app/api/event-survey/campaigns/[campaignId]/analysis-guidelines/route.ts
  - 목록 조회 (draft/published)

app/api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/route.ts
  - 단건 조회
```

**예상 결과:**
- ✅ Guideline Pack 자동 생성 가능
- ✅ DB 저장 및 조회 가능
- ✅ 스키마 검증 및 lint 통과

---

## Phase 3: Guideline 적용 (파이프라인 통합)

**목표**: Guideline Pack을 Analysis Pack 생성에 적용

**예상 기간**: 3-4일  
**우선순위**: ⭐⭐⭐⭐

### 3.1 Guideline 적용 유틸리티

**작업 내용:**
- `lib/surveys/analysis/applyGuidelineToMetrics.ts` 생성
- Guideline의 crosstabPlan, leadScoring 규칙을 메트릭 생성에 적용

**파일 생성:**
```
lib/surveys/analysis/applyGuidelineToMetrics.ts
  - applyCrosstabPlan() 함수
  - applyLeadScoring() 함수
  - optionGroups 정규화 함수
```

### 3.2 buildAnalysisPack 수정

**작업 내용:**
- `lib/surveys/analysis/buildAnalysisPack.ts` 수정
- Guideline이 있으면 적용, 없으면 기존 로직 사용

**파일 수정:**
```
lib/surveys/analysis/buildAnalysisPack.ts
  - buildAnalysisPack() 함수에 guideline 파라미터 추가 (optional)
  - Guideline이 있으면:
    - question.role을 guideline 매핑으로 override
    - crosstabPlan대로 교차표 생성
    - leadScoring대로 리드 스코어 생성
    - optionGroups 기반 그룹 분포를 Evidence에 추가
```

**하위 호환성:**
- Guideline이 없으면 기존 로직 그대로 사용
- 기존 보고서 생성에 영향 없음

### 3.3 generateDecisionPack 수정

**작업 내용:**
- `lib/surveys/analysis/generateDecisionPack.ts` 수정
- Guideline을 프롬프트에 포함

**파일 수정:**
```
lib/surveys/analysis/generateDecisionPack.ts
  - generateDecisionPack() 함수에 guideline 파라미터 추가 (optional)
  - System prompt에 guideline 정보 포함
  - "이번 보고서는 이 지침을 따른다" 명시
```

### 3.4 보고서 생성 API 확장

**작업 내용:**
- `POST /api/event-survey/campaigns/[campaignId]/analysis/generate` 수정
- Guideline 사용 로직 추가

**파일 수정:**
```
app/api/event-survey/campaigns/[campaignId]/analysis/generate/route.ts
  - Request에 guidelineId 파라미터 추가 (optional)
  - Guideline 조회 로직:
    1. guidelineId가 있으면 사용 (draft도 허용)
    2. 없으면 published 조회
    3. published도 없으면 auto-guideline 생성 (런타임)
  - buildAnalysisPack에 guideline 전달
  - generateDecisionPack에 guideline 전달
  - 보고서 저장 시 guideline_id, guideline_pack 스냅샷 저장
```

**예상 결과:**
- ✅ Guideline 기반 분석 파이프라인 동작
- ✅ 보고서에 사용된 지침 추적 가능
- ✅ 기존 보고서 생성도 정상 동작 (하위 호환성)

---

## Phase 4: Guideline 편집 및 Publish (UI 및 고급 기능)

**목표**: 사용자가 Guideline을 편집하고 Publish할 수 있는 UI

**예상 기간**: 5-7일  
**우선순위**: ⭐⭐⭐

### 4.1 Guideline 수정 API

**작업 내용:**
- `PATCH /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]` 구현

**파일 생성:**
```
app/api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/route.ts
  - PATCH 핸들러 추가
  - guideline_pack Zod 검증
  - lintGuidelinePack 실행
  - DB 업데이트
```

### 4.2 Publish API

**작업 내용:**
- `POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/publish` 구현

**파일 생성:**
```
app/api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/publish/route.ts
  - 기존 published를 archived로 변경
  - 해당 guideline을 published로 변경
  - published_at 설정
```

### 4.3 UI 컴포넌트 - 분석 지침 탭

**작업 내용:**
- 운영 콘솔에 "분석 지침" 탭 추가
- 기본 레이아웃 및 상태 표시

**파일 생성:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - 상태 영역 (published/draft 표시)
  - 폼 fingerprint 상태 표시
  - "지침 생성" 버튼
```

**탭 추가:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/SurveyCampaignDetailView.tsx
  - AnalysisGuidelineTab 추가
```

### 4.4 UI 컴포넌트 - 문항 매핑 에디터

**작업 내용:**
- 문항 리스트 테이블
- Role 드롭다운 (timeline/need_area/budget_status/authority_level/engagement_intent/other)
- Importance 드롭다운 (core/supporting)

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - QuestionMappingEditor 컴포넌트
  - 테이블 형태로 문항 표시
  - 인라인 편집 가능
```

### 4.5 UI 컴포넌트 - 옵션 그룹핑

**작업 내용:**
- 선택형 문항의 선택지를 그룹으로 묶는 UI
- 드래그 앤 드롭 또는 체크박스 방식

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - OptionGroupingEditor 컴포넌트
  - 타임라인 문항: 단기/중기/장기/계획없음 그룹핑
```

### 4.6 UI 컴포넌트 - 리드 스코어링 설정

**작업 내용:**
- Enabled 토글
- Tier thresholds 입력 (P0/P1/P2/P3)
- Component weight 조정 (role별 가중치)

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - LeadScoringEditor 컴포넌트
  - 슬라이더 또는 숫자 입력으로 가중치 조정
```

### 4.7 UI 컴포넌트 - 교차표 계획 설정

**작업 내용:**
- Row/Col Role 선택
- MinCellN 설정
- "기본 추천 템플릿" 버튼

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - CrosstabPlanEditor 컴포넌트
  - 템플릿 버튼: timeline×engagement, authority×engagement 등
```

### 4.8 UI 컴포넌트 - 디시전카드 질문 선택

**작업 내용:**
- 체크리스트 형태로 후보 제공
- 우선순위 조정

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - DecisionQuestionsEditor 컴포넌트
  - 체크박스 + 드래그 앤 드롭으로 우선순위 조정
```

### 4.9 액션 버튼 및 저장

**작업 내용:**
- "저장" 버튼 (draft)
- "Publish" 버튼
- "이 지침으로 보고서 생성" 버튼

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - 저장/Publish 핸들러
  - 보고서 생성 버튼 (guidelineId 전달)
```

**예상 결과:**
- ✅ 사용자가 Guideline을 편집하고 Publish 가능
- ✅ 완전한 지침 관리 시스템 구축

---

## Phase 5: 폴리싱 및 최적화 (선택사항)

**목표**: 사용자 경험 개선 및 성능 최적화

**예상 기간**: 2-3일  
**우선순위**: ⭐⭐

### 5.1 폼 변경 감지 UI

**작업 내용:**
- Stale guideline 감지 및 알림
- "지침 재생성" 버튼

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisGuidelineTab.tsx
  - formFingerprint 비교 로직
  - Stale 뱃지 표시
```

### 5.2 보고서 화면에 Guideline 정보 표시

**작업 내용:**
- 보고서 상단에 "본 보고서는 Guideline vX 기반" 표시
- Guideline 링크 (클릭 시 지침 확인)

**파일 수정:**
```
app/(client)/client/[clientId]/surveys/[campaignId]/components/tabs/AnalysisReportSection.tsx
  - Guideline 정보 표시
```

### 5.3 성능 최적화

**작업 내용:**
- Guideline Pack 생성 시 LLM 호출 최적화
- 폼 fingerprint 계산 캐싱
- 인덱스 최적화 확인

### 5.4 에러 처리 강화

**작업 내용:**
- Guideline 생성 실패 시 폴백 (기존 role 추정 사용)
- Stale guideline 자동 재생성 옵션

---

## 📊 전체 구현 일정 요약

| Phase | 작업 내용 | 예상 기간 | 우선순위 | 의존성 |
|-------|----------|----------|---------|--------|
| **Phase 1** | Role 확장 + 교차표/리드스코어링 확장 | 1-2일 | ⭐⭐⭐⭐⭐ | 없음 |
| **Phase 2** | Guideline Pack 기본 구조 (DB, 스키마, 생성 API) | 3-5일 | ⭐⭐⭐⭐ | Phase 1 |
| **Phase 3** | Guideline 적용 (파이프라인 통합) | 3-4일 | ⭐⭐⭐⭐ | Phase 2 |
| **Phase 4** | UI 편집 및 Publish | 5-7일 | ⭐⭐⭐ | Phase 3 |
| **Phase 5** | 폴리싱 및 최적화 | 2-3일 | ⭐⭐ | Phase 4 |

**총 예상 기간**: 14-21일 (약 3-4주)

---

## 🎯 구현 전략 권장사항

### 즉시 시작 가능 (Phase 1)
- **가치**: 예산/권한 문항이 교차표/리드스코어링에 포함
- **복잡도**: 낮음 (기존 코드 수정만)
- **리스크**: 낮음 (하위 호환성 유지)

### 단계적 확장 (Phase 2-4)
- **가치**: 완전한 지침 관리 시스템
- **복잡도**: 중간-높음 (새로운 인프라 구축)
- **리스크**: 중간 (단계별 검증 필요)

### 선택적 개선 (Phase 5)
- **가치**: 사용자 경험 개선
- **복잡도**: 낮음 (UI 개선 중심)
- **리스크**: 낮음

---

## ✅ 각 Phase 완료 기준 (Definition of Done)

### Phase 1 완료 기준
- [ ] `budget_status`, `authority_level` 역할이 교차표에 포함됨
- [ ] 리드 스코어링에 예산/권한 점수가 반영됨
- [ ] 기존 보고서 생성에 영향 없음 (하위 호환성)
- [ ] 테스트: 예산/권한 문항이 있는 설문에서 교차표/리드스코어 생성 확인

### Phase 2 완료 기준
- [ ] Guideline Pack 자동 생성 API 동작
- [ ] DB 저장 및 조회 정상
- [ ] Zod 스키마 검증 통과
- [ ] Lint 검증 통과
- [ ] 테스트: Guideline 생성 → 저장 → 조회 플로우 확인

### Phase 3 완료 기준
- [ ] Guideline 기반 Analysis Pack 생성 동작
- [ ] Guideline 기반 Decision Pack 생성 동작
- [ ] 보고서에 guideline_id, guideline_pack 저장됨
- [ ] Guideline 없을 때 기존 로직 정상 동작 (하위 호환성)
- [ ] 테스트: Guideline 적용 전/후 보고서 비교

### Phase 4 완료 기준
- [ ] UI에서 Guideline 편집 가능
- [ ] Publish 기능 동작
- [ ] "이 지침으로 보고서 생성" 버튼 동작
- [ ] 모든 편집 기능이 저장됨
- [ ] 테스트: 전체 UI 플로우 확인

### Phase 5 완료 기준
- [ ] 폼 변경 감지 UI 동작
- [ ] 보고서에 Guideline 정보 표시
- [ ] 성능 최적화 적용
- [ ] 에러 처리 강화

---

## 🔄 구현 순서 권장사항

### 옵션 A: 빠른 가치 제공 (권장)
1. **Phase 1 먼저** (1-2일) → 즉시 가치 제공
2. **Phase 2-3** (6-9일) → Guideline 기반 파이프라인 구축
3. **Phase 4** (5-7일) → UI 완성
4. **Phase 5** (2-3일) → 폴리싱

**총 기간**: 약 3-4주

### 옵션 B: 점진적 확장
1. **Phase 1** 완료 후 사용자 피드백 수집
2. 피드백 반영하여 Phase 2-3 진행
3. UI는 필수 기능만 먼저 (Phase 4 일부)
4. 나머지 기능은 점진적 추가

**장점**: 각 단계마다 검증 및 피드백 수집 가능

---

## 📝 구현 시 주의사항

### 1. 하위 호환성 유지
- 기존 보고서 생성 로직은 그대로 유지
- Guideline이 없을 때 기존 동작 보장

### 2. 에러 처리
- Guideline 생성 실패 시 폴백 (기존 role 추정 사용)
- LLM 호출 실패 시 재시도 + 폴백

### 3. 성능 고려
- Guideline Pack 생성 시 LLM 호출 시간/비용 추적
- 폼 fingerprint 계산 최적화
- 대량 캠페인에서의 인덱스 확인

### 4. 테스트 전략
- 각 Phase마다 단위 테스트 작성
- 통합 테스트 (Guideline 생성 → 적용 → 보고서 생성)
- 하위 호환성 테스트 (Guideline 없을 때)

---

## 🚀 시작하기

**즉시 시작 가능한 작업:**
1. Phase 1.1: Role Taxonomy 확장 (`roleInference.ts` 수정)
2. Phase 1.2: DB 스키마 확장 (마이그레이션 생성)
3. Phase 1.3: 교차표/리드스코어링 로직 확장

**다음 단계:**
- Phase 1 완료 후 Phase 2로 진행
- 또는 사용자 피드백 수집 후 다음 단계 결정

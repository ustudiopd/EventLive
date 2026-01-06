-- 마이그레이션: form_questions의 analysis_role_override 체크 제약조건 확장
-- Phase 1: Role Taxonomy 확장 (budget_status, authority_level 추가)

begin;

-- 기존 제약조건 제거
ALTER TABLE public.form_questions
  DROP CONSTRAINT IF EXISTS form_questions_analysis_role_override_check;

-- 확장된 제약조건 추가
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

comment on constraint form_questions_analysis_role_override_check on public.form_questions is
  '설문조사 AI 분석을 위한 문항 역할 수동 지정. BANT(Budget, Authority, Need, Timeline) 완전 커버.';

commit;

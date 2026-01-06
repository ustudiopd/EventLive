-- 마이그레이션: form_questions에 analysis_role_override 컬럼 추가
-- 설문조사 AI 분석 시스템 구현 명세서 v1.0에 따른 개선사항

begin;

-- form_questions 테이블에 analysis_role_override 컬럼 추가
alter table public.form_questions
  add column if not exists analysis_role_override text null
  check (analysis_role_override in ('timeframe', 'project_type', 'followup_intent', 'other'));

-- 인덱스 추가 (role 기반 쿼리 최적화)
create index if not exists idx_form_questions_role_override
  on public.form_questions(analysis_role_override)
  where analysis_role_override is not null;

comment on column public.form_questions.analysis_role_override is 
  '설문조사 AI 분석을 위한 문항 역할 수동 지정. null이면 자동 추정(heuristic) 사용.';

commit;

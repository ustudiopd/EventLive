begin;

-- survey_analysis_reports 테이블에 고도화 파이프라인 컬럼 추가
alter table public.survey_analysis_reports
  add column if not exists analysis_pack jsonb,
  add column if not exists decision_pack jsonb;

-- JSONB 인덱스 추가 (쿼리 최적화)
create index if not exists idx_survey_analysis_reports_analysis_pack 
  on public.survey_analysis_reports using gin(analysis_pack)
  where analysis_pack is not null;

create index if not exists idx_survey_analysis_reports_decision_pack 
  on public.survey_analysis_reports using gin(decision_pack)
  where decision_pack is not null;

commit;


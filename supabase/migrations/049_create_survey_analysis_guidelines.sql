-- 마이그레이션: survey_analysis_guidelines 테이블 생성
-- Phase 2: Guideline Pack 기본 구조

begin;

-- Guideline 테이블 생성
create table if not exists public.survey_analysis_guidelines (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.event_survey_campaigns(id) on delete cascade,
  form_id uuid not null references public.forms(id) on delete cascade,

  status text not null check (status in ('draft','published','archived')) default 'draft',
  version_int int not null default 1,

  title text,
  description text,

  form_fingerprint text not null,
  form_revision int not null default 1,
  guideline_pack jsonb not null,
  guideline_pack_compiled jsonb,    -- 실행용으로 정규화된 컴파일 결과

  agency_id uuid,
  client_id uuid,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- 인덱스
create index if not exists idx_sag_campaign on public.survey_analysis_guidelines (campaign_id, status);
create unique index if not exists uq_sag_campaign_published
  on public.survey_analysis_guidelines (campaign_id)
  where status = 'published';

comment on table public.survey_analysis_guidelines is
  '설문조사 AI 분석 지침(Guideline Pack). 폼 변경 감지 및 재현 가능한 분석을 위한 메타데이터.';

comment on column public.survey_analysis_guidelines.form_fingerprint is
  '폼 구조의 SHA256 해시. 폼 변경 시 stale 감지용.';

comment on column public.survey_analysis_guidelines.guideline_pack is
  'GP-1.0 스키마 준수 JSONB. 문항 역할 매핑, 옵션 그룹핑, 교차표 계획, 리드 스코어링 규칙 포함.';

-- survey_analysis_reports 테이블에 guideline 관련 컬럼 추가
alter table public.survey_analysis_reports
  add column if not exists guideline_id uuid references public.survey_analysis_guidelines(id),
  add column if not exists guideline_pack jsonb;

comment on column public.survey_analysis_reports.guideline_id is
  '보고서 생성에 사용된 Guideline ID. 재현성 추적용.';

comment on column public.survey_analysis_reports.guideline_pack is
  '보고서 생성 시점의 Guideline Pack 스냅샷. Guideline이 변경되어도 보고서 재현 가능.';

commit;

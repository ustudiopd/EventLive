-- 마이그레이션: Registry 테이블 생성
-- 명세서 기반: 하드코딩 제거를 위한 Role/Option/Card Template Registry

begin;

-- 1. Role Registry
create table if not exists public.survey_engine_roles (
  role_key text primary key,
  label_ko text not null,
  label_en text,
  allowed_question_types jsonb not null default '["single","multiple","text"]'::jsonb,
  pattern_rules jsonb, -- 키워드/정규식/옵션패턴
  default_is_key_driver boolean not null default false,
  default_scoring_hint jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.survey_engine_roles is
  '설문조사 문항 역할(Role) Registry. 하드코딩 제거를 위한 외부화.';

comment on column public.survey_engine_roles.pattern_rules is
  '역할 자동 추정 규칙: { "keywords": [...], "regex": [...], "optionPatterns": [...] }';

-- 2. Option Grouping Template Registry
create table if not exists public.survey_engine_option_templates (
  template_key text primary key,
  label_ko text not null,
  label_en text,
  detection_rules jsonb not null, -- "선택지에 '개월/년/주' 포함하면 time_buckets"
  canonical_groups jsonb not null, -- 그룹 정의(정렬/라벨/점수 기본값)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.survey_engine_option_templates is
  '선택지 그룹핑 템플릿 Registry. 자동 Option Grouping을 위한 템플릿.';

comment on column public.survey_engine_option_templates.detection_rules is
  '템플릿 자동 감지 규칙: { "keywords": [...], "optionCount": {...}, "patterns": [...] }';

comment on column public.survey_engine_option_templates.canonical_groups is
  '표준 그룹 정의: [{ "groupKey": "...", "label": "...", "score": ... }]';

-- 3. Decision Card Template Registry
create table if not exists public.survey_engine_card_templates (
  template_id text primary key,
  title text not null,
  description text,
  required_roles jsonb, -- 활성화에 필요한 role 목록
  required_evidence_types jsonb, -- 활성화에 필요한 evidence 타입
  prompt_snippet text, -- LLM에게 카드 생성 규칙
  output_constraints jsonb, -- "A/B/C 옵션", "evidenceIds 최소 2개" 등
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.survey_engine_card_templates is
  'Decision Card 템플릿 Registry. 카드 생성 품질 게이트를 위한 템플릿.';

comment on column public.survey_engine_card_templates.required_roles is
  '활성화에 필요한 role 목록: ["timeline", "intent_followup"]';

comment on column public.survey_engine_card_templates.required_evidence_types is
  '활성화에 필요한 evidence 타입: ["crosstab", "lead_signal"]';

comment on column public.survey_engine_card_templates.output_constraints is
  '출력 제약: { "minEvidenceCount": 2, "forbidAllHypothesis": true }';

-- 인덱스
create index if not exists idx_ser_key_driver
  on public.survey_engine_roles (default_is_key_driver)
  where default_is_key_driver = true;

commit;

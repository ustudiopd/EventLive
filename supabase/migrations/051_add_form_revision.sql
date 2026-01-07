-- 마이그레이션: form_revision 추가
-- 명세서 기반: 문항 변경 추적을 위한 revision 필드

begin;

-- form_questions에 revision 추가
alter table public.form_questions
  add column if not exists revision int not null default 1;

-- survey_analysis_guidelines에 form_revision 추가
alter table public.survey_analysis_guidelines
  add column if not exists form_revision int not null default 1;

-- form_submissions에 form_revision 추가 (명세서 제안)
alter table public.form_submissions
  add column if not exists form_revision int not null default 1;

-- form_answers에 snapshot 필드 추가 (명세서 제안)
alter table public.form_answers
  add column if not exists question_body_snapshot text,
  add column if not exists options_snapshot jsonb,
  add column if not exists question_logical_key_snapshot text,
  add column if not exists question_role_snapshot text;

-- 인덱스 추가
create index if not exists idx_form_questions_revision
  on public.form_questions (form_id, revision);

create index if not exists idx_sag_form_revision
  on public.survey_analysis_guidelines (form_id, form_revision);

comment on column public.form_questions.revision is
  '문항의 버전 번호. 문항이 수정될 때마다 증가.';

comment on column public.survey_analysis_guidelines.form_revision is
  'Guideline이 생성된 시점의 폼 revision. 폼 변경 추적용.';

comment on column public.form_submissions.form_revision is
  '제출 시점의 폼 revision. 재현성 보장용.';

comment on column public.form_answers.question_body_snapshot is
  '제출 시점의 문항 본문 스냅샷. 문항 변경 후에도 분석 재현 가능.';

comment on column public.form_answers.options_snapshot is
  '제출 시점의 선택지 스냅샷. 선택지 변경 후에도 분석 재현 가능.';

comment on column public.form_answers.question_logical_key_snapshot is
  '제출 시점의 logical_key 스냅샷.';

comment on column public.form_answers.question_role_snapshot is
  '제출 시점의 role 스냅샷.';

commit;

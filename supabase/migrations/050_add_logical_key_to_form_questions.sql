-- 마이그레이션: form_questions에 logical_key 컬럼 추가
-- 명세서 기반: 문항 유동성 대응을 위한 안정 키

begin;

-- logical_key 컬럼 추가
alter table public.form_questions
  add column if not exists logical_key text;

-- 인덱스 추가 (빠른 조회용)
create index if not exists idx_form_questions_logical_key
  on public.form_questions (logical_key)
  where logical_key is not null;

comment on column public.form_questions.logical_key is
  '문항의 안정 키. 문항 ID가 변경되어도 같은 문항으로 인식하는 데 사용. Guideline Pack의 logicalKey와 매칭됨.';

commit;

begin;

-- registrations 테이블에 nickname 필드 추가
-- 웨비나별로 사용자가 설정한 닉네임을 저장
alter table public.registrations
  add column if not exists nickname text;

-- 인덱스는 필요시 추가 (현재는 기본 키만으로 충분)

commit;


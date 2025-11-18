begin;

-- client_members 테이블의 role 체크 제약 조건에 'member' 추가
-- 기존 제약 조건 삭제
alter table public.client_members
  drop constraint if exists client_members_role_check;

-- 새로운 제약 조건 생성 ('member' 포함)
alter table public.client_members
  add constraint client_members_role_check
  check (role in ('owner', 'admin', 'operator', 'analyst', 'member'));

commit;


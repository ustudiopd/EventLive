begin;

-- profiles 테이블에 nickname 필드 추가
-- 채팅에 사용할 기본 닉네임 저장
alter table public.profiles
  add column if not exists nickname text;

commit;


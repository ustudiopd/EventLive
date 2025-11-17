-- Profiles 테이블 RLS 정책 설정
-- 슈퍼어드민이 모든 프로필을 관리할 수 있도록 설정

-- RLS 활성화 (이미 활성화되어 있을 수 있음)
alter table public.profiles enable row level security;

-- 기존 정책 삭제 (있다면)
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "superadmin all profiles" on public.profiles;

-- 1. 자신의 프로필 읽기
create policy "read own profile" on public.profiles
  for select
  using (id = auth.uid());

-- 2. 자신의 프로필 업데이트
-- 주의: is_super_admin 변경은 RLS로 제한할 수 없으므로, 
-- 서버 전용 API(/api/admin/set-super-admin)를 통해서만 가능하도록 해야 함
create policy "update own profile" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3. 슈퍼어드민: 모든 프로필 읽기/수정 가능 (is_super_admin 포함)
-- 주의: is_super_admin 변경은 서버 전용 API를 통해서만 가능하도록 제한
create policy "superadmin all profiles" on public.profiles
  for all
  using ((select is_super_admin from public.me) is true)
  with check ((select is_super_admin from public.me) is true);

-- 참고: is_super_admin 변경은 보안상 서버 전용 API(Admin Supabase)를 통해서만 가능
-- 슈퍼어드민도 클라이언트에서 직접 is_super_admin을 변경할 수 없도록 제한


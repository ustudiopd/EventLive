-- RLS 무한 재귀 문제 해결
-- Supabase에서는 security definer 함수도 RLS가 적용되므로,
-- 슈퍼어드민 권한 확인은 서버 측에서만 수행하도록 변경

-- 1. 기존 RLS 정책 삭제
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "superadmin all profiles" on public.profiles;

-- 2. 새로운 RLS 정책 생성 (순환 참조 없음)
-- 2-1. 자신의 프로필 읽기
create policy "read own profile" on public.profiles
  for select
  using (id = auth.uid());

-- 2-2. 자신의 프로필 업데이트
-- 주의: is_super_admin 변경은 RLS로 제한할 수 없으므로, 
-- 서버 전용 API(/api/admin/set-super-admin)를 통해서만 가능하도록 해야 함
create policy "update own profile" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2-3. 슈퍼어드민 정책 제거
-- 슈퍼어드민은 서버 측에서만 확인하도록 변경
-- 클라이언트에서는 자신의 프로필만 조회 가능

-- 참고: 
-- - is_super_admin 변경은 보안상 서버 전용 API(Admin Supabase)를 통해서만 가능
-- - 슈퍼어드민 권한 확인은 서버 측 미들웨어/API에서만 수행
-- - 클라이언트에서는 자신의 프로필만 조회 가능


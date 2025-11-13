# 마이그레이션 실행 안내

## client_invitations 테이블 생성

클라이언트 초대 기능을 사용하기 위해 `client_invitations` 테이블을 생성해야 합니다.

### 실행 방법

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 ID: `yqsayphssjznthrxpgfb`

2. **SQL Editor로 이동**
   - 좌측 메뉴에서 "SQL Editor" 클릭

3. **아래 SQL 실행**

```sql
-- Client Invitations Table
-- 클라이언트 초대 토큰 관리

create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  token text unique not null,
  email text,
  used boolean default false,
  used_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_client_invitations_token on public.client_invitations(token);
create index if not exists idx_client_invitations_agency on public.client_invitations(agency_id);
create index if not exists idx_client_invitations_used on public.client_invitations(used);

-- RLS 정책
alter table public.client_invitations enable row level security;

-- 기존 정책 삭제 (있다면)
drop policy if exists "read client invitations" on public.client_invitations;
drop policy if exists "manage client invitations" on public.client_invitations;

-- 읽기: 에이전시 멤버만
create policy "read client invitations" on public.client_invitations for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = client_invitations.agency_id)
  );

-- 생성/수정/삭제: 에이전시 owner/admin만
create policy "manage client invitations" on public.client_invitations for all
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a
               where a.agency_id = client_invitations.agency_id and a.role in ('owner','admin'))
  )
  with check (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a
               where a.agency_id = client_invitations.agency_id and a.role in ('owner','admin'))
  );
```

4. **실행 확인**
   - "Run" 버튼 클릭
   - 성공 메시지 확인

### 파일 위치

마이그레이션 SQL 파일: `supabase/migrations/011_create_client_invitations.sql`


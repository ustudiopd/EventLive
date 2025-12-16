begin;

-- 웨비나 허용 이메일 테이블 (email_auth 정책용)
create table public.webinar_allowed_emails (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  email text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 인덱스
create index idx_webinar_allowed_emails_webinar_id on public.webinar_allowed_emails(webinar_id);
create index idx_webinar_allowed_emails_email on public.webinar_allowed_emails(email);
create unique index uniq_webinar_allowed_email on public.webinar_allowed_emails(webinar_id, lower(email));

-- webinars 테이블의 access_policy 체크 제약 조건 업데이트
-- 기존 제약 조건 제거 후 재생성
alter table public.webinars 
  drop constraint if exists webinars_access_policy_check;

alter table public.webinars 
  add constraint webinars_access_policy_check 
  check (access_policy in ('auth', 'guest_allowed', 'invite_only', 'email_auth'));

-- RLS 활성화
alter table public.webinar_allowed_emails enable row level security;

-- RLS 정책: 웨비나 소유자(에이전시/클라이언트 멤버)만 읽기/쓰기 가능
create policy "webinar owners can manage allowed emails" on public.webinar_allowed_emails
  for all
  using (
    (select is_super_admin from public.me) is true
    or exists (
      select 1 from public.webinars w
      where w.id = webinar_allowed_emails.webinar_id
      and (
        exists (select 1 from public.my_agencies a where a.agency_id = w.agency_id)
        or exists (select 1 from public.my_clients c where c.client_id = w.client_id)
      )
    )
  );

-- 공개 읽기: 등록된 이메일인지 확인용 (소문자로 비교)
create policy "anyone can check if email is allowed" on public.webinar_allowed_emails
  for select
  using (true);

commit;






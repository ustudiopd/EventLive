-- 이벤트라이브 통계 기능 v2 마이그레이션
-- 목적: 실시간 웨비나 경험을 방해하지 않는 수준으로 통계 수집 인프라 구축

-- ============================================================================
-- 1. 테이블 생성
-- ============================================================================

-- 기존 테이블 삭제 (데이터 없음 확인됨)
drop table if exists public.webinar_access_logs cascade;
drop table if exists public.webinar_live_presence cascade;
drop table if exists public.webinar_downloads cascade;

-- 1.1 webinar_live_presence (가벼운 heartbeat)
create table public.webinar_live_presence (
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- org fields (프로젝트 표준)
  agency_id uuid,
  client_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (webinar_id, user_id)
);

-- 1.2 webinar_access_logs (5분 버킷 누적)
create table public.webinar_access_logs (
  id uuid primary key default gen_random_uuid(),

  webinar_id uuid not null references public.webinars(id) on delete cascade,

  -- 5분 버킷 시작 시각(UTC 권장)
  time_bucket timestamptz not null,

  -- 버킷 내 샘플 누적 (크론이 1분마다 찍으면 sample_count는 최대 5)
  sample_count int not null default 0,
  sum_participants int not null default 0,
  min_participants int not null default 0,
  max_participants int not null default 0,
  last_participants int not null default 0,

  first_sample_at timestamptz not null default now(),
  last_sample_at timestamptz not null default now(),

  -- org fields (표준)
  agency_id uuid,
  client_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.3 webinar_downloads (다운로드 로그)
create table public.webinar_downloads (
  id uuid primary key default gen_random_uuid(),

  webinar_id uuid not null references public.webinars(id) on delete cascade,
  file_id bigint not null references public.webinar_files(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,

  downloaded_at timestamptz not null default now(),

  -- org fields
  agency_id uuid,
  client_id uuid,

  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. 인덱스 생성
-- ============================================================================

-- webinar_live_presence 인덱스
create index if not exists idx_wlp_webinar_last_seen
  on public.webinar_live_presence (webinar_id, last_seen_at desc);
create index if not exists idx_wlp_last_seen
  on public.webinar_live_presence (last_seen_at desc);

-- webinar_access_logs 인덱스
create unique index if not exists uq_wal_webinar_bucket
  on public.webinar_access_logs (webinar_id, time_bucket);
create index if not exists idx_wal_webinar_bucket_desc
  on public.webinar_access_logs (webinar_id, time_bucket desc);

-- webinar_downloads 인덱스
create index if not exists idx_wd_webinar_downloaded
  on public.webinar_downloads (webinar_id, downloaded_at desc);
create index if not exists idx_wd_file_downloaded
  on public.webinar_downloads (file_id, downloaded_at desc);
create index if not exists idx_wd_user_downloaded
  on public.webinar_downloads (user_id, downloaded_at desc);

-- ============================================================================
-- 3. 함수 생성
-- ============================================================================

-- 3.1 bucket_time: 버킷 계산 유틸 함수
create or replace function public.bucket_time(_ts timestamptz, _bucket_seconds int)
returns timestamptz
language sql
immutable
as $$
  select to_timestamp(floor(extract(epoch from _ts) / _bucket_seconds) * _bucket_seconds);
$$;

-- 3.2 get_active_webinar_participant_counts: 활성 웨비나별 접속자 수 집계
create or replace function public.get_active_webinar_participant_counts(_active_since timestamptz)
returns table (webinar_id uuid, participant_count int)
language sql
security definer
as $$
  select webinar_id, count(*)::int as participant_count
  from public.webinar_live_presence
  where last_seen_at >= _active_since
  group by webinar_id;
$$;

-- 3.3 record_webinar_access_snapshot_batch: 5분 버킷 누적 기록(배치)
create or replace function public.record_webinar_access_snapshot_batch(
  _snapshots jsonb,
  _sampled_at timestamptz default now()
)
returns int
language plpgsql
security definer
as $$
declare
  bucket timestamptz;
  affected int;
begin
  bucket := public.bucket_time(_sampled_at, 300);

  with rows as (
    select
      (s->>'webinar_id')::uuid as webinar_id,
      (s->>'participant_count')::int as participant_count
    from jsonb_array_elements(_snapshots) as s
  ),
  ins as (
    insert into public.webinar_access_logs (
      webinar_id,
      time_bucket,
      sample_count,
      sum_participants,
      min_participants,
      max_participants,
      last_participants,
      first_sample_at,
      last_sample_at
    )
    select
      webinar_id,
      bucket,
      1,
      participant_count,
      participant_count,
      participant_count,
      participant_count,
      _sampled_at,
      _sampled_at
    from rows
    on conflict (webinar_id, time_bucket) do update
      set sample_count     = public.webinar_access_logs.sample_count + 1,
          sum_participants = public.webinar_access_logs.sum_participants + excluded.sum_participants,
          min_participants = least(public.webinar_access_logs.min_participants, excluded.last_participants),
          max_participants = greatest(public.webinar_access_logs.max_participants, excluded.last_participants),
          last_participants = excluded.last_participants,
          last_sample_at    = excluded.last_sample_at,
          updated_at        = now()
    returning 1
  )
  select count(*) into affected from ins;

  return affected;
end;
$$;

-- 3.4 webinar_presence_ping: Presence ping RPC 함수 (60초 이내 중복 업데이트 억제)
create or replace function public.webinar_presence_ping(_webinar_id uuid)
returns void
language sql
security invoker
as $$
  insert into public.webinar_live_presence (webinar_id, user_id, joined_at, last_seen_at)
  values (_webinar_id, auth.uid(), now(), now())
  on conflict (webinar_id, user_id) do update
    set last_seen_at = excluded.last_seen_at,
        updated_at = now()
    where public.webinar_live_presence.last_seen_at < excluded.last_seen_at - interval '60 seconds';
$$;

-- ============================================================================
-- 4. RLS 정책 설정
-- ============================================================================

-- 4.1 webinar_live_presence RLS
alter table public.webinar_live_presence enable row level security;

-- 본인 upsert 허용(등록자)
create policy "wlp_upsert_self_if_registered"
on public.webinar_live_presence
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.registrations r
    where r.webinar_id = webinar_live_presence.webinar_id
      and r.user_id = auth.uid()
  )
);

create policy "wlp_update_self_if_registered"
on public.webinar_live_presence
for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.registrations r
    where r.webinar_id = webinar_live_presence.webinar_id
      and r.user_id = auth.uid()
  )
);

-- 관리자 조회는 서버 Route Handler에서 Admin Supabase를 사용하므로 클라이언트 직접 조회는 금지
-- (SELECT 정책은 명시적으로 생성하지 않음 - 서버 전용)

-- 4.2 webinar_access_logs RLS (서버 전용, 클라이언트 직접 조회 금지)
alter table public.webinar_access_logs enable row level security;

-- 4.3 webinar_downloads RLS
alter table public.webinar_downloads enable row level security;

-- 본인 다운로드 기록 조회 허용
create policy "wd_select_own"
on public.webinar_downloads
for select
using (user_id = auth.uid());

-- 다운로드 기록 생성 (서버 API에서만, 인증된 사용자)
create policy "wd_insert_authenticated"
on public.webinar_downloads
for insert
with check (auth.uid() is not null);

-- ============================================================================
-- 5. 추가 성능 인덱스 (통계 조회 최적화)
-- ============================================================================

-- messages 통계용 인덱스
create index if not exists idx_messages_webinar_created_visible
on public.messages (webinar_id, created_at)
where hidden = false;

create index if not exists idx_messages_webinar_user_visible
on public.messages (webinar_id, user_id)
where hidden = false;

-- questions 통계용 인덱스
create index if not exists idx_questions_webinar_created_visible
on public.questions (webinar_id, created_at)
where status != 'hidden';

create index if not exists idx_questions_webinar_answered
on public.questions (webinar_id, answered_at)
where answered_at is not null;

-- registrations 통계용 인덱스
create index if not exists idx_registrations_webinar_user
on public.registrations (webinar_id, user_id);

-- form_submissions 통계용 인덱스
create index if not exists idx_form_submissions_form_submitted
on public.form_submissions (form_id, submitted_at);

-- giveaway_entries 통계용 인덱스
create index if not exists idx_giveaway_entries_giveaway_created
on public.giveaway_entries (giveaway_id, created_at);





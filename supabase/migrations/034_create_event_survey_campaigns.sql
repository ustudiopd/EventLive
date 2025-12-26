begin;

-- 현장 설문/경품(캡슐뽑기) 모듈: 캠페인 테이블
create table public.event_survey_campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid,
  client_id uuid not null,
  title text not null,
  host text, -- 도메인 식별용 (또는 domain_id FK로 확장 가능)
  public_path text not null, -- 예: /2025/triz/triz_1211_booth
  status text not null default 'draft' check (status in ('draft','published','closed')),
  form_id uuid references public.forms(id) on delete set null,
  welcome_schema jsonb, -- 웰컴/시작 페이지 템플릿 데이터
  completion_schema jsonb, -- 완료 페이지 템플릿 데이터
  display_schema jsonb, -- 디스플레이 페이지 템플릿 데이터
  next_survey_no int not null default 1, -- 완료번호 발급용
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 유니크 제약: client_id + public_path 조합은 유일해야 함
create unique index uniq_campaign_public_path 
  on public.event_survey_campaigns(client_id, public_path);

-- 인덱스
create index idx_campaigns_client_id on public.event_survey_campaigns(client_id);
create index idx_campaigns_status on public.event_survey_campaigns(status);
create index idx_campaigns_public_path on public.event_survey_campaigns(public_path);
create index idx_campaigns_form_id on public.event_survey_campaigns(form_id);

-- 트리거: agency_id, client_id 자동 채움 (client_id로부터 agency_id 조회)
create or replace function public.fill_campaign_org_fields() returns trigger as $$
declare
  agency_id_val uuid;
begin
  -- client_id로부터 agency_id 조회
  if new.client_id is not null then
    select agency_id into agency_id_val
    from public.clients
    where id = new.client_id;
    
    if agency_id_val is not null and new.agency_id is null then
      new.agency_id := agency_id_val;
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger tg_fill_campaign_org_fields
  before insert on public.event_survey_campaigns
  for each row execute function public.fill_campaign_org_fields();

-- 참여자(전화번호 1회 참여) + 완료번호 + 스캔 기록 + 경품 기록
create table public.event_survey_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.event_survey_campaigns(id) on delete cascade,
  agency_id uuid,
  client_id uuid not null,
  name text,
  company text,
  phone_norm text not null, -- 숫자만 (정규화된 전화번호)
  survey_no int not null, -- 완료 순번(1부터)
  code6 text not null, -- 예: LPAD(survey_no::text,6,'0')
  completed_at timestamptz not null default now(),
  verified_at timestamptz, -- 스탭 스캔 기록("받았을 확률 높음" 판단)
  verified_by uuid references public.profiles(id),
  prize_label text, -- 사후 입력("우산", "방향제" 등)
  prize_recorded_at timestamptz,
  prize_recorded_by uuid references public.profiles(id),
  form_submission_id uuid references public.form_submissions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 제약: 중복 참여 방지 (캠페인별 전화번호 유니크)
create unique index uniq_entry_campaign_phone 
  on public.event_survey_entries(campaign_id, phone_norm);

-- 제약: 캠페인별 완료번호 유니크
create unique index uniq_entry_campaign_survey_no 
  on public.event_survey_entries(campaign_id, survey_no);

-- 제약: 캠페인별 code6 유니크
create unique index uniq_entry_campaign_code6 
  on public.event_survey_entries(campaign_id, code6);

-- 인덱스
create index idx_entries_campaign_id on public.event_survey_entries(campaign_id);
create index idx_entries_completed_at on public.event_survey_entries(campaign_id, completed_at);
create index idx_entries_verified_at on public.event_survey_entries(campaign_id, verified_at);
create index idx_entries_client_id on public.event_survey_entries(client_id);
create index idx_entries_phone_norm on public.event_survey_entries(phone_norm);

-- 트리거: agency_id, client_id 자동 채움 (campaign_id로부터)
create or replace function public.fill_entry_org_fields() returns trigger as $$
declare
  agency_id_val uuid;
  client_id_val uuid;
begin
  if new.campaign_id is not null then
    select agency_id, client_id into agency_id_val, client_id_val
    from public.event_survey_campaigns
    where id = new.campaign_id;
    
    if agency_id_val is not null and new.agency_id is null then
      new.agency_id := agency_id_val;
    end if;
    
    if client_id_val is not null and new.client_id is null then
      new.client_id := client_id_val;
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger tg_fill_entry_org_fields
  before insert on public.event_survey_entries
  for each row execute function public.fill_entry_org_fields();

-- RLS 활성화
alter table public.event_survey_campaigns enable row level security;
alter table public.event_survey_entries enable row level security;

-- RLS 정책: 캠페인 읽기
create policy "read campaigns in scope" on public.event_survey_campaigns for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = event_survey_campaigns.agency_id)
    or exists (select 1 from public.my_clients c where c.client_id = event_survey_campaigns.client_id)
    or status = 'published' -- 공개된 캠페인은 누구나 읽기 가능 (공개 API용)
  );

-- RLS 정책: 캠페인 생성/수정 (클라이언트 operator 이상)
create policy "manage campaigns by operator" on public.event_survey_campaigns for all
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_clients c
               where c.client_id = event_survey_campaigns.client_id 
               and c.role in ('owner','admin','operator'))
  )
  with check (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_clients c
               where c.client_id = event_survey_campaigns.client_id 
               and c.role in ('owner','admin','operator'))
  );

-- RLS 정책: 엔트리 읽기 (운영자 또는 공개 API)
create policy "read entries in scope" on public.event_survey_entries for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = event_survey_entries.agency_id)
    or exists (select 1 from public.my_clients c where c.client_id = event_survey_entries.client_id)
    -- 공개 API는 서비스 롤로 접근하므로 RLS를 우회함
  );

-- RLS 정책: 엔트리 생성 (공개 API는 서비스 롤로 접근)
create policy "insert entries via service role" on public.event_survey_entries for insert
  with check (true); -- 서비스 롤로만 접근하므로 항상 허용

-- RLS 정책: 엔트리 수정 (운영자만)
create policy "update entries by operator" on public.event_survey_entries for update
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_clients c
               where c.client_id = event_survey_entries.client_id 
               and c.role in ('owner','admin','operator'))
  )
  with check (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_clients c
               where c.client_id = event_survey_entries.client_id 
               and c.role in ('owner','admin','operator'))
  );

-- Realtime 활성화
alter publication supabase_realtime add table public.event_survey_campaigns;
alter publication supabase_realtime add table public.event_survey_entries;

commit;


begin;

-- forms 테이블 수정: webinar_id를 nullable로 변경하고 campaign_id 추가
-- 설문조사는 웨비나 없이도 독립적으로 운영 가능하도록 함

-- 1. webinar_id를 nullable로 변경 (기존 데이터는 그대로 유지)
alter table public.forms
  alter column webinar_id drop not null;

-- 2. campaign_id 컬럼 추가
alter table public.forms
  add column if not exists campaign_id uuid references public.event_survey_campaigns(id) on delete set null;

-- 3. 제약 조건 추가: webinar_id 또는 campaign_id 중 하나는 반드시 있어야 함
alter table public.forms
  add constraint check_forms_has_context 
  check (webinar_id is not null or campaign_id is not null);

-- 4. 인덱스 추가
create index if not exists idx_forms_campaign_id on public.forms(campaign_id) where campaign_id is not null;

-- 5. fill_org_fields 함수 수정: campaign_id 지원 추가
create or replace function public.fill_org_fields() returns trigger as $$
declare 
  agency_id_val uuid;
  client_id_val uuid;
begin
  -- forms 테이블: webinar_id 또는 campaign_id로부터 조회
  if TG_TABLE_NAME = 'forms' then
    if new.webinar_id is not null then
      select agency_id, client_id into strict agency_id_val, client_id_val
      from public.webinars 
      where id = new.webinar_id;
      
      if new.agency_id is null then 
        new.agency_id := agency_id_val; 
      end if;
      
      if new.client_id is null then 
        new.client_id := client_id_val; 
      end if;
    elsif new.campaign_id is not null then
      select agency_id, client_id into strict agency_id_val, client_id_val
      from public.event_survey_campaigns
      where id = new.campaign_id;
      
      if new.agency_id is null then 
        new.agency_id := agency_id_val; 
      end if;
      
      if new.client_id is null then 
        new.client_id := client_id_val; 
      end if;
    end if;
  -- webinar_id가 직접 있는 경우
  elsif (TG_TABLE_NAME = 'webinar_files' or TG_TABLE_NAME = 'giveaways') then
    if new.webinar_id is not null then
      select agency_id, client_id into strict agency_id_val, client_id_val
      from public.webinars 
      where id = new.webinar_id;
      
      if new.agency_id is null then 
        new.agency_id := agency_id_val; 
      end if;
      
      if new.client_id is null then 
        new.client_id := client_id_val; 
      end if;
    end if;
  -- form_id를 통해 간접 조회가 필요한 경우
  elsif (TG_TABLE_NAME = 'form_submissions' or TG_TABLE_NAME = 'form_answers' or TG_TABLE_NAME = 'quiz_attempts') then
    if new.form_id is not null then
      -- forms 테이블에서 webinar_id 또는 campaign_id를 통해 agency_id, client_id 조회
      select 
        coalesce(w.agency_id, c.agency_id) as agency_id,
        coalesce(w.client_id, c.client_id) as client_id
      into strict agency_id_val, client_id_val
      from public.forms f
      left join public.webinars w on w.id = f.webinar_id
      left join public.event_survey_campaigns c on c.id = f.campaign_id
      where f.id = new.form_id;
      
      if agency_id_val is not null and new.agency_id is null then 
        new.agency_id := agency_id_val; 
      end if;
      
      if client_id_val is not null and new.client_id is null then 
        new.client_id := client_id_val; 
      end if;
    end if;
  -- 기타 테이블 (messages, questions 등)
  else
    if new.webinar_id is not null then
      select agency_id, client_id into strict agency_id_val, client_id_val
      from public.webinars 
      where id = new.webinar_id;
      
      if new.agency_id is null then 
        new.agency_id := agency_id_val; 
      end if;
      
      if new.client_id is null then 
        new.client_id := client_id_val; 
      end if;
    end if;
  end if;
  
  return new;
exception
  when no_data_found then
    -- 웨비나나 캠페인, 폼을 찾을 수 없는 경우 그대로 진행 (에러 방지)
    return new;
end; 
$$ language plpgsql;

-- 6. RLS 정책 수정: campaign_id를 통한 forms 접근 지원
drop policy if exists "read forms in scope" on public.forms;
create policy "read forms in scope" on public.forms for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = forms.agency_id)
    or exists (select 1 from public.my_clients c where c.client_id = forms.client_id)
    or (
      status = 'open' 
      and (
        -- 웨비나 참여자
        (webinar_id is not null and exists (
          select 1 from public.registrations r 
          where r.webinar_id = forms.webinar_id and r.user_id = auth.uid()
        ))
        -- 또는 공개된 캠페인 (campaign_id가 있고 캠페인이 published 상태)
        or (
          campaign_id is not null 
          and exists (
            select 1 from public.event_survey_campaigns c 
            where c.id = forms.campaign_id and c.status = 'published'
          )
        )
      )
    )
  );

-- form_submissions RLS 정책도 수정 필요
drop policy if exists "insert my form submission" on public.form_submissions;
create policy "insert my form submission" on public.form_submissions for insert
  with check (
    participant_id = auth.uid()
    and exists (
      select 1 from public.forms f
      where f.id = form_submissions.form_id
        and f.status = 'open'
        and (
          -- 웨비나 참여자
          (f.webinar_id is not null and exists (
            select 1 from public.registrations r
            where r.webinar_id = f.webinar_id and r.user_id = auth.uid()
          ))
          -- 또는 공개된 캠페인 (로그인 없이도 가능)
          or (
            f.campaign_id is not null 
            and exists (
              select 1 from public.event_survey_campaigns c 
              where c.id = f.campaign_id and c.status = 'published'
            )
          )
        )
    )
  );

commit;


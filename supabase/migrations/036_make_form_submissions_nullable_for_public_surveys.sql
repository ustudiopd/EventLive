begin;

-- 공개 설문조사를 위해 form_submissions와 form_answers의 participant_id를 nullable로 변경
-- 공개 설문은 로그인 없이 참여 가능하므로 participant_id가 없을 수 있음

-- 1. form_submissions의 participant_id를 nullable로 변경
alter table public.form_submissions
  alter column participant_id drop not null;

-- 2. form_answers의 participant_id를 nullable로 변경
alter table public.form_answers
  alter column participant_id drop not null;

-- 3. unique 인덱스 수정: participant_id가 null일 수 있으므로 조건부 unique 인덱스로 변경
drop index if exists public.uniq_answer_once;
create unique index uniq_answer_once
  on public.form_answers(question_id, submission_id)
  where participant_id is not null;

-- participant_id가 null인 경우도 허용하되, submission_id와 question_id 조합은 unique해야 함
create unique index uniq_answer_once_null_participant
  on public.form_answers(question_id, submission_id)
  where participant_id is null;

-- 4. 설문 1회 제출 제한 트리거 수정: participant_id가 null인 경우는 체크하지 않음
drop trigger if exists tg_check_survey_submission_once on public.form_submissions;
drop function if exists public.check_survey_submission_once();

create or replace function public.check_survey_submission_once() returns trigger as $$
declare
  form_kind text;
begin
  select kind into form_kind from public.forms where id = new.form_id;
  if form_kind = 'survey' and new.participant_id is not null then
    if exists (
      select 1 from public.form_submissions
      where form_id = new.form_id and participant_id = new.participant_id
    ) then
      raise exception 'Survey can only be submitted once';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tg_check_survey_submission_once
  before insert on public.form_submissions
  for each row execute function public.check_survey_submission_once();

-- 5. RLS 정책 수정: participant_id가 null인 경우도 허용
drop policy if exists "insert my form submission" on public.form_submissions;
create policy "insert my form submission" on public.form_submissions for insert
  with check (
    -- 로그인한 사용자는 자신의 제출만 가능
    (participant_id = auth.uid() and participant_id is not null)
    -- 또는 공개 설문 (participant_id가 null이고, campaign_id가 있고 published 상태)
    or (
      participant_id is null
      and exists (
        select 1 from public.forms f
        where f.id = form_submissions.form_id
          and f.status = 'open'
          and f.campaign_id is not null
          and exists (
            select 1 from public.event_survey_campaigns c 
            where c.id = f.campaign_id and c.status = 'published'
          )
      )
    )
  );

-- 6. form_answers RLS 정책 수정
drop policy if exists "insert my form answer" on public.form_answers;
create policy "insert my form answer" on public.form_answers for insert
  with check (
    -- 로그인한 사용자는 자신의 답변만 가능
    (participant_id = auth.uid() and participant_id is not null)
    -- 또는 공개 설문 (participant_id가 null이고, submission_id가 공개 설문에 속함)
    or (
      participant_id is null
      and exists (
        select 1 from public.form_submissions s
        join public.forms f on f.id = s.form_id
        where s.id = form_answers.submission_id
          and s.participant_id is null
          and f.campaign_id is not null
          and exists (
            select 1 from public.event_survey_campaigns c 
            where c.id = f.campaign_id and c.status = 'published'
          )
      )
    )
  );

commit;


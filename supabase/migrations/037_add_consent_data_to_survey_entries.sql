begin;

-- event_survey_entries에 개인정보 동의 데이터 저장 필드 추가
alter table public.event_survey_entries
  add column if not exists consent_data jsonb;

-- consent_data 구조 예시:
-- {
--   "consent1": true,  -- 개인정보 공유 동의
--   "consent2": true,  -- 개인정보 취급위탁 동의
--   "consent3": true,  -- 전화, 이메일, SMS 수신 동의
--   "consented_at": "2025-01-XX..."
-- }

commit;


begin;

-- forms 테이블에 config JSONB 필드 추가
-- 설문조사 폼의 기본 필드(회사명, 이름, 전화번호)와 개인정보 동의 항목 설정 저장
alter table public.forms
  add column if not exists config jsonb;

-- config 구조 예시:
-- {
--   "basicFields": {
--     "company": {
--       "enabled": true,
--       "required": true,
--       "label": "회사명"
--     },
--     "name": {
--       "enabled": true,
--       "required": true,
--       "label": "이름"
--     },
--     "phone": {
--       "enabled": true,
--       "required": true,
--       "label": "휴대전화번호"
--     }
--   },
--   "consentFields": [
--     {
--       "id": "consent1",
--       "enabled": true,
--       "required": true,
--       "title": "개인정보 공유 동의",
--       "content": "동의 내용..."
--     },
--     {
--       "id": "consent2",
--       "enabled": true,
--       "required": true,
--       "title": "개인정보 취급위탁 동의",
--       "content": "동의 내용..."
--     },
--     {
--       "id": "consent3",
--       "enabled": true,
--       "required": true,
--       "title": "전화, 이메일, SMS 수신 동의",
--       "content": "동의 내용..."
--     }
--   ],
--   "headerImage": {
--     "url": "https://...",
--     "enabled": true
--   }
-- }

commit;


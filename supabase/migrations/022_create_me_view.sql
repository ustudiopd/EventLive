-- public.me 뷰 생성
-- RLS 정책에서 사용 중이므로 필요
-- 내 권한 판정용 뷰

create or replace view public.me as
select 
  p.id as user_id, 
  p.is_super_admin 
from public.profiles p 
where p.id = auth.uid();

-- 뷰에 대한 RLS는 필요 없음 (이미 profiles 테이블의 RLS가 적용됨)


begin;

-- webinars 테이블에 slug 필드 추가
alter table public.webinars 
  add column if not exists slug text;

-- slug에 unique 인덱스 생성
create unique index if not exists uniq_webinar_slug on public.webinars(slug) where slug is not null;

-- slug 인덱스 생성 (조회 성능 향상)
create index if not exists idx_webinars_slug on public.webinars(slug) where slug is not null;

-- 기존 웨비나에 slug 자동 생성 함수
create or replace function public.generate_slug_from_title(title text) returns text as $$
declare
  base_slug text;
  final_slug text;
  slug_exists boolean;
  counter int := 0;
begin
  -- 한글, 영문, 숫자, 공백을 허용하고 나머지는 제거
  -- 소문자로 변환하고 공백을 하이픈으로 변경
  base_slug := lower(
    regexp_replace(
      regexp_replace(title, '[^가-힣a-zA-Z0-9\s]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
  
  -- 길이 제한 (최대 100자)
  if length(base_slug) > 100 then
    base_slug := left(base_slug, 100);
  end if;
  
  -- 앞뒤 하이픈 제거
  base_slug := trim(both '-' from base_slug);
  
  -- 빈 문자열이면 랜덤 문자열 생성
  if base_slug = '' or base_slug is null then
    base_slug := 'webinar-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  end if;
  
  final_slug := base_slug;
  
  -- 중복 체크 및 숫자 추가
  loop
    select exists(select 1 from public.webinars where slug = final_slug) into slug_exists;
    
    exit when not slug_exists;
    
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
    
    -- 무한 루프 방지
    if counter > 1000 then
      final_slug := base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
      exit;
    end if;
  end loop;
  
  return final_slug;
end;
$$ language plpgsql;

-- 기존 웨비나에 slug 자동 생성
do $$
declare
  w record;
  new_slug text;
begin
  for w in select id, title from public.webinars where slug is null or slug = ''
  loop
    new_slug := public.generate_slug_from_title(w.title);
    
    -- 중복 체크 (다른 웨비나와 겹치지 않는지)
    while exists(select 1 from public.webinars where slug = new_slug and id != w.id)
    loop
      new_slug := new_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    end loop;
    
    update public.webinars 
    set slug = new_slug 
    where id = w.id;
  end loop;
end $$;

commit;


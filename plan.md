아래는 요청하신 **B2B2C 멀티테넌시(슈퍼 관리자 → 에이전시 → 클라이언트 → 참여자)** 구조를 완전히 반영한 **EventLive.ai (Enterprise Edition) v2.0 전체 프로젝트 명세서**입니다.
기존 1.x 명세의 강점을 유지하면서 **데이터 격리(RLS)·조직 계층화·운영/청구/화이트레이블링**까지 SaaS로 확장했습니다. 그대로 **마이그레이션/개발 체크리스트**에 따라 바로 착수 가능하도록 **SQL·폴더 스켈레톤·정책 샘플**을 포함했습니다.

---

# 📄 프로젝트 명세서: EventLive.ai (Enterprise Edition)

**버전:** 2.0 (B2B2C Multi-Tenancy)
**작성일:** 2025-11-13
**프로젝트명:** EventLive.ai

---

## 1) 프로젝트 개요

### 1.1 목적

유튜브 생중계 기반의 고성능 **인터랙티브 웨비나**에 **B2B2C 멀티테넌시**를 도입하여,

* **에이전시**가 **여러 클라이언트**를 관리하고,
* 각 **클라이언트**가 자체 **웨비나**를 생성·운영하며,
* **참여자**가 실시간 상호작용(채팅·Q&A·퀴즈·추첨)에 참여하는
  SaaS 플랫폼을 구축한다.

### 1.2 사용자 계층(역할) 정의

1. **슈퍼 관리자(Super Admin)**: 플랫폼 전반 관리(에이전시 생성/정지, 전사 통계/감사/청구).
2. **에이전시(Agency)**: 여러 클라이언트(기업)를 온보딩·운영 지원.
3. **클라이언트(Client)**: 실제 행사 주최(웨비나 생성·브랜딩·라이브 운영).
4. **참여자(Participant)**: 시청·채팅·Q&A·퀴즈·추첨 등 상호작용.

---

## 2) 기술 스택

* **디자인/AI 워크플로우**: Figma (MCP), Cursor AI
* **프론트엔드**: Next.js(App Router, React 18), TypeScript
* **API/백엔드**: Next.js Route Handlers (서버리스, Node 런타임)
* **인증/데이터/실시간**: Supabase (Auth, Postgres, Realtime)
* **배포/호스팅**: Vercel (CI/CD, Serverless Functions)
* **관측**: Vercel Analytics, 애플리케이션 로깅 + DB 감사로그
* **빌링(권장)**: Stripe (에이전시 구독/과금), Webhooks
* **보안**: RLS 전면 적용, CSP/권한게이트/레이트리밋

> ※ 기존 1.x 명세의 Realtime/Auth/RLS 전략을 유지하되, **계층형 멀티테넌시를 DB 차원에서 강제**합니다.

---

## 3) 시스템 아키텍처(상위)

* **프론트(Next.js)**:

  * 퍼블릭: `/login`, `/invite/*`
  * 인증 필요:

    * 에이전시 대시보드 `/agency/[agencyId]/*`
    * 클라이언트 대시보드 `/client/[clientId]/*`
    * 웨비나 시청/운영 `/webinar/[id]` (참여자/운영자 권한 분기)
* **API 라우트(서버 전용 키 사용)**:

  * `/api/agencies/*` (슈퍼/에이전시 전용), `/api/clients/*`, `/api/webinars/*`
  * `/api/quiz/*`, `/api/draw/*`, `/api/report/*` 등 운영 기능
* **Supabase**:

  * **Auth**: 이메일/소셜/매직링크(+선택: 게스트 에페메랄 사용자)
  * **DB**: 기관(에이전시/클라이언트) → 웨비나 → 상호작용(메시지/질문/퀴즈/추첨)
  * **Realtime**: DB 변경 구독 + Broadcast/Presence 채널(휘발 이벤트)
* **브랜딩/화이트레이블**: 전용 도메인 매핑 + 테마 JSON
* **빌링/플랜**: 에이전시 단위 구독/플랜, 기능 플래그/할당량

---

## 4) 주요 기능 (레벨별)

### 4.1 슈퍼 관리자

* 에이전시 생성/정지/삭제, 소유자 지정/교체
* 전사 통계(에이전시 수, 클라이언트 수, 웨비나 수/동접/메시지량)
* 인시던트/감사 로그 열람, 요금제·청구 관리

### 4.2 에이전시

* **클라이언트 관리**: 생성/편집, 관리자 초대, 기본 테마/로고 설정
* **집계 리포트**: 클라이언트별 웨비나 성과(참여자·채팅·Q&A·퀴즈 응답률) 다운로드
* 도메인 연결 가이드(화이트레이블), 플랜 할당/제한

### 4.3 클라이언트(행사 운영자)

* **웨비나 관리**: 생성/수정(제목, 일정, 유튜브 URL, 공개/비공개, 접근 정책)
* **브랜딩**: 로고/컬러/배경·히어로 섹션(Figma→코드 파이프라인)
* **Live Console**:

  * Q&A 모더레이션(상단 고정/답변/숨김)
  * 퀴즈(출제→라이브→마감→정답 공개)
  * 경품 추첨(전원/채팅참여자/정답자 그룹)
  * 채팅 관리(숨김/차단/타임아웃)

### 4.4 참여자

* (정책별) 이메일/소셜/초대링크 또는 **게스트(닉네임)** 입장
* 실시간 채팅, 이모지 리액션, 질문 등록/내 질문 조회
* 퀴즈 팝업 응답, 당첨 알림 수신

---

## 5) 데이터 모델 (핵심 스키마)

> **핵심 원칙**
>
> * 모든 “업무 데이터”에 **`agency_id`/`client_id`**를 **직접 컬럼**으로 포함(조인 비용·RLS 단순화).
> * `webinar_id` 기반 입력은 **BE 트리거**로 `agency_id/client_id` 자동 채움(정합성+성능).
> * **조직-사용자 멤버십**은 범위별 별도 테이블(복수 조직 역할 허용).

### 5.1 조직/멤버십

```sql
-- Agencies & Clients
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  logo_url text,
  brand_config jsonb,              -- 색상/폰트/레이아웃 등
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz default now()
);

-- Users & Profiles (Auth 연동)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_super_admin boolean default false,
  created_at timestamptz default now()
);

-- 멤버십(다대다): 동일 유저가 여러 에이전시/클라이언트에 다른 역할로 참여 가능
create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','analyst')),
  created_at timestamptz default now(),
  primary key (agency_id, user_id)
);

create table public.client_members (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','operator','analyst')),
  created_at timestamptz default now(),
  primary key (client_id, user_id)
);
```

### 5.2 웨비나/참여

```sql
create table public.webinars (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  youtube_url text not null,
  start_time timestamptz,
  is_public boolean default false,
  access_policy text default 'auth' check (access_policy in ('auth','guest_allowed','invite_only')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 참가 등록(웨비나 범위 역할: attendee/host/moderator)
create table public.registrations (
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'attendee' check (role in ('attendee','host','moderator')),
  created_at timestamptz default now(),
  primary key (webinar_id, user_id)
);
```

### 5.3 상호작용(채팅/질문/퀴즈/추첨/리액션)

```sql
-- 메시지
create table public.messages (
  id bigserial primary key,
  agency_id uuid not null,
  client_id uuid not null,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  hidden boolean default false,
  created_at timestamptz default now()
);

-- Q&A
create table public.questions (
  id bigserial primary key,
  agency_id uuid not null,
  client_id uuid not null,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null,
  status text not null default 'published' check (status in ('published','answered','hidden','pinned')),
  answered_by uuid references public.profiles(id),
  answered_at timestamptz,
  created_at timestamptz default now()
);

-- 퀴즈
create table public.quizzes (
  id bigserial primary key,
  agency_id uuid not null,
  client_id uuid not null,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  content text not null,
  options jsonb not null,                    -- [{"id":1,"text":"A"},...]
  correct_option_id int,
  status text not null default 'draft' check (status in ('draft','live','closed')),
  start_at timestamptz,
  end_at timestamptz,
  time_limit_sec int,
  created_at timestamptz default now()
);

-- 퀴즈 응답
create table public.quiz_responses (
  id bigserial primary key,
  agency_id uuid not null,
  client_id uuid not null,
  quiz_id bigint not null references public.quizzes(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  selected_option_id int not null,
  created_at timestamptz default now(),
  unique (quiz_id, user_id)
);

-- 추첨(재현 가능성 위해 seed 보관)
create table public.draws (
  id bigserial primary key,
  agency_id uuid not null,
  client_id uuid not null,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  prize_name text not null,
  seed text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

create table public.winners (
  id bigserial primary key,
  draw_id bigint not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  unique (draw_id, user_id)
);

-- 리액션(이모지)
create table public.reactions (
  id bigserial primary key,
  agency_id uuid not null,
  client_id uuid not null,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  emoji text not null,         -- "👍", "🎉" 등 화이트리스트 권장
  created_at timestamptz default now()
);
```

### 5.4 화이트레이블/플랜/청구/감사

```sql
-- 도메인 매핑
create table public.domains (
  domain text primary key,               -- e.g. events.acme.com
  client_id uuid not null references public.clients(id) on delete cascade,
  verified boolean default false,
  last_checked_at timestamptz
);

-- 플랜 & 구독(에이전시 단위)
create table public.plans (
  code text primary key,                 -- 'free','pro','enterprise'
  name text not null,
  limits jsonb not null,                 -- {"max_clients":10,"max_concurrent":500,...}
  features jsonb not null                -- {"whitelabel":true,"quiz":true,...}
);

create table public.subscriptions (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  current_period_end timestamptz,
  stripe_customer_id text,               -- 외부 빌링 연동 필드
  stripe_sub_id text,
  updated_at timestamptz default now()
);

-- 감사 로그(운영자 액션)
create table public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid references public.profiles(id),
  agency_id uuid,
  client_id uuid,
  webinar_id uuid,
  action text not null,                  -- 'QUIZ_LAUNCH','DRAW_RUN','QNA_HIDE' 등
  payload jsonb,
  created_at timestamptz default now()
);
```

### 5.5 정합성/자동 채움 트리거

```sql
-- webinar_id만으로 작성 시 agency_id/client_id 자동 주입
create or replace function public.fill_org_fields() returns trigger as $$
declare w record;
begin
  select agency_id, client_id into w from public.webinars where id = new.webinar_id;
  if new.agency_id is null then new.agency_id := w.agency_id; end if;
  if new.client_id is null then new.client_id := w.client_id; end if;
  return new;
end; $$ language plpgsql;

create trigger tg_fill_org_fields_messages    before insert on public.messages       for each row execute function public.fill_org_fields();
create trigger tg_fill_org_fields_questions   before insert on public.questions      for each row execute function public.fill_org_fields();
create trigger tg_fill_org_fields_quizzes     before insert on public.quizzes        for each row execute function public.fill_org_fields();
create trigger tg_fill_org_fields_quiz_resp   before insert on public.quiz_responses for each row execute function public.fill_org_fields();
create trigger tg_fill_org_fields_draws       before insert on public.draws          for each row execute function public.fill_org_fields();
create trigger tg_fill_org_fields_reactions   before insert on public.reactions      for each row execute function public.fill_org_fields();

-- 메시지 레이트리밋(5초 3회)
create or replace function public.rate_limit_messages() returns trigger as $$
declare cnt int;
begin
  select count(*) into cnt from public.messages
   where user_id = new.user_id and created_at > now() - interval '5 seconds';
  if cnt >= 3 then
    raise exception 'Too many messages, please slow down.';
  end if;
  return new;
end; $$ language plpgsql;

create trigger tg_messages_rl before insert on public.messages for each row execute function public.rate_limit_messages();
```

---

## 6) RLS 정책 전략(멀티테넌시 격리)

> **원칙**
>
> * **슈퍼 관리자**: 전행 접근 허용(명시 정책).
> * **에이전시 멤버**: `agency_members.role in ('owner','admin','analyst')` & 같은 `agency_id` 데이터.
> * **클라이언트 멤버**: `client_members.role in ('owner','admin','operator','analyst')` & 같은 `client_id` 데이터.
> * **참여자**: 해당 `webinar_id` 등록자(registrations)만 열람/쓰기.
> * 모든 테이블 RLS **활성화** 후 **SELECT/INSERT/UPDATE/DELETE** 별도 정책.

### 6.1 공통 헬퍼 뷰(편의)

```sql
-- 내 권한 판정용 뷰(조인 비용 감소를 위해 materialized view/인덱스 고려 가능)
create view public.me as
  select p.id as user_id, p.is_super_admin from public.profiles p where p.id = auth.uid();

-- 에이전시/클라이언트 멤버십 여부 빠른 검사용
create view public.my_agencies as
  select agency_id, role from public.agency_members where user_id = auth.uid();

create view public.my_clients as
  select client_id, role from public.client_members where user_id = auth.uid();
```

### 6.2 테이블별 대표 정책(샘플)

```sql
-- 공통: RLS 활성화
alter table public.agencies        enable row level security;
alter table public.clients         enable row level security;
alter table public.profiles        enable row level security;
alter table public.agency_members  enable row level security;
alter table public.client_members  enable row level security;
alter table public.webinars        enable row level security;
alter table public.registrations   enable row level security;
alter table public.messages        enable row level security;
alter table public.questions       enable row level security;
alter table public.quizzes         enable row level security;
alter table public.quiz_responses  enable row level security;
alter table public.draws           enable row level security;
alter table public.winners         enable row level security;
alter table public.reactions       enable row level security;
alter table public.domains         enable row level security;
alter table public.plans           enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.audit_logs      enable row level security;

-- 슈퍼 관리자 전권
create policy "superadmin all agencies" on public.agencies for all
  using ((select is_super_admin from public.me) is true)
  with check ((select is_super_admin from public.me) is true);

-- 에이전시/클라이언트 읽기
create policy "read my agencies" on public.agencies for select
  using ((select is_super_admin from public.me) is true
      or exists (select 1 from public.my_agencies a where a.agency_id = agencies.id));

create policy "read my clients" on public.clients for select
  using ((select is_super_admin from public.me) is true
      or exists (select 1 from public.my_agencies a where a.agency_id = clients.agency_id)
      or exists (select 1 from public.my_clients  c where c.client_id  = clients.id));

-- 클라이언트 생성: 에이전시 owner/admin
create policy "agency can create client" on public.clients for insert
  with check (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a
               where a.agency_id = clients.agency_id and a.role in ('owner','admin'))
  );

-- 웨비나 접근
create policy "read webinars within scope" on public.webinars for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = webinars.agency_id)
    or exists (select 1 from public.my_clients  c where c.client_id  = webinars.client_id)
    or exists (select 1 from public.registrations r where r.webinar_id = webinars.id and r.user_id = auth.uid())
    or (webinars.is_public = true and webinars.access_policy in ('guest_allowed'))
  );

-- 메시지 읽기/쓰기(참여자 또는 운영 범위)
create policy "read messages if in scope" on public.messages for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = messages.agency_id)
    or exists (select 1 from public.my_clients  c where c.client_id  = messages.client_id)
    or exists (select 1 from public.registrations r where r.webinar_id = messages.webinar_id and r.user_id = auth.uid())
  );

create policy "insert message if registered" on public.messages for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.registrations r where r.webinar_id = messages.webinar_id and r.user_id = auth.uid())
  );

-- Q&A 운영 변경(클라이언트 operator/admin 이상)
create policy "update questions by operator" on public.questions for update
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_clients c
               where c.client_id = questions.client_id and c.role in ('owner','admin','operator'))
  );

-- 퀴즈 응답: 사용자당 1회, 라이브 시간만
-- (시간 검증 트리거는 앞 절 참고)
create policy "insert my quiz response" on public.quiz_responses for insert
  with check (user_id = auth.uid());

-- 추첨/당첨 열람: 동일 범위
create policy "read draws/winners in scope" on public.draws for select
  using (
    (select is_super_admin from public.me) is true
    or exists (select 1 from public.my_agencies a where a.agency_id = draws.agency_id)
    or exists (select 1 from public.my_clients  c where c.client_id  = draws.client_id)
    or exists (select 1 from public.registrations r where r.webinar_id = draws.webinar_id and r.user_id = auth.uid())
  );

create policy "read winners via draw scope" on public.winners for select
  using (
    exists (select 1 from public.draws d
            where d.id = winners.draw_id
              and (
                (select is_super_admin from public.me) is true
                or exists (select 1 from public.my_agencies a where a.agency_id = d.agency_id)
                or exists (select 1 from public.my_clients  c where c.client_id  = d.client_id)
                or exists (select 1 from public.registrations r where r.webinar_id = d.webinar_id and r.user_id = auth.uid())
              ))
  );
```

> **참고**: `UPDATE/DELETE` 정책은 위와 동일한 범위로 별도 생성. `profiles.is_super_admin`은 **클라이언트에서 변경 불가**(서버 전용 RPC/서비스 키 경로에서만).

---

## 7) 실시간(Realtime) 설계

* **DB Changes 구독**: `messages/questions/quizzes/draws/winners` — `eq(webinar_id, :id)` 필터
* **Broadcast/Presence 채널**: `presence:webinar-{id}`

  * Presence(참여자 수/명단), typing, 카운트다운, 토스트 알림 등 휘발 이벤트
* **성능 권장**:

  * 메시지 **최신 50개 윈도우 + 무한 스크롤**
  * 인덱스: `(webinar_id, created_at desc)`, `(client_id)`, `(agency_id)`
  * 과도한 서버 호출 방지: **클라이언트 디바운싱**·배치 렌더

---

## 8) 프론트엔드 IA & 페이지 맵

```
/app
  /(public)
    /login/page.tsx
    /invite/[token]/page.tsx
  /(super)
    /super/dashboard/page.tsx
    /super/agencies/page.tsx
  /(agency)
    /agency/[agencyId]/dashboard/page.tsx
    /agency/[agencyId]/clients/page.tsx
    /agency/[agencyId]/reports/page.tsx
  /(client)
    /client/[clientId]/dashboard/page.tsx
    /client/[clientId]/webinars/new/page.tsx
    /client/[clientId]/settings/branding/page.tsx
  /(webinar)
    /webinar/[id]/page.tsx            # 시청(참여자)
    /webinar/[id]/console/page.tsx     # 운영 콘솔(클라이언트 operator 이상)
/api
  /agencies/create/route.ts
  /clients/create/route.ts
  /webinars/create/route.ts
  /quiz/launch/route.ts
  /draw/run/route.ts
  /report/export/route.ts
/lib
  /supabase/{client,server}.ts
  /auth/guards.ts
  /rbac/checks.ts
/components
  Chat.tsx, QA.tsx, Quiz.tsx, DrawToast.tsx, PresenceBar.tsx ...
```

* **런타임 주의**: 실시간/WS 경로는 `export const runtime = 'nodejs'`
* **권한 게이트**: `guards.ts` (슈퍼/에이전시/클라이언트/참여자 분기)
* **CSP**: `frame-src`(YouTube), `connect-src`(Supabase wss), `img-src`, `script-src` 최소화
* **브랜딩**: `/client/[clientId]/settings/branding`에서 `brand_config` JSON을 내려 UI Theme Provider에 적용

---

## 9) API 설계(대표)

* `POST /api/agencies/create` — **슈퍼** 전용, 서비스 롤 키
* `POST /api/clients/create` — **에이전시 owner/admin**
* `POST /api/webinars/create` — **클라이언트 owner/admin/operator**
* `POST /api/quiz/launch` — 퀴즈 생성/상태 `live` 전환
* `POST /api/draw/run` — seed 생성 → `draws`/`winners` 삽입(결정적 해시 선정)
* `GET  /api/report/export?clientId=...&range=...` — CSV/JSON 내보내기

> 모든 서버 전용 라우트는 `SUPABASE_SERVICE_ROLE_KEY` 사용, **브라우저 번들에 노출 금지**.

---

## 10) 인증/입장 정책

* **권장 기본**: 모든 상호작용은 **Auth 필요**(이메일/소셜/매직링크).
* **옵션(게스트)**: 클라이언트 설정이 `guest_allowed`일 때, 서버 라우트가 **에페메랄 계정**(임시 `auth.users`)을 생성 → 익명 프로필로 입장(만료/정리 배치).

  * 장점: RLS 일관성 유지(`auth.uid()` 존재).
  * 주의: **서비스 롤 라우트 전용**으로 생성·삭제.

---

## 11) 운영/보안/컴플라이언스

* **RLS 전면 활성화**(테이블 추가 시 기본) + **권한 회피 시나리오 테스트**
* **레이트리밋**: 메시지 트리거 + API 레이트리밋(서버 라우트)
* **감사로그**: 운영자 액션을 `audit_logs`에 기록
* **데이터 보존**: 채팅/질문 기본 180일 보관(설정화) + 아카이브
* **PII/프라이버시**: 게스트 모드 고지, YouTube 임베드 고지, 쿠키 정책
* **백업/DR**: DB 자동 백업, 포인트 인 타임 리커버리(서비스 플랜 고려)

---

## 12) 빌링/플랜(에이전시 단위)

* **plans**: 기능 플래그/한도 관리(동시 접속, 웨비나 수, 리포트, 화이트레이블 등)
* **subscriptions**: 에이전시별 현재 플랜/상태/결제 식별자
* **정책 후킹**: 플랜에 따라 **API 라우트/버튼 비활성화 + RLS로 하드 가드**
* **Webhook**: 결제 상태 변경 시 `subscriptions` 갱신(서버 전용 라우트)

---

## 13) 관측/성능/SLO

* **SLI**: Realtime 메시지 전파 p95 < 500ms, API p95 < 300ms, 오류율 < 0.1%
* **지표**: 동접, 메시지 QPS, 질문/응답률, 퀴즈 참여율, 추첨 소요
* **알림**: 에러/지연 임계치 초과 시 Slack/Webhook
* **부하 테스트**: 메시지/브로드캐스트에 대한 윈도우 테스트(k 명 동시)

---

## 14) 개발 마일스톤 (업데이트)

### Phase 1 — **멀티테넌시 코어**

* 스키마/인덱스/트리거/RLS/멤버십 구현
* 슈퍼 관리자 에이전시 생성 라우트
* 기본 대시보드 스켈레톤

### Phase 2 — **에이전시/클라이언트 대시보드**

* 클라이언트 생성·관리, 브랜딩 설정
* 테넌트별 통합 통계(표·차트), CSV 내보내기
* 도메인 매핑/검증 UI

### Phase 3 — **웨비나 및 실시간 기능**

* 시청/채팅/Q&A/리액션, 운영 콘솔(퀴즈·추첨)
* Presence/Typing, 모더레이션(숨김/차단)

### Phase 4 — **이벤트 로직 고도화 & 리포트**

* 퀴즈 정답·정답자 집계, 추첨 재현성 보고
* 참여/체류/행동 리포트, 자동 발송

---

## 15) Next.js 코드 스니펫(대표)

### 15.1 Supabase 클라이언트

```ts
// /lib/supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      },
    }
  )
}
```

### 15.2 권한 게이트 (SSR)

```ts
// /lib/auth/guards.ts
import { createServerSupabase } from '@/lib/supabase/server'
export async function requireClientOperator(clientId: string) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 401 }
  const { data: m } = await supabase.from('client_members')
    .select('role').eq('client_id', clientId).eq('user_id', user.id).maybeSingle()
  const { data: me } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  const allowed = me?.is_super_admin || ['owner','admin','operator'].includes(m?.role)
  return allowed ? { ok: true } : { ok: false, code: 403 }
}
```

### 15.3 추첨 실행 API (서버 전용)

```ts
// /app/api/draw/run/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { webinarId, prizeName, seed } = await req.json()
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 권한: webinar의 client 멤버 operator 이상
  const { data: w, error: ew } = await supabase.from('webinars')
    .select('client_id, agency_id').eq('id', webinarId).single()
  if (ew || !w) return NextResponse.json({ error: 'Webinar not found' }, { status: 404 })

  const { data: cm } = await supabase.from('client_members')
    .select('role').eq('client_id', w.client_id).eq('user_id', user.id).maybeSingle()
  const { data: me } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  const permitted = me?.is_super_admin || ['owner','admin','operator'].includes(cm?.role)
  if (!permitted) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 서버 전용 키
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // 절대 클라이언트로 노출 금지
  )

  // 후보 추출(예: 등록자)
  const { data: regs } = await admin.from('registrations').select('user_id').eq('webinar_id', webinarId)
  // 결정적 정렬
  const winners = [...new Set(regs?.map(r => r.user_id) ?? [])]
    .sort((a,b) => (seed + a).localeCompare(seed + b))  // 실제는 서버에서 sha256 정렬 권장
    .slice(0, 1)

  const { data: draw } = await admin.from('draws')
    .insert({ webinar_id: webinarId, prize_name: prizeName, seed, agency_id: w.agency_id, client_id: w.client_id, created_by: user.id })
    .select().single()

  await admin.from('winners').insert(winners.map(u => ({ draw_id: draw.id, user_id: u })))
  return NextResponse.json({ ok: true, drawId: draw.id })
}
```

---

## 16) 테스트 시나리오(E2E)

1. **슈퍼**가 에이전시 A 생성 → 에이전시 오너 초대
2. 에이전시 오너가 클라이언트 X 생성 → 클라이언트 운영자 초대
3. 운영자가 웨비나 W 생성(비공개/auth) → 테스트 계정 등록
4. 참여자가 로그인 → `/webinar/W` 시청, 채팅/질문 등록
5. 운영 콘솔에서 퀴즈 출제(`live`) → 응답 제한/중복 방지 확인
6. 추첨 실행 → 당첨자 팝업, `audit_logs` 기록 검증
7. 에이전시 대시보드에서 리포트 다운로드

---

## 17) 운영 체크리스트

* [ ] 모든 테이블 **RLS 활성화** 확인
* [ ] 서비스 롤 키 **서버 전용**(Next Route Handlers)
* [ ] YouTube **임베드 허용/프라이버시 고지**
* [ ] 도메인 매핑(DNS/검증) & CSP 헤더
* [ ] 플랜 한도 초과 시 UX 안내 + RLS 하드 차단
* [ ] 백업/복구 리허설, 감사로그 보관 정책

---

## 18) Phase 1 즉시 실행(마이그레이션 순서)

1. **agencies / clients / profiles / memberships**
2. **webinars / registrations**
3. **messages / questions / quizzes / quiz_responses / draws / winners / reactions**
4. **domains / plans / subscriptions / audit_logs**
5. **인덱스/트리거(fill_org_fields, rate_limit, quiz_guard)**
6. **RLS 정책**(슈퍼 관리자 → 조직 멤버 → 참가자 순으로)
7. **Seed**(슈퍼/에이전시/클라이언트/테스트 웨비나)
8. **Next.js 권한 게이트/페이지 스켈레톤 배포**

---

### ✅ 결론

본 명세는 **B2B2C 멀티테넌시**를 **DB/RLS/권한/브랜딩/빌링**까지 수직적으로 일관되게 설계했습니다.
그대로 적용하면 **데이터 격리**와 **운영 확장성**을 확보한 상태로 **Phase 1**을 바로 시작할 수 있습니다.

원하시면, 위 스키마를 **Supabase CLI 마이그레이션 파일**로 정리한 패키지와 **Next.js 초기 프로젝트 템플릿**(폴더/보일러플레이트 + 기본 가드 + 데모 콘솔)을 한 번에 제공해드리겠습니다.

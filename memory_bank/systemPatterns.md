# 시스템 아키텍처 및 패턴 (System Patterns)

## 1. 전체 아키텍처  

### 아키텍처 스타일
- **프론트엔드**: Next.js App Router (React 18, TypeScript)
- **백엔드**: Next.js Route Handlers (서버리스 함수)
- **데이터베이스**: Supabase PostgreSQL (RLS 활성화)
- **인증**: Supabase Auth
- **실시간**: Supabase Realtime
- **스토리지**: Supabase Storage (예정)
- **배포**: Vercel (Serverless Functions)

### 계층 구조
```
┌─────────────────────────────────────┐
│   Next.js Frontend (App Router)    │
│   - Server Components               │
│   - Client Components               │
│   - Route Handlers (API)            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Supabase Client/Server Wrappers    │
│   - createServerSupabase()          │
│   - createAdminSupabase()           │
│   - createClientSupabase()          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Supabase Services                 │
│   - Auth                            │
│   - PostgreSQL (RLS)                │
│   - Realtime                        │
│   - Storage                         │
└─────────────────────────────────────┘
```

### 멀티테넌시 구조
- **B2B2C 계층**: Super Admin → Agency → Client → Participant
- **데이터 격리**: 모든 테이블에 `agency_id`, `client_id` 포함
- **RLS 정책**: 데이터베이스 레벨에서 접근 제어
- **애플리케이션 레벨 권한**: API 라우트에서 추가 권한 확인

## 2. 주요 디자인 패턴  

### 2.1 인증/권한 패턴
- **Guard Pattern**: `lib/auth/guards.ts`에서 권한 체크 함수 제공
  - `requireAuth()`: 로그인 확인
  - `requireAgencyMember()`: 에이전시 멤버 확인
  - `requireClientMember()`: 클라이언트 멤버 확인
- **RBAC (Role-Based Access Control)**: 역할 기반 접근 제어
  - 슈퍼 관리자: `is_super_admin` 플래그
  - 에이전시 멤버: `owner`, `admin`, `analyst`
  - 클라이언트 멤버: `owner`, `admin`, `operator`, `analyst`, `viewer`

### 2.2 데이터 접근 패턴
- **Admin Supabase Pattern**: RLS 우회가 필요한 경우 `createAdminSupabase()` 사용
  - 데이터 조회 후 애플리케이션 레벨에서 권한 체크
  - RLS 무한 재귀 문제 해결
- **Server Supabase Pattern**: 서버 컴포넌트/API에서 `createServerSupabase()` 사용
- **Client Supabase Pattern**: 클라이언트 컴포넌트에서 `createClientSupabase()` 사용

### 2.3 실시간 패턴
- **DB Changes Subscription**: Supabase Realtime으로 테이블 변경 구독
  - `messages`, `questions` 등 상호작용 데이터 실시간 업데이트
- **Presence Pattern**: `presence:webinar-{id}` 채널로 참여자 추적
- **Broadcast Pattern**: 휘발 이벤트 전파 (미구현)

### 2.4 컴포넌트 패턴
- **모듈화 컴포넌트**: `components/webinar/` 디렉토리에 재사용 가능한 컴포넌트
  - `Chat.tsx`: 채팅 컴포넌트
  - `QA.tsx`: Q&A 컴포넌트
  - `PresenceBar.tsx`: 참여자 표시 컴포넌트
  - `YouTubePlayer.tsx`: YouTube 플레이어 컴포넌트
- **Props 기반 커스터마이징**: 각 컴포넌트는 props로 동작 커스터마이징 가능

### 2.5 에러 처리 패턴
- **Graceful Degradation**: 감사 로그 실패 시에도 메인 작업은 계속 진행
- **에러 메시지**: 사용자 친화적인 에러 메시지 제공
- **로깅**: 서버 사이드에서 상세 로그 기록

## 3. 코딩 컨벤션  

### 3.1 네이밍 규칙
- **파일명**: 
  - 컴포넌트: PascalCase (예: `WebinarView.tsx`)
  - 유틸리티: camelCase (예: `getUserDashboard.ts`)
  - API 라우트: kebab-case 디렉토리 (예: `api/webinars/create/route.ts`)
- **변수/함수**: camelCase (예: `createServerSupabase`, `isFullscreen`)
- **상수**: UPPER_SNAKE_CASE (예: `NEXT_PUBLIC_SUPABASE_URL`)
- **타입/인터페이스**: PascalCase (예: `WebinarViewProps`, `PresenceUser`)

### 3.2 파일 구조
```
/app
  /(super)          # 슈퍼 관리자 라우트
  /(agency)         # 에이전시 라우트
  /(client)         # 클라이언트 라우트
  /(webinar)        # 웨비나 라우트
  /api              # API 라우트
/components
  /webinar          # 웨비나 관련 컴포넌트
  /ui               # 재사용 가능한 UI 컴포넌트
/lib
  /supabase         # Supabase 클라이언트
  /auth             # 인증/권한 가드
```

### 3.3 코드 스타일
- **TypeScript**: 엄격한 타입 사용, `any` 지양
- **React**: 함수형 컴포넌트, Hooks 사용
- **Next.js**: 
  - Server Components 기본, 필요시 `'use client'` 사용
  - `params`, `cookies()` 등은 `await` 처리 (Next.js 15)
- **에러 처리**: try-catch 블록으로 모든 외부 연동 감싸기
- **주석**: 복잡한 로직에 설명 주석 추가

### 3.4 API 설계 패턴
- **RESTful**: RESTful API 설계 원칙 준수
- **에러 응답**: `{ error: string }` 형식으로 일관성 유지
- **성공 응답**: `{ success: true, data: ... }` 형식
- **권한 확인**: 모든 API 라우트에서 권한 확인 후 처리
- **감사 로그**: 중요한 작업은 `audit_logs` 테이블에 기록

### 3.5 데이터베이스 패턴
- **트리거**: `fill_org_fields()` 함수로 `agency_id`, `client_id` 자동 채움
- **RLS**: 모든 테이블에 RLS 활성화, 슈퍼 관리자/조직 멤버/참여자별 정책
- **인덱스**: `webinar_id`, `client_id`, `agency_id` 등에 인덱스 설정
- **제약 조건**: 외래 키, 체크 제약 조건으로 데이터 정합성 보장

## 4. 성능 최적화 패턴

### 4.1 프론트엔드
- **코드 스플리팅**: Next.js App Router의 자동 코드 스플리팅 활용
- **이미지 최적화**: Next.js Image 컴포넌트 사용 (필요시)
- **반응형 디자인**: Tailwind CSS의 반응형 유틸리티 사용

### 4.2 백엔드
- **서버리스**: Vercel Serverless Functions로 자동 스케일링
- **캐싱**: 필요시 Vercel Edge Cache 활용
- **배치 처리**: 여러 쿼리를 배치로 처리하여 성능 향상

### 4.3 데이터베이스
- **인덱스**: 자주 조회되는 컬럼에 인덱스 설정
- **RLS 최적화**: 복잡한 RLS 정책을 단순화하여 성능 향상
- **트리거**: 애플리케이션 로직 대신 DB 트리거로 자동 처리

## 5. 보안 패턴

### 5.1 인증/인가
- **서버 사이드 권한 확인**: 클라이언트 사이드 권한 체크는 UI용일 뿐
- **RLS 이중 방어**: DB 레벨 RLS + 애플리케이션 레벨 권한 체크
- **서비스 롤 키**: Admin Supabase는 서버 전용, 클라이언트에 노출 금지

### 5.2 데이터 보호
- **환경 변수**: 민감한 정보는 환경 변수로 관리
- **SQL 인젝션 방지**: Supabase 클라이언트의 파라미터 바인딩 사용
- **XSS 방지**: React의 자동 이스케이핑 활용

## 6. 실시간 패턴

### 6.1 DB Changes 구독
```typescript
const channel = supabase
  .channel(`webinar-${webinarId}-messages`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `webinar_id=eq.${webinarId}`,
  }, (payload) => {
    // 업데이트 처리
  })
  .subscribe()
```

### 6.2 Presence 패턴
```typescript
const channel = supabase.channel(`presence:webinar-${webinarId}`)
await channel.track({ user: {...}, online_at: ... })
```

## 7. 테스트 전략 (예정)
- **단위 테스트**: 핵심 비즈니스 로직
- **통합 테스트**: API 엔드포인트
- **E2E 테스트**: 주요 사용자 시나리오

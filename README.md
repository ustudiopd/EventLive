# EventLive.ai - Enterprise Edition v2.0

B2B2C 멀티테넌시 웨비나 플랫폼

## 프로젝트 개요

유튜브 생중계 기반의 고성능 인터랙티브 웨비나에 B2B2C 멀티테넌시를 도입한 SaaS 플랫폼입니다.

## 기술 스택

- **프론트엔드**: Next.js 15 (App Router), React 18, TypeScript
- **백엔드**: Next.js Route Handlers (서버리스)
- **데이터베이스**: Supabase (PostgreSQL + RLS)
- **인증**: Supabase Auth
- **실시간**: Supabase Realtime
- **스타일링**: Tailwind CSS
- **배포**: Vercel

## 프로젝트 구조

```
/app
  /(public)          # 퍼블릭 페이지
    /login
  /(super)           # 슈퍼 관리자
    /super/dashboard
    /super/agencies
  /(agency)          # 에이전시
    /agency/[agencyId]/dashboard
  /(client)          # 클라이언트
    /client/[clientId]/dashboard
  /api               # API 라우트
/lib
  /supabase          # Supabase 클라이언트
  /auth              # 인증 가드
```

## 환경 설정

1. `.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://yqsayphssjznthrxpgfb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. 패키지 설치:

```bash
npm install
```

3. 개발 서버 실행:

```bash
npm run dev
```

## 데이터베이스 마이그레이션

모든 마이그레이션이 Supabase에 적용되었습니다:

- ✅ 조직/멤버십 스키마
- ✅ 웨비나/참여 스키마
- ✅ 상호작용 스키마 (메시지, 질문, 퀴즈, 추첨)
- ✅ 빌링/플랜/감사 스키마
- ✅ 인덱스 및 트리거
- ✅ RLS 정책 (모든 테이블)

## 기본 플랜

다음 플랜이 자동으로 생성됩니다:

- **Free**: 최대 3개 클라이언트, 100명 동시 접속
- **Pro**: 최대 20개 클라이언트, 500명 동시 접속, 화이트레이블
- **Enterprise**: 무제한 클라이언트, 5000명 동시 접속

## 다음 단계

1. Supabase Auth에서 슈퍼 관리자 계정 생성
2. 프로필에서 `is_super_admin = true` 설정
3. `/api/agencies/create`로 첫 번째 에이전시 생성
4. 에이전시 대시보드에서 클라이언트 생성
5. 클라이언트 대시보드에서 웨비나 생성

## 개발 가이드

### 권한 체크

```typescript
import { requireSuperAdmin } from '@/lib/auth/guards'

export default async function Page() {
  const { user } = await requireSuperAdmin()
  // 슈퍼 관리자만 접근 가능
}
```

### Supabase 클라이언트 사용

**서버 사이드:**
```typescript
import { createServerSupabase } from '@/lib/supabase/server'
const supabase = createServerSupabase()
```

**클라이언트 사이드:**
```typescript
import { createClientSupabase } from '@/lib/supabase/client'
const supabase = createClientSupabase()
```

**서버 전용 (Admin):**
```typescript
import { createAdminSupabase } from '@/lib/supabase/admin'
const admin = createAdminSupabase()
```

## 라이선스

프로젝트 내부 사용


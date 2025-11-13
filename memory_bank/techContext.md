# 기술 스택 정보 (Tech Context)

## 1. 프레임워크 및 라이브러리  

### 언어 및 버전
- **TypeScript**: 최신 버전
- **Node.js**: 18.x 이상 (Vercel Serverless Functions 요구사항)
- **React**: 18.x (Next.js 내장)

### 핵심 프레임워크
- **Next.js**: 15.5.6 (App Router 사용)
  - Server Components 기본
  - Route Handlers (API Routes)
  - Server Actions (미사용)
- **React**: 18.x
  - 함수형 컴포넌트
  - Hooks (useState, useEffect, useRef 등)
  - React Portal (전체화면 기능)

### 데이터베이스
- **PostgreSQL**: Supabase 호스팅
  - RLS (Row Level Security) 활성화
  - 트리거 및 함수 사용
  - 실시간 구독 지원

### 인증 및 백엔드 서비스
- **Supabase Auth**: 이메일/소셜 로그인
- **Supabase Realtime**: 실시간 데이터 동기화
- **Supabase Storage**: 파일 저장 (예정)

### 상태 관리
- **React State**: useState, useReducer
- **서버 상태**: Supabase Realtime 구독
- **전역 상태 관리 라이브러리**: 미사용 (필요시 추가)

### UI 라이브러리
- **Tailwind CSS**: 유틸리티 퍼스트 CSS 프레임워크
  - 커스텀 설정: `tailwind.config.ts`
  - PostCSS: `postcss.config.mjs`
- **커스텀 컴포넌트**: `components/ui/` 디렉토리
  - Button, Card 등 기본 컴포넌트

### 주요 라이브러리
- **@supabase/ssr**: Next.js용 Supabase 클라이언트
- **@supabase/supabase-js**: Supabase JavaScript 클라이언트
- **next/navigation**: Next.js 네비게이션 (useRouter, useParams 등)
- **react-dom**: React Portal 사용

### 차트 라이브러리 (예정)
- **Recharts**: 데이터 시각화 (리포트 페이지에 사용 예정)

## 2. 개발 환경  

### 패키지 매니저
- **npm**: Node.js 패키지 매니저
- **package.json**: 프로젝트 의존성 관리

### Linter / Formatter
- **ESLint**: JavaScript/TypeScript 린터
  - 설정 파일: `.eslintrc.json`
  - Next.js 기본 규칙 사용
- **TypeScript**: 타입 체크
  - 설정 파일: `tsconfig.json`
  - 엄격한 타입 체크 활성화

### 빌드 도구
- **Next.js**: 내장 빌드 시스템
- **Webpack**: Next.js 내부 사용
- **Turbopack**: 개발 모드에서 사용 가능 (선택)

### 개발 서버
- **Next.js Dev Server**: `npm run dev`
- **포트**: 기본 3000번

## 3. 배포 환경  

### 호스팅
- **Vercel**: 
  - Serverless Functions로 배포
  - 자동 CI/CD (Git 연동)
  - 환경 변수 관리
  - Edge Network 활용

### 데이터베이스 호스팅
- **Supabase**: 
  - PostgreSQL 호스팅
  - 자동 백업
  - 실시간 기능
  - 스토리지 서비스

### CI/CD
- **Vercel**: Git 푸시 시 자동 배포
  - Preview 배포 (PR별)
  - Production 배포 (main 브랜치)

### 환경 변수
- `.env.local`: 로컬 개발 환경 변수
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)
- Vercel 대시보드에서 프로덕션 환경 변수 관리

## 4. 프로젝트 구조

### 디렉토리 구조
```
/app                    # Next.js App Router
  /(super)             # 슈퍼 관리자 라우트 그룹
  /(agency)            # 에이전시 라우트 그룹
  /(client)            # 클라이언트 라우트 그룹
  /(webinar)           # 웨비나 라우트 그룹
  /api                 # API Route Handlers
  /login               # 로그인 페이지
  /signup              # 회원가입 페이지
/components            # React 컴포넌트
  /webinar             # 웨비나 관련 컴포넌트
  /ui                  # 재사용 가능한 UI 컴포넌트
  /layout              # 레이아웃 컴포넌트
/lib                   # 유틸리티 및 헬퍼
  /supabase            # Supabase 클라이언트 설정
  /auth                # 인증/권한 가드
/memory_bank           # 프로젝트 컨텍스트 문서
/supabase/migrations   # 데이터베이스 마이그레이션 파일
```

### 파일 명명 규칙
- **페이지**: `page.tsx` (Next.js App Router 규칙)
- **레이아웃**: `layout.tsx`
- **API 라우트**: `route.ts`
- **컴포넌트**: PascalCase (예: `WebinarView.tsx`)
- **유틸리티**: camelCase (예: `getUserDashboard.ts`)

## 5. 주요 설정 파일

### Next.js 설정
- `next.config.ts`: Next.js 설정
  - 이미지 도메인 설정 (필요시)
  - 환경 변수 설정

### TypeScript 설정
- `tsconfig.json`: TypeScript 컴파일러 설정
  - 경로 별칭 (`@/` → 프로젝트 루트)
  - 엄격한 타입 체크

### Tailwind CSS 설정
- `tailwind.config.ts`: Tailwind CSS 설정
  - 컨텐츠 경로 설정
  - 커스텀 테마 설정 (필요시)

### ESLint 설정
- `.eslintrc.json`: ESLint 규칙 설정
  - Next.js 기본 규칙
  - TypeScript 규칙

## 6. 의존성 관리

### 주요 의존성
```json
{
  "next": "15.5.6",
  "react": "^18.x",
  "react-dom": "^18.x",
  "@supabase/ssr": "최신",
  "@supabase/supabase-js": "최신"
}
```

### 개발 의존성
- TypeScript
- ESLint
- Tailwind CSS
- PostCSS

## 7. 브라우저 지원
- **모던 브라우저**: Chrome, Firefox, Safari, Edge 최신 버전
- **모바일**: iOS Safari, Chrome Mobile
- **전체화면 API**: 브라우저 네이티브 Fullscreen API 사용

## 8. 성능 고려사항
- **코드 스플리팅**: Next.js 자동 코드 스플리팅
- **이미지 최적화**: Next.js Image 컴포넌트 (필요시)
- **서버 사이드 렌더링**: Server Components 활용
- **클라이언트 사이드 렌더링**: 필요한 경우만 `'use client'` 사용

## 9. 보안 고려사항
- **환경 변수**: 서버 전용 키는 클라이언트에 노출 금지
- **RLS**: 데이터베이스 레벨 보안
- **CSP**: Content Security Policy (설정 예정)
- **XSS 방지**: React 자동 이스케이핑

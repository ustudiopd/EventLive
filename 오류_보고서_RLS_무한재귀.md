# 오류 보고서: Profiles 테이블 RLS 무한 재귀 문제

## 📋 요약

**오류 유형**: PostgreSQL RLS (Row Level Security) 무한 재귀  
**영향 범위**: `profiles` 테이블 조회 시 500 Internal Server Error  
**심각도**: 🔴 Critical  
**발생 일시**: 2025-11-17  
**상태**: ⚠️ 해결 중

---

## 🔍 문제 상세

### 오류 메시지
```
GET https://yqsayphssjznthrxpgfb.supabase.co/rest/v1/profiles?select=is_super_admin&id=eq.048647df-69ea-4a94-b16a-0528bd034d42
500 (Internal Server Error)
```

### 데이터베이스 로그
```
ERROR: infinite recursion detected in policy for relation "profiles"
```

### 발생 위치
- **클라이언트 측**: `app/page.tsx` (56-60번째 줄)
- **서버 측**: `middleware.ts`, `lib/auth/guards.ts`, `app/api/auth/dashboard/route.ts`

---

## 🔬 원인 분석

### 근본 원인
1. **RLS 정책 순환 참조**
   - `profiles` 테이블의 RLS 정책이 `is_super_admin()` 함수를 호출
   - `is_super_admin()` 함수 내부에서 `profiles` 테이블을 조회
   - Supabase에서는 `security definer` 함수도 RLS가 적용되어 순환 참조 발생

2. **Supabase의 RLS 동작 방식**
   - `security definer` 함수가 `postgres` 역할로 실행되어도 RLS는 여전히 적용됨
   - 함수 내부에서 테이블 조회 시 RLS 정책이 다시 평가됨
   - RLS 정책이 함수를 호출하면 무한 재귀 발생

### 시도한 해결 방법
1. ✅ `public.me` 뷰 생성 → 실패 (순환 참조)
2. ✅ `is_super_admin()` 함수 생성 (`security definer`) → 실패 (RLS 우회 안 됨)
3. ✅ 함수 소유자를 `postgres`로 변경 → 실패 (RLS 여전히 적용)
4. ✅ `execute format` 사용 → 실패 (RLS 우회 안 됨)
5. ✅ 슈퍼어드민 RLS 정책 제거 → **부분 성공** (순환 참조는 해결, 하지만 여전히 에러 발생)

---

## 📊 영향 받는 코드

### 1. 클라이언트 측 (`app/page.tsx`)
```typescript
// 56-60번째 줄
const profileResponse = await supabase
  .from('profiles')
  .select('is_super_admin')
  .eq('id', currentUser.id)
  .maybeSingle()
```

### 2. 서버 측 미들웨어 (`middleware.ts`)
```typescript
// 39-43번째 줄
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('is_super_admin')
  .eq('id', user.id)
  .maybeSingle()
```

### 3. 인증 가드 (`lib/auth/guards.ts`)
```typescript
// requireSuperAdmin, requireAgencyMember, requireClientMember 함수에서
// profiles 테이블 조회 시 동일한 문제 발생
```

---

## 🛠️ 해결 방안

### 즉시 해결 (권장)

#### 1. 클라이언트 측 코드 수정
- `app/page.tsx`에서 직접 `profiles` 테이블 조회 제거
- 서버 측 API (`/api/auth/dashboard`)를 통해서만 슈퍼어드민 여부 확인

#### 2. 서버 측 코드 수정
- `middleware.ts`에서 `profiles` 테이블 직접 조회 제거
- 서버 측에서만 Admin Supabase를 사용하여 조회
- 또는 JWT 토큰에 `is_super_admin` 정보 포함 (권장)

#### 3. RLS 정책 단순화
- 슈퍼어드민 관련 RLS 정책 완전 제거
- 모든 슈퍼어드민 권한 확인을 서버 측에서만 수행

### 장기 해결

#### 1. JWT 클레임 활용
- 사용자 로그인 시 JWT 토큰에 `is_super_admin` 정보 포함
- 클라이언트/서버 모두 JWT에서 권한 정보 확인
- RLS 정책에서 JWT 클레임 사용

#### 2. 별도 권한 테이블
- `profiles` 테이블과 분리된 권한 테이블 생성
- RLS 정책에서 순환 참조 없이 권한 확인

---

## 📝 권장 조치 사항

### 우선순위 1 (즉시)
1. ✅ `app/page.tsx`에서 클라이언트 측 `profiles` 조회 제거
2. ✅ `middleware.ts`에서 서버 측 Admin Supabase 사용
3. ✅ 모든 슈퍼어드민 권한 확인을 서버 측 API로 이동

### 우선순위 2 (단기)
1. JWT 클레임에 `is_super_admin` 정보 추가
2. 클라이언트 측에서 JWT 토큰으로 권한 확인
3. RLS 정책 단순화 및 최적화

### 우선순위 3 (장기)
1. 권한 관리 시스템 재설계
2. RLS 정책 최적화 및 성능 개선
3. 모니터링 및 알림 시스템 구축

---

## 🔄 현재 상태

### 완료된 작업
- ✅ 슈퍼어드민 RLS 정책 제거
- ✅ 마이그레이션 파일 업데이트

### 진행 중인 작업
- ⚠️ 클라이언트 측 코드 수정 필요
- ⚠️ 서버 측 코드 최적화 필요

### 남은 작업
- ❌ `app/page.tsx` 클라이언트 측 조회 제거
- ❌ `middleware.ts` 서버 측 최적화
- ❌ JWT 클레임 추가 (선택사항)

---

## 📚 참고 자료

### 관련 파일
- `supabase/migrations/024_fix_profiles_rls_recursion.sql`
- `supabase/migrations/remove_superadmin_rls_policy.sql`
- `app/page.tsx`
- `middleware.ts`
- `lib/auth/guards.ts`
- `app/api/auth/dashboard/route.ts`

### Supabase 문서
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Security Definer Functions](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)

---

## 📞 문의

문제가 지속되거나 추가 지원이 필요한 경우:
1. Supabase 로그 확인: `mcp_supabase_get_logs`
2. 데이터베이스 상태 확인: `mcp_supabase_execute_sql`
3. 마이그레이션 상태 확인: `mcp_supabase_list_migrations`

---

**작성일**: 2025-11-17  
**작성자**: AI Assistant  
**버전**: 1.0


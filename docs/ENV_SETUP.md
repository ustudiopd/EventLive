# 환경 변수 설정 가이드

EventLive 프로젝트에서 필요한 환경 변수 설정 방법입니다.

## 📋 필수 환경 변수 목록

### 1. Supabase 설정 (필수)
```env
NEXT_PUBLIC_SUPABASE_URL=https://yqsayphssjznthrxpgfb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. 크론 작업 설정 (통계 기능용, 필수)
```env
CRON_SECRET=your_random_secret_string
```

**참고:** Vercel Cron은 자동으로 인증 헤더를 추가하지만, 로컬 테스트를 위해 `CRON_SECRET`을 설정합니다.

### 3. 앱 URL (선택사항)
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. 이메일 발송 설정 (선택사항)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=admin@modoolecture.com
SMTP_PASS="앱_비밀번호"
```

---

## 🖥️ 로컬 개발 환경 설정

### 1. `.env.local` 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 아래 내용을 추가하세요:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://yqsayphssjznthrxpgfb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 크론 시크릿 (랜덤 문자열 생성)
CRON_SECRET=your_random_secret_string_here

# 앱 URL (로컬 개발)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 이메일 설정 (선택사항)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS="your_app_password"
```

### 2. CRON_SECRET 생성 방법

터미널에서 다음 명령어로 랜덤 시크릿을 생성할 수 있습니다:

**macOS/Linux:**
```bash
openssl rand -hex 32
```

**Windows PowerShell:**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

또는 온라인 도구를 사용하여 랜덤 문자열을 생성할 수 있습니다.

### 3. Supabase 키 확인 방법

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. Settings → API 메뉴로 이동
4. 다음 키들을 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 공개하지 마세요!)

---

## ☁️ Vercel 프로덕션 환경 설정

### 1. Vercel 대시보드에서 설정

1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. 프로젝트 선택
3. **Settings** 탭 클릭
4. **Environment Variables** 섹션으로 이동
5. 아래 환경 변수들을 추가:

#### 필수 환경 변수

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yqsayphssjznthrxpgfb.supabase.co` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your_anon_key` | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_service_role_key` | Supabase 서비스 롤 키 (비밀) |
| `CRON_SECRET` | `your_random_secret` | 크론 작업 보안 시크릿 |

#### 선택적 환경 변수

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | 프로덕션 앱 URL |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 서버 호스트 |
| `SMTP_PORT` | `587` | SMTP 포트 |
| `SMTP_USER` | `your_email@gmail.com` | SMTP 사용자명 |
| `SMTP_PASS` | `your_app_password` | SMTP 앱 비밀번호 |

### 2. 환경별 설정 (Production, Preview, Development)

각 환경 변수는 다음 환경에 적용할 수 있습니다:
- ✅ **Production**: 프로덕션 배포에만 적용
- ✅ **Preview**: 프리뷰 배포에만 적용
- ✅ **Development**: 로컬 개발에만 적용

**권장 설정:**
- `CRON_SECRET`: Production만 체크 (프리뷰/개발에서는 크론이 실행되지 않음)
- `NEXT_PUBLIC_*`: 모든 환경 체크
- `SUPABASE_SERVICE_ROLE_KEY`: 모든 환경 체크
- `SMTP_*`: Production만 체크 (선택사항)

### 3. Vercel CLI로 설정 (선택사항)

터미널에서 Vercel CLI를 사용하여 환경 변수를 설정할 수도 있습니다:

```bash
# Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# 프로젝트에 로그인
vercel login

# 환경 변수 추가
vercel env add CRON_SECRET production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

---

## 🔒 보안 주의사항

### 절대 공개하지 말아야 할 환경 변수

1. **`SUPABASE_SERVICE_ROLE_KEY`**
   - 데이터베이스 전체 접근 권한을 가진 키
   - RLS를 우회할 수 있음
   - 절대 Git에 커밋하지 마세요!

2. **`CRON_SECRET`**
   - 크론 작업 보안을 위한 시크릿
   - 외부에 노출되면 크론 작업이 악용될 수 있음

3. **`SMTP_PASS`**
   - 이메일 발송용 앱 비밀번호
   - 계정 보안과 직결됨

### `.gitignore` 확인

프로젝트 루트의 `.gitignore` 파일에 다음이 포함되어 있는지 확인하세요:

```
.env*.local
.env
```

---

## ✅ 환경 변수 확인 방법

### 로컬 개발 환경

환경 변수가 제대로 설정되었는지 확인:

```bash
# Node.js에서 확인
node -e "console.log(process.env.CRON_SECRET ? 'CRON_SECRET 설정됨' : 'CRON_SECRET 없음')"
```

### Vercel 프로덕션 환경

1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. 설정된 환경 변수 목록 확인
3. 배포 후 Vercel Functions 로그에서 확인 가능

---

## 🧪 테스트

### 크론 작업 테스트

로컬에서 크론 작업을 테스트하려면:

```bash
# 터미널에서 직접 호출 (secret 파라미터 사용)
curl "http://localhost:3000/api/cron/webinar-access-snapshot?secret=your_cron_secret"

# 또는 Authorization 헤더 사용
curl -H "Authorization: Bearer your_cron_secret" \
  "http://localhost:3000/api/cron/webinar-access-snapshot"
```

성공 시 `204 No Content` 응답이 반환됩니다.

**Vercel 프로덕션:**
- Vercel Cron은 자동으로 인증 헤더를 추가하므로 별도 설정 불필요
- Vercel Dashboard → 프로젝트 → Settings → Cron Jobs에서 실행 상태 확인 가능

---

## 📝 체크리스트

환경 변수 설정 완료 체크리스트:

- [ ] `.env.local` 파일 생성 (로컬 개발용)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 설정
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 설정
- [ ] `CRON_SECRET` 생성 및 설정
- [ ] Vercel 프로덕션 환경 변수 설정
- [ ] `.gitignore`에 `.env*.local` 포함 확인
- [ ] 환경 변수 테스트 완료

---

## 🆘 문제 해결

### 환경 변수가 적용되지 않는 경우

1. **로컬 개발:**
   - `.env.local` 파일이 프로젝트 루트에 있는지 확인
   - 개발 서버를 재시작 (`npm run dev`)
   - 파일명이 정확한지 확인 (`.env.local`, `.env` 등)

2. **Vercel 프로덕션:**
   - 환경 변수 설정 후 **재배포** 필요
   - Settings → Environment Variables에서 값 확인
   - 배포 로그에서 환경 변수 로드 확인

### 크론 작업이 실행되지 않는 경우

1. `CRON_SECRET` 환경 변수가 설정되었는지 확인
2. `vercel.json`에 크론 스케줄이 올바르게 설정되었는지 확인
3. Vercel Functions 로그에서 오류 확인

---

## 📚 참고 자료

- [Vercel Environment Variables 문서](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase API Keys 문서](https://supabase.com/docs/guides/api/api-keys)
- [Next.js Environment Variables 문서](https://nextjs.org/docs/basic-features/environment-variables)





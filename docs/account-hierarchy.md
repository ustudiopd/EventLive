# 계정 계층 구조 명세서

## 1. 전체 계층 구조

```
┌─────────────────────────────────────────┐
│     슈퍼 관리자 (Super Admin)           │
│     profiles.is_super_admin = true     │
└─────────────────────────────────────────┘
                    │
                    │ 관리
                    ▼
┌─────────────────────────────────────────┐
│     에이전시 (Agency)                    │
│     agencies 테이블                     │
│     └─ agency_members (멤버십)         │
└─────────────────────────────────────────┘
                    │
                    │ 소유
                    ▼
┌─────────────────────────────────────────┐
│     클라이언트 (Client)                 │
│     clients 테이블                      │
│     └─ client_members (멤버십)          │
└─────────────────────────────────────────┘
                    │
                    │ 생성
                    ▼
┌─────────────────────────────────────────┐
│     웨비나 (Webinar)                    │
│     webinars 테이블                     │
│     └─ registrations (참여자 등록)     │
└─────────────────────────────────────────┘
                    │
                    │ 참여
                    ▼
┌─────────────────────────────────────────┐
│     참여자 (Participant)                │
│     registrations 테이블                │
└─────────────────────────────────────────┘
```

---

## 2. 계층별 상세 설명

### 2.1 슈퍼 관리자 (Super Admin)

**테이블**: `profiles`
- **식별**: `is_super_admin = true`
- **저장 위치**: 
  - `profiles.is_super_admin` (데이터베이스)
  - `auth.users.app_metadata.is_super_admin` (JWT 토큰)

**권한**:
- ✅ 모든 에이전시 관리 (생성/수정/삭제)
- ✅ 모든 클라이언트 관리
- ✅ 모든 웨비나 접근 및 관리
- ✅ 전사 통계 조회
- ✅ 모든 사용자 프로필 관리
- ✅ 감사 로그 조회

**접근 경로**: `/super/*`

**설정 방법**:
- API: `/api/admin/set-super-admin` (슈퍼 관리자만 가능)
- JWT와 DB 동기화 필요 (재로그인 권장)

---

### 2.2 에이전시 (Agency)

**테이블**: 
- `agencies` (에이전시 정보)
- `agency_members` (멤버십 관계)

**멤버십 역할** (`agency_members.role`):
1. **`owner`** (소유자)
   - 에이전시 완전 소유
   - 클라이언트 생성/삭제
   - 멤버 초대/관리
   - 모든 기능 접근

2. **`admin`** (관리자)
   - 클라이언트 생성/관리
   - 멤버 초대/관리
   - 리포트 조회
   - 웨비나 운영 콘솔 접근 가능

3. **`analyst`** (분석가)
   - 리포트 조회만 가능
   - 데이터 수정 불가

**권한**:
- ✅ 소속 클라이언트 관리
- ✅ 클라이언트 생성/초대
- ✅ 소속 클라이언트의 웨비나 생성 (owner/admin만)
- ✅ 소속 클라이언트의 웨비나 운영 콘솔 접근 (owner/admin만)
- ✅ 리포트 조회
- ✅ 도메인 관리

**접근 경로**: `/agency/[agencyId]/*`

**특징**:
- 한 사용자가 여러 에이전시에 다른 역할로 참여 가능
- 에이전시 멤버는 소속 클라이언트의 대시보드에 `viewer` 역할로 접근 가능

---

### 2.3 클라이언트 (Client)

**테이블**:
- `clients` (클라이언트 정보)
- `client_members` (멤버십 관계)

**멤버십 역할** (`client_members.role`):
1. **`owner`** (소유자)
   - 클라이언트 완전 소유
   - 웨비나 생성/삭제
   - 멤버 초대/관리
   - 브랜딩 설정
   - 모든 기능 접근

2. **`admin`** (관리자)
   - 웨비나 생성/관리
   - 멤버 초대/관리
   - 브랜딩 설정
   - 웨비나 운영 콘솔 접근

3. **`operator`** (운영자)
   - 웨비나 생성/관리
   - 웨비나 운영 콘솔 접근
   - 실시간 상호작용 관리 (채팅, Q&A, 퀴즈, 추첨)

4. **`analyst`** (분석가)
   - 리포트 조회만 가능
   - 데이터 수정 불가

5. **`member`** (멤버)
   - 웨비나 운영 콘솔 접근 가능
   - 기본 조회 권한

**권한**:
- ✅ 웨비나 생성/관리
- ✅ 웨비나 운영 콘솔 접근 (owner/admin/operator/member)
- ✅ 실시간 상호작용 관리 (채팅, Q&A, 퀴즈, 추첨)
- ✅ 브랜딩 설정 (owner/admin만)
- ✅ 가입계정 관리 (owner/admin만)
- ✅ 리포트 조회

**접근 경로**: `/client/[clientId]/*`

**특징**:
- 한 사용자가 여러 클라이언트에 다른 역할로 참여 가능
- 클라이언트는 반드시 하나의 에이전시에 소속됨 (`clients.agency_id`)

---

### 2.4 참여자 (Participant)

**테이블**: `registrations`

**역할**:
- 웨비나에 등록된 사용자
- 특정 역할 없음 (모든 참여자는 동일한 권한)

**권한**:
- ✅ 웨비나 시청
- ✅ 실시간 채팅 참여
- ✅ Q&A 질문 등록
- ✅ 퀴즈/설문 참여
- ✅ 추첨 참여
- ✅ 파일 다운로드

**접근 경로**: `/webinar/[id]` 또는 `/webinar/[id]/live`

**등록 방법**:
1. **이메일 링크** (`registered_via = 'email'`)
   - 이메일로 받은 등록 링크 클릭
   - 자동 등록 및 안내 메일 발송

2. **수동 등록** (`registered_via = 'manual'`)
   - 웨비나 페이지에서 직접 등록
   - 또는 관리자가 수동으로 등록

3. **초대 링크** (`registered_via = 'invite'`)
   - 초대 토큰을 통한 등록

**접근 정책** (`webinars.access_policy`):
- `auth`: 로그인 필수
- `email_auth`: 등록된 이메일만 접근 가능
- `guest_allowed`: 게스트 허용 (미구현)
- `invite_only`: 초대 전용 (미구현)

---

## 3. 권한 상속 관계

### 3.1 슈퍼 관리자
- 모든 권한 상속
- 모든 계층의 모든 기능 접근 가능

### 3.2 에이전시 멤버 → 클라이언트 접근
- 에이전시 `owner/admin`은 소속 클라이언트의 웨비나 운영 콘솔 접근 가능
- 에이전시 멤버는 클라이언트 대시보드에 `viewer` 역할로 접근 가능

### 3.3 클라이언트 멤버 → 웨비나 접근
- 클라이언트 `owner/admin/operator/member`는 소속 웨비나 운영 콘솔 접근 가능
- 클라이언트 멤버는 웨비나에 자동으로 등록됨 (선택적)

---

## 4. 데이터 격리

### 4.1 RLS (Row Level Security)
- 모든 테이블에 RLS 정책 적용
- 사용자는 자신이 속한 조직의 데이터만 접근 가능
- 슈퍼 관리자는 모든 데이터 접근 가능

### 4.2 조직 필드 자동 채움
- 모든 상호작용 데이터 (`messages`, `questions`, `forms`, `giveaways` 등)는
- `webinar_id`만 제공하면 트리거가 `agency_id`, `client_id` 자동 채움

### 4.3 데이터 소유권
- 웨비나: `agency_id`, `client_id`로 소유권 결정
- 메시지/질문: `webinar_id` → `agency_id`, `client_id` 자동 연결
- 폼/퀴즈/추첨: `webinar_id` → `agency_id`, `client_id` 자동 연결

---

## 5. 멤버십 관계

### 5.1 다대다 관계
- 한 사용자가 여러 에이전시에 참여 가능
- 한 사용자가 여러 클라이언트에 참여 가능
- 각 조직에서 다른 역할을 가질 수 있음

### 5.2 멤버십 테이블

**`agency_members`**:
```sql
- agency_id (UUID)
- user_id (UUID)
- role ('owner', 'admin', 'analyst')
- created_at
- PRIMARY KEY (agency_id, user_id)
```

**`client_members`**:
```sql
- client_id (UUID)
- user_id (UUID)
- role ('owner', 'admin', 'operator', 'analyst', 'member')
- created_at
- PRIMARY KEY (client_id, user_id)
```

---

## 6. 권한 확인 함수

### 6.1 서버 사이드 가드
- `requireSuperAdmin()`: 슈퍼 관리자만
- `requireAgencyMember(agencyId, roles)`: 에이전시 멤버 (기본: owner, admin)
- `requireClientMember(clientId, roles)`: 클라이언트 멤버 (기본: owner, admin, operator, member)

### 6.2 권한 확인 로직
1. JWT `app_metadata.is_super_admin` 확인 (RLS 재귀 방지)
2. 없으면 `profiles.is_super_admin` 확인 (fallback)
3. 슈퍼 관리자가 아니면 멤버십 테이블 확인
4. 권한 없으면 리다이렉트 또는 403 에러

---

## 7. 대시보드 라우팅

### 7.1 자동 라우팅 우선순위
1. 슈퍼 관리자 → `/super/dashboard`
2. 에이전시 멤버 → `/agency/[첫번째_에이전시_id]/dashboard`
3. 클라이언트 멤버 → `/client/[첫번째_클라이언트_id]/dashboard`
4. 권한 없음 → `/` (홈)

### 7.2 모드 전환
- 사이드바에서 대행사/클라이언트 모드 전환 가능
- 사용자가 속한 모든 조직 목록 표시
- 클릭 시 해당 조직의 대시보드로 이동

---

## 8. 참여자 등록

### 8.1 등록 출처 (`registrations.registered_via`)
- `'email'`: 이메일 링크로 등록
- `'manual'`: 수동 등록
- `'invite'`: 초대 링크로 등록

### 8.2 등록 프로세스
1. 이메일 링크 클릭 → `webinar_allowed_emails` 확인 → 자동 등록 (`registered_via = 'email'`)
2. 웨비나 페이지에서 직접 등록 → `registered_via = 'manual'`
3. 초대 토큰 사용 → `registered_via = 'invite'`

---

## 9. 요약

| 계층 | 테이블 | 역할 | 주요 권한 |
|------|--------|------|----------|
| **슈퍼 관리자** | `profiles.is_super_admin` | - | 모든 데이터 접근 |
| **에이전시** | `agency_members` | owner, admin, analyst | 클라이언트 관리, 리포트 조회 |
| **클라이언트** | `client_members` | owner, admin, operator, analyst, member | 웨비나 생성/운영, 브랜딩 |
| **참여자** | `registrations` | - | 웨비나 시청, 상호작용 참여 |

---

## 10. 현재 구현 상태

✅ **구현 완료**:
- 슈퍼 관리자 시스템
- 에이전시 멤버십
- 클라이언트 멤버십
- 참여자 등록
- 권한 기반 접근 제어
- RLS 정책
- 대시보드 자동 라우팅
- 모드 전환 기능

⚠️ **부분 구현**:
- 게스트 모드 (`guest_allowed`)
- 초대 전용 모드 (`invite_only`)





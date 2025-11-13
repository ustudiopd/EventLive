# EventLive.ai 개발 현황 및 남은 작업

## ✅ 완료된 작업

### Phase 1 - 멀티테넌시 코어
- ✅ 데이터베이스 스키마 (agencies, clients, profiles, memberships)
- ✅ RLS 정책 구현
- ✅ 인증/권한 가드 시스템 (`lib/auth/guards.ts`)
- ✅ 슈퍼 관리자 에이전시 생성 API
- ✅ 기본 대시보드 스켈레톤

### Phase 2 - 에이전시/클라이언트 대시보드
- ✅ 에이전시 회원가입 (`/signup/agency`)
- ✅ 클라이언트 회원가입 (`/signup/client`)
- ✅ 에이전시 대시보드 (`/agency/[agencyId]/dashboard`)
- ✅ 클라이언트 대시보드 (`/client/[clientId]/dashboard`)
- ✅ 클라이언트 생성/관리 (`/agency/[agencyId]/clients`)
- ✅ 클라이언트 초대 기능 (`/api/clients/invite`)
- ✅ 브랜딩 설정 (`/client/[clientId]/settings/branding`)
- ✅ 통계 대시보드 (`/agency/[agencyId]/reports`)
- ✅ CSV 내보내기 (`/api/report/export`)
- ✅ 도메인 관리 (`/agency/[agencyId]/domains`)
- ✅ UI/UX 개선 (Tailwind CSS 적용)

## ❌ 미완료 작업

### Phase 3 - 웨비나 및 실시간 기능 (우선순위 높음)

#### 1. 웨비나 생성/관리
- ❌ 웨비나 생성 페이지 (`/client/[clientId]/webinars/new`)
- ❌ 웨비나 생성 API (`/api/webinars/create`)
- ❌ 웨비나 수정 기능
- ❌ 웨비나 목록 페이지 (`/client/[clientId]/webinars`)
- ❌ 웨비나 삭제 기능

#### 2. 웨비나 시청 페이지
- ❌ 웨비나 시청 페이지 (`/webinar/[id]`)
  - YouTube 임베드
  - 실시간 채팅 (`components/Chat.tsx`)
  - Q&A 시스템 (`components/QA.tsx`)
  - 이모지 리액션 (`components/Reactions.tsx`)
  - Presence/Typing 표시 (`components/PresenceBar.tsx`)

#### 3. 운영 콘솔
- ❌ 운영 콘솔 페이지 (`/webinar/[id]/console`)
  - Q&A 모더레이션 (상단 고정/답변/숨김)
  - 퀴즈 출제/관리 (`components/Quiz.tsx`)
  - 경품 추첨 (`components/DrawToast.tsx`)
  - 채팅 관리 (숨김/차단/타임아웃)

#### 4. 실시간 기능
- ❌ Supabase Realtime 구독 설정
  - 메시지 실시간 업데이트
  - 질문 실시간 업데이트
  - 퀴즈 상태 실시간 업데이트
  - 추첨 결과 실시간 알림
- ❌ Broadcast/Presence 채널 (`presence:webinar-{id}`)
- ❌ Typing 표시 기능

#### 5. 참여자 등록
- ❌ 웨비나 등록 페이지 (`/webinar/[id]/register`)
- ❌ 게스트 모드 (닉네임만으로 입장)
- ❌ 초대 링크 처리 (`/invite/[token]`)

### Phase 4 - 이벤트 로직 고도화 & 리포트

#### 1. 퀴즈 기능
- ❌ 퀴즈 출제 API (`/api/quiz/launch`)
- ❌ 퀴즈 응답 처리
- ❌ 퀴즈 정답 공개
- ❌ 퀴즈 정답자 집계

#### 2. 추첨 기능
- ❌ 추첨 실행 API (`/api/draw/run`)
- ❌ 추첨 재현성 보고
- ❌ 당첨자 알림

#### 3. 리포트
- ❌ 참여/체류/행동 리포트
- ❌ 리포트 자동 발송

## 📋 우선순위별 작업 목록

### 🔴 긴급 (즉시 필요)
1. **웨비나 생성 기능**
   - `/client/[clientId]/webinars/new` 페이지
   - `/api/webinars/create` API
   - 웨비나 목록 페이지

2. **웨비나 시청 페이지 기본 구조**
   - `/webinar/[id]` 페이지
   - YouTube 임베드
   - 기본 레이아웃

### 🟡 중요 (다음 단계)
3. **실시간 채팅**
   - 채팅 컴포넌트
   - 실시간 메시지 구독
   - 메시지 전송 API

4. **Q&A 시스템**
   - 질문 등록/조회
   - 실시간 질문 업데이트

5. **운영 콘솔 기본 구조**
   - `/webinar/[id]/console` 페이지
   - 기본 레이아웃

### 🟢 일반 (추후)
6. **퀴즈 기능**
7. **추첨 기능**
8. **이모지 리액션**
9. **Presence/Typing**
10. **모더레이션 기능**

## 📝 참고사항

- 웨비나 생성은 클라이언트 대시보드에서 "웨비나 생성" 버튼이 있지만 실제 페이지가 없음
- 모든 실시간 기능은 Supabase Realtime을 사용
- 참여자는 게스트 모드로도 입장 가능해야 함


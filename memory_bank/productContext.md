# 비즈니스 로직 및 기능 동작 (Product Context)

## 서비스 정보
- **서비스 이름**: EventFlow
- **도메인**: EventFlow.kr
- **설명**: B2B2C 멀티테넌시 웨비나 플랫폼

## 1. 핵심 비즈니스 로직  

### 멀티테넌시 계층 구조
- **슈퍼 관리자** → **에이전시** → **클라이언트** → **참여자** 계층 구조
- 모든 데이터는 `agency_id`와 `client_id`로 격리됨
- RLS 정책으로 데이터 접근 제어

### 권한 체계
- **슈퍼 관리자**: 모든 데이터 접근 가능 (`is_super_admin` 플래그)
- **에이전시 멤버**: 
  - `owner`, `admin`: 소속 클라이언트의 웨비나 생성/관리 가능
  - `analyst`: 조회만 가능
- **클라이언트 멤버**:
  - `owner`, `admin`, `operator`: 웨비나 생성/운영 가능
  - `analyst`: 조회만 가능
- **참여자**: 웨비나 등록 후 시청 및 상호작용 가능

### 데이터 자동 채움
- `webinar_id`만 제공하면 트리거가 `agency_id`, `client_id` 자동 채움
- 메시지, 질문, 퀴즈, 추첨 등 모든 상호작용 데이터에 적용

## 2. 주요 기능별 동작 시나리오  

### [기능 1: 웨비나 생성]
1. 클라이언트 멤버(owner/admin/operator) 또는 에이전시 멤버(owner/admin)가 웨비나 생성 페이지 접근
2. 제목, 설명, YouTube URL, 일정, 접근 정책 입력
3. `/api/webinars/create` API 호출
4. 서버에서 권한 확인 후 `webinars` 테이블에 저장
5. 감사 로그 기록 (`audit_logs`)

### [기능 2: 웨비나 시청]
1. 참여자가 웨비나 URL 접근 (`/webinar/[id]`)
2. 접근 정책 확인:
   - `auth`: 로그인 필수
   - `guest_allowed`: 게스트 허용 (미구현)
   - `invite_only`: 초대 전용 (미구현)
3. YouTube 플레이어 임베드 표시
4. 실시간 채팅, Q&A, PresenceBar 표시
5. 전체화면 버튼 클릭 시 브라우저 네이티브 Fullscreen API 사용

### [기능 3: 실시간 채팅]
1. 참여자가 메시지 입력 후 전송
2. `/api/messages/create` API 호출
3. 서버에서 웨비나 정보 조회 후 `agency_id`, `client_id` 자동 채움
4. `messages` 테이블에 저장
5. Supabase Realtime으로 모든 참여자에게 실시간 전파
6. 채팅 컴포넌트가 DB 변경 구독하여 자동 업데이트

### [기능 4: Q&A 시스템]
1. 참여자가 질문 등록 (`/api/questions/create`)
2. 운영자가 운영 콘솔에서 질문 확인
3. 운영자가 질문 고정/답변/숨김 처리 (`/api/questions/[questionId]` PATCH)
4. 실시간으로 질문 상태 업데이트

### [기능 5: Presence (참여자 표시)]
1. 사용자가 웨비나 페이지 접근 시 Supabase Presence 채널에 참여
2. `presence:webinar-{id}` 채널에 사용자 정보 트랙
3. Presence sync 이벤트로 참여자 목록 업데이트
4. Map 기반 중복 제거로 동일 사용자 ID 중복 방지
5. 참여자 수 및 목록 실시간 표시

### [기능 6: 웨비나 수정/삭제]
1. 클라이언트 멤버(owner/admin/operator) 또는 에이전시 멤버(owner/admin)가 수정/삭제 요청
2. `/api/webinars/[webinarId]` PUT/DELETE API 호출
3. 서버에서 권한 확인
4. 수정: `webinars` 테이블 업데이트
5. 삭제: `webinars` 테이블에서 삭제 (CASCADE로 관련 데이터도 삭제)
6. 감사 로그 기록

### [기능 7: 운영 콘솔]
1. 클라이언트 멤버(owner/admin/operator)가 `/webinar/[id]/console` 접근
2. Q&A 모더레이션 탭에서 질문 목록 확인 및 관리
3. 채팅 관리 탭에서 메시지 목록 확인 및 숨김 처리
4. 퀴즈/추첨 탭은 현재 플레이스홀더만 존재 (미구현)

## 3. 데이터 흐름

### 웨비나 생성 흐름
```
클라이언트 → API → 권한 확인 → DB 저장 → 감사 로그
```

### 실시간 상호작용 흐름
```
참여자 입력 → API → DB 저장 → Realtime 전파 → 모든 참여자 업데이트
```

### 권한 확인 흐름
```
요청 → requireAuth() → requireClientMember() → RLS 정책 확인 → 데이터 접근
```

## 4. 보안 정책

### RLS (Row Level Security)
- 모든 테이블에 RLS 활성화
- 슈퍼 관리자: 전행 접근 허용
- 에이전시/클라이언트 멤버: 소속 조직 데이터만 접근
- 참여자: 등록한 웨비나 데이터만 접근

### API 권한 체크
- 모든 API 라우트에서 애플리케이션 레벨 권한 확인
- Admin Supabase로 데이터 조회 후 권한 체크
- 권한 없으면 403 Forbidden 반환

## 5. 실시간 기능

### Supabase Realtime 구독
- **DB Changes**: `messages`, `questions`, `quizzes`, `quiz_responses`, `draws`, `winners`, `reactions` 테이블 변경 구독
- **Realtime 활성화**: `supabase_realtime` publication에 테이블 추가됨
- **Presence**: `presence:webinar-{id}` 채널로 참여자 추적
- **Broadcast**: 타이핑, 알림 등 휘발 이벤트 (미구현)
- **채널 관리**: 고유한 채널 이름 생성 (타임스탬프 포함), cleanup 로직 개선

## 6. 설문조사 캠페인 기능 (완료)

### 설문조사 캠페인 관리
- 설문조사 캠페인 생성/수정/삭제 (`/client/[clientId]/surveys/new`)
- 설문조사 목록 조회 (통합 대시보드)
- 설문조사 운영 콘솔 (개요, 폼 관리, 공개페이지 설정, 참여자 관리, 설정)
- 폼 관리 및 미리보기 기능

### 공개 설문 페이지
- 웰컴 페이지 (`/event/{public_path}`)
- 설문 페이지 (`/event/{public_path}/survey`)
- 완료 페이지 (`/event/{public_path}/done`)
- 디스플레이 페이지 (`/event/{public_path}/display`)
- QR 코드 표시

### 설문 제출 및 관리
- 공개 설문 제출 (인증 불필요)
- 전화번호 기반 중복 참여 방지
- `survey_no` 자동 발급 (순차 번호)
- `code6` 6자리 확인 코드 생성
- 개인정보 동의 데이터 저장

### 폼 설정 시스템
- 기본 필드 설정 (회사명, 이름, 전화번호)
- 개인정보 동의 항목 설정
- 헤더 이미지 설정
- 문항 관리 (추가/수정/삭제)

## 7. 미구현 기능 (요구사항)

### 발표자료 다운로드 기능
- 파일 업로드 (웨비나 생성/수정 시)
- 파일 다운로드 (참여자)
- 파일 관리 (운영 콘솔)
- Supabase Storage 사용 필요

### 퀴즈 기능
- 퀴즈 출제 (운영 콘솔)
- 퀴즈 응답 (참여자)
- 퀴즈 정답 공개
- 퀴즈 통계

### 추첨 기능
- 추첨 실행 (운영 콘솔)
- 당첨자 알림 (참여자)
- 추첨 재현성 보고

### 참여자 등록
- 웨비나 등록 페이지
- 게스트 모드 (닉네임만으로 입장)
- 초대 링크 처리

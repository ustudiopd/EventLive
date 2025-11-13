# 현재 작업 상황 (Active Context)

## 1. 현재 집중하고 있는 작업  
- **작업명**: 실시간 채팅 및 프로필 표시 개선
- **목표**: 
  - 실시간 채팅이 즉시 업데이트되도록 Supabase Realtime 활성화
  - 채팅 메시지에서 사용자 이름이 정상적으로 표시되도록 개선
  - Optimistic Update에서 프로필 이름이 즉시 표시되도록 개선
- **상태**: ✅ 완료
  - Supabase Realtime 활성화 (messages, questions, quizzes 등 테이블)
  - 프로필 정보 조회 API 엔드포인트 생성 (`/api/profiles/[userId]`)
  - 채팅 컴포넌트에서 프로필 정보 즉시 로드 및 표시
  - PresenceBar에서 참여자 이름 표시 개선
  - 웨비나 입장 페이지 구현 (WebinarEntry)
  - 웨비나 자동 등록 기능 (`/api/webinars/[webinarId]/register`)

## 2. 다음 예정 작업  
- **우선순위 높음**: 
  1. 설문조사 기능 구현 (새로 요청됨)
     - 설문조사 생성/관리 (운영 콘솔)
     - 설문조사 응답 (참여자)
     - 설문조사 결과 조회/통계
  2. 발표자료 다운로드 기능 구현 (새로 요청됨)
     - 파일 업로드 (웨비나 생성/수정 시)
     - 파일 다운로드 (참여자)
     - 파일 관리 (운영 콘솔)
  3. 퀴즈 기능 구현
  4. 추첨 기능 구현

- **우선순위 중간**:
  5. 웨비나 등록 페이지
  6. 게스트 모드

- **우선순위 낮음**:
  7. 리포트 고도화
  8. Typing 표시 기능 완성

## 3. 주요 이슈 및 블로커  
- 현재 개발을 진행하는 데 방해가 되는 요소 없음
- 설문조사 및 발표자료 다운로드 기능에 대한 상세 요구사항 검토 필요

## 4. 최근 해결된 이슈
- ✅ PresenceBar 중복 사용자 표시 문제 해결 (Map 기반 중복 제거)
- ✅ RLS 무한 재귀 문제 해결 (Admin Supabase 사용)
- ✅ Next.js 15 호환성 문제 해결 (params, cookies await 처리)
- ✅ 4K 모니터 레이아웃 문제 해결
- ✅ 채팅 메시지 "익명" 표시 문제 해결 (프로필 RLS 정책 추가, API 엔드포인트 생성)
- ✅ Supabase Realtime 구독 오류 해결 (Realtime 활성화 마이그레이션 적용)
- ✅ 서버-클라이언트 바인딩 불일치 오류 해결 (고유한 채널 이름 생성)
- ✅ Optimistic Update에서 프로필 이름 즉시 표시 (프로필 정보 사전 로드)

## 5. 현재 시스템 상태
- **데이터베이스**: Supabase PostgreSQL (RLS 활성화)
- **인증**: Supabase Auth
- **실시간**: Supabase Realtime 활성화됨 (messages, questions, quizzes, quiz_responses, draws, winners, reactions 테이블)
- **스토리지**: Supabase Storage (아직 미사용, 발표자료 다운로드에 필요)
- **배포**: Vercel (로컬 개발 중)
- **최근 마이그레이션**: Realtime 활성화 (`enable_realtime_for_messages`)

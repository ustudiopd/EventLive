# 현재 작업 상황 (Active Context)

## 1. 현재 집중하고 있는 작업  
- **작업명**: Realtime 연결 안정성 근본 개선
- **목표**: 
  - "SUBSCRIBED → 바로 CLOSED" 루프 해소
  - 불필요한 폴백 활성화 방지
  - 실시간 연결 안정화 및 지연 최소화
- **상태**: ✅ 완료
  - 해결책.md의 5가지 수정안 모두 적용 완료
  - A: 수동 종료 플래그로 CLOSED 오인 방지
  - B: currentUser?.id 의존성 제거로 재구독 방지
  - C: 채널 상태 기준 헬스체크
  - D: 증분 조회 ETag 제거
  - E: 채널 정리 로직 간소화

## 2. 다음 예정 작업  
- **우선순위 높음**: 
  1. 웨비나 등록 페이지 구현 (`/webinar/[id]/register`)
  2. 초대 링크 처리 (`/invite/[token]`)
  3. 리포트 고도화 (퀴즈 통계, 추첨 재현성 보고)

- **우선순위 중간**:
  5. 웨비나 등록 페이지
  6. 초대 링크 처리 (`/invite/[token]`)

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
- ✅ 크롬에서 "전송 중..." 고착 문제 해결 (`client_msg_id` 기반 정확한 매칭, API 즉시 교체)
- ✅ Realtime 연결 안정성 향상 (토큰 주입, 폴백 폴링, 자동 재연결)
- ✅ 웨비나 페이지 모바일 레이아웃 문제 해결 (마진 제거, 전체 너비 사용)
- ✅ 관리자 모드 구현 (채팅/질문 관리 기능)
- ✅ Q&A 답변 기능 개선 (답변 내용 저장, 기본 펼침)
- ✅ 답변 모달 닫기 방지 (답변 중일 때)
- ✅ 게스트 계정 세션 설정 문제 해결 (`signInWithPassword` 사용)
- ✅ 메시지 조회 API 인증 오류 해결 (Route Handler 호환성 개선)
- ✅ 웨비나별 등록 확인 강제 (모든 모드에서 등록 확인)
- ✅ 웨비나 시간대 변환 문제 해결 (UTC ↔ 로컬 시간 변환)
- ✅ 설문 폼 로딩 성능 최적화 (병렬 쿼리, 인덱스 추가)
- ✅ 설문 질문 옵션 표시 문제 해결 (options 데이터 타입 처리)
- ✅ `fill_org_fields()` 트리거 오류 해결 (record "w" is not assigned yet)
- ✅ 설문 제출 시 org_fields 누락 문제 해결 (agency_id, client_id 컬럼 추가)
- ✅ 추첨 Seed 커밋-리빌 검증 제거 (바로 추첨 실행)
- ✅ 추첨 당첨자 이름 표시 기능 구현
- ✅ 추첨 실행 애니메이션 구현
- ✅ 메시지 전송 후 새로고침/초기화 문제 해결 (초기 로드 한 번만 실행, Realtime 재연결 시 메시지 유지)
- ✅ Realtime 연결 원인코드 로깅 강화 (채널 subscribe 콜백에서 상세 에러 정보 로깅)
- ✅ RLS 정책 분석 및 확인 (messages 테이블 RLS 정책 정상 작동 확인)
- ✅ Supabase Publication 설정 확인 (messages 테이블이 Realtime Publication에 포함됨 확인)
- ✅ messages 테이블 RLS 정책 단순화 적용 (성능 향상 및 RLS 재귀 방지)
  - JWT 기반 슈퍼어드민 판정 함수 생성 (`jwt_is_super_admin()`)
  - SELECT 정책: registrations 기반 얇은 ACL로 단순화
  - INSERT 정책: user_id 확인만 (등록 확인 제거)
  - UPDATE/DELETE 정책: JWT 기반 슈퍼어드민 확인
  - registrations 테이블 인덱스 추가 (성능 최적화)
- ✅ Realtime 연결 안정성 개선 완료
  - 재연결 로직 개선 (setTimeout cleanup으로 메모리 누수 방지)
  - 기존 채널 정리 개선 (비동기 대기로 중복 구독 방지)
  - Chat 컴포넌트 중복 렌더링 방지 (key prop으로 인스턴스 분리)
  - 채널 참조 관리 개선 (channelRef 사용)
- ✅ Broadcast 중심 아키텍처 전환 완료
  - Phase 1: `postgres_changes` → `broadcast` 전환 (RLS 영향 제거)
  - Phase 2: 서버 API에서 Broadcast 전파 구현 (권한 검증 강화)
  - Phase 3: 이벤트 타입 확장 (quiz, poll, raffle)
  - 재연결 로직 단순화 (SDK 자동 재연결 활용, 3회 실패 시 채널 제거)
  - 단일 채널(`webinar:${webinarId}`)로 모든 이벤트 타입 처리
- ✅ 폴백 폴링 성능 최적화 및 Vercel 프록시 우회
  - 폴백 폴링 지연 시간 대폭 단축 (15초 → 3~5초)
  - 헬스체크 대기 시간 단축 (10초 → 3초)
  - 폴링 주기 단축 (15초 → 2초)
  - 원본 Supabase URL 직접 사용 (Vercel 프록시 우회)
  - WebSocket 연결 안정화 (CLOSED 상태 반복 문제 해소)
- ✅ Realtime 연결 안정성 근본 개선 (해결책.md 5가지 수정안 적용)
  - A: 수동 종료 플래그로 CLOSED 오인 방지
  - B: currentUser?.id 의존성 제거로 의도치 않은 재구독 방지
  - C: 채널 상태 기준 헬스체크로 조용한 시간대 폴백 방지
  - D: 증분 조회 ETag 제거로 304 오인 방지
  - E: 채널 정리 로직 간소화로 경합 방지
  - "SUBSCRIBED → 바로 CLOSED" 루프 완전 해소

## 5. 현재 시스템 상태
- **데이터베이스**: Supabase PostgreSQL (RLS 활성화)
- **인증**: Supabase Auth
- **실시간**: Supabase Realtime 활성화됨 (messages, questions, forms, form_submissions, giveaways, giveaway_entries, giveaway_winners 테이블)
- **스토리지**: Supabase Storage (발표자료 다운로드에 사용 중)
- **배포**: Vercel (로컬 개발 중)
- **최근 마이그레이션**: 
  - `015_create_forms_system.sql` (설문/퀴즈 통합 시스템)
  - `016_create_webinar_files.sql` (발표자료 관리)
  - `017_create_giveaways.sql` (추첨 시스템)
  - `018_add_opened_closed_at_to_forms.sql` (폼 상태 관리)
  - `019_fix_fill_org_fields_for_forms.sql` (트리거 수정)
  - `020_add_org_fields_to_form_tables.sql` (org_fields 추가)
  - `021_optimize_form_loading_indexes.sql` (성능 최적화)

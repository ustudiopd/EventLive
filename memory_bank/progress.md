# 완료된 작업 내역 (Progress)

## [2025-01-XX] 접속중 탭 관리자 전용화
- ✅ 접속중 탭 추가 및 관리자 전용 설정
  - 채팅/Q&A 탭에 "접속중" 탭 추가 (관리자 모드일 때만 표시)
  - 화면 상단 PresenceBar를 관리자만 볼 수 있도록 수정
  - 일반 참가자는 접속중 정보를 전혀 볼 수 없도록 제한
  - 모바일과 데스크톱 모두에 적용

## [2025-01-XX] Q&A 및 UI 개선
- ✅ 로딩 메시지 애니메이션 추가
  - 채팅창과 Q&A 창의 "불러오는 중..." 메시지에 점 애니메이션 추가
  - `app/globals.css`에 `loading-dots` 키프레임 애니메이션 추가
  - 각 점이 0.2초 간격으로 순차적으로 나타났다 사라지는 효과
- ✅ 콘솔 페이지에 "관리자 접속" 버튼 추가
  - 콘솔 헤더에 "관리자 접속" 버튼 추가
  - 클릭 시 `/webinar/${webinarId}/live?admin=true`로 이동하여 바로 라이브 페이지 접속
- ✅ Q&A 답변 자동 펼치기 기능 제거
  - `loadQuestions`에서 답변이 있는 질문 자동 펼치기 로직 제거
  - UPDATE 이벤트에서 답변 추가 시 자동 펼치기 로직 제거
  - 접기/펼치기는 사용자가 수동으로만 제어 가능
- ✅ 관리자 모드 질문 핀 기능 추가
  - 각 질문의 시간 옆에 작은 핀 버튼 추가 (관리자 모드일 때만 표시)
  - 핀 상태에 따라 아이콘 스타일 변경 (고정됨: 노란색, 고정 안 됨: 회색)
  - 클릭 시 `/api/questions/[questionId]` API를 호출하여 핀 상태 토글
- ✅ Q&A 필터 버튼 단순화
  - 필터를 "전체" / "내 질문" 두 개로 단순화
  - "미답변", "답변됨", "고정됨" 버튼 제거
  - 필터 타입을 `'all' | 'mine'`로 변경

## [2025-01-XX] Realtime 연결 안정성 근본 개선 (해결책.md 5가지 수정안 적용)
- ✅ A. CLOSED를 실패로 세지 않기 (수동 해제 구분)
  - `manualCloseRef` 플래그 추가
  - cleanup 시 수동 종료 플래그 설정
  - CLOSED 콜백에서 수동 종료인 경우 실패로 카운팅하지 않음
  - "SUBSCRIBED → (정상 cleanup) → CLOSED" 패턴이 실패로 누적되지 않음
- ✅ B. 구독 이펙트 의존성에서 `currentUser?.id` 제거
  - useEffect 의존성 배열에서 `currentUser?.id` 제거
  - presence 설정 제거 (채팅만 사용하므로 필수 아님)
  - 사용자 로딩 완료 시 의도치 않은 재구독 방지
  - 가장 큰 효과를 기대할 수 있는 수정안
- ✅ C. 헬스체크를 채널 상태 기준으로 변경
  - "이벤트 부재" 대신 "채널 상태"로 판단
  - `channel.state === 'joined'` 확인
  - 조용한 시간대에 불필요한 폴백 방지
- ✅ D. 폴백 폴링에서 증분 조회에 ETag 제거
  - `after=lastMessageId`가 있으면 ETag 미사용
  - 304 오인 방지
  - 폴백 시에도 빠른 메시지 수신
- ✅ E. 기존 채널 정리 로직 간소화
  - `getChannels()` 대신 `channelRef.current`만 확인
  - 우리가 만든 채널만 정리
  - 경합 상황 감소 및 안전성 향상
- ✅ 주요 개선사항
  - "SUBSCRIBED → 바로 CLOSED" 루프 완전 해소
  - 불필요한 폴백 활성화 방지
  - 폴백 시 지연 최소화
  - 코드 안정성 향상

## [2025-01-XX] 폴백 폴링 성능 최적화 및 Vercel 프록시 우회
- ✅ 폴백 폴링 지연 시간 대폭 단축
  - 헬스체크 대기 시간: 10초 → 3초
  - 헬스체크 주기: 5초 → 1초
  - 폴링 주기: 15초 → 2초 (지터 ±0.5초)
  - 초기 로드 후 대기: 10초 → 3초
  - 체감 지연 시간: 15초 → 3~5초로 약 70% 단축
- ✅ Vercel 프록시 우회 구현
  - 원본 Supabase URL(`*.supabase.co`) 직접 사용
  - 커스텀 도메인 감지 및 원본 URL 자동 전환
  - `NEXT_PUBLIC_SUPABASE_ORIGIN_URL` 환경 변수 지원
  - WebSocket 연결 안정화 (CLOSED 상태 반복 문제 해소)
- ✅ 주요 개선사항
  - 사용자 경험: 메시지 수신 지연 대폭 감소
  - 연결 안정성: Vercel 프록시를 거치지 않아 WebSocket 연결 유지
  - 성능: 폴링 주기 단축으로 실시간성 향상

## [2025-01-XX] Realtime 연결 안정성 개선 완료
- ✅ 재연결 로직 개선 (setTimeout cleanup)
  - `reconnectTimeoutRef`, `fallbackReconnectTimeoutRef` 추가
  - cleanup 함수에서 모든 타이머 취소
  - 메모리 누수 및 경쟁 상태 방지
- ✅ 기존 채널 정리 개선 (비동기 대기)
  - `await`를 사용하여 기존 채널 정리 완료 대기
  - 약간의 지연 추가 (100ms)로 정리 완료 보장
  - 중복 구독 방지
- ✅ Chat 컴포넌트 중복 렌더링 방지
  - 모바일/데스크톱에서 각각 다른 `key` prop 사용
  - 중복 구독 방지
- ✅ 채널 참조 관리 개선
  - `channelRef`를 사용하여 cleanup에서 채널 접근
  - 비동기 함수 구조 개선

## [2025-01-XX] Phase 1 - 멀티테넌시 코어 완료
- ✅ 데이터베이스 스키마 구현 (agencies, clients, profiles, memberships, webinars 등)
- ✅ RLS 정책 구현 및 최적화 (무한 재귀 문제 해결)
- ✅ 인증/권한 가드 시스템 (`lib/auth/guards.ts`)
- ✅ 슈퍼 관리자 에이전시 생성 API (`/api/agencies/create`)
- ✅ 기본 대시보드 스켈레톤

## [2025-01-XX] Phase 2 - 에이전시/클라이언트 대시보드 완료
- ✅ 에이전시 회원가입 (`/signup/agency`)
- ✅ 클라이언트 회원가입 (`/signup/client`, 초대 토큰 기반)
- ✅ 에이전시 대시보드 (`/agency/[agencyId]/dashboard`)
- ✅ 클라이언트 대시보드 (`/client/[clientId]/dashboard`)
- ✅ 클라이언트 생성/관리 (`/agency/[agencyId]/clients`)
- ✅ 클라이언트 초대 기능 (`/api/clients/invite`)
- ✅ 브랜딩 설정 (`/client/[clientId]/settings/branding`)
- ✅ 통계 리포트 (`/agency/[agencyId]/reports`)
- ✅ CSV 내보내기 (`/api/report/export`)
- ✅ 도메인 관리 (`/agency/[agencyId]/domains`)
- ✅ UI/UX 개선 (Tailwind CSS 적용)

## [2025-01-XX] Phase 3 - 웨비나 및 실시간 기능 (일부 완료)
- ✅ 웨비나 생성 (`/client/[clientId]/webinars/new`, `/api/webinars/create`)
- ✅ 웨비나 수정 (`/api/webinars/[webinarId]` PUT)
- ✅ 웨비나 삭제 (`/api/webinars/[webinarId]` DELETE)
- ✅ 웨비나 목록 (`/client/[clientId]/webinars`, `/api/webinars/list`)
- ✅ 웨비나 입장 페이지 (`/webinar/[id]`, `components/WebinarEntry.tsx`)
  - ✅ 로그인/회원가입 폼
  - ✅ 이메일 인증 안내 모달
  - ✅ 자동 리다이렉트 (인증 완료 후)
- ✅ 웨비나 시청 페이지 (`/webinar/[id]/live`)
  - ✅ YouTube 임베드 플레이어
  - ✅ 전체화면 기능 (브라우저 네이티브 Fullscreen API)
  - ✅ 반응형 레이아웃 (모바일: 영상 → 참여자 → 채팅 순서)
  - ✅ 4K 모니터 지원 (전체 너비 레이아웃, 채팅 패널 최대 너비 제한)
  - ✅ 세션 소개 섹션 (리액션 패널 대체)
  - ✅ 웨비나 자동 등록 (`/api/webinars/[webinarId]/register`)
- ✅ 실시간 채팅 (`components/webinar/Chat.tsx`)
  - ✅ 메시지 전송 (`/api/messages/create`)
  - ✅ Supabase Realtime 활성화 및 구독
  - ✅ Optimistic Update (프로필 이름 즉시 표시)
  - ✅ 메시지 DB 저장
  - ✅ 메시지 모더레이션 (숨김 기능)
  - ✅ 프로필 정보 조회 API (`/api/webinars/[webinarId]/messages`)
- ✅ Q&A 시스템 (`components/webinar/QA.tsx`)
  - ✅ 질문 등록 (`/api/questions/create`)
  - ✅ 질문 모더레이션 (`/api/questions/[questionId]` PATCH)
  - ✅ 실시간 질문 업데이트
- ✅ PresenceBar (`components/webinar/PresenceBar.tsx`)
  - ✅ 참여자 수 표시
  - ✅ 참여자 목록 표시
  - ✅ 중복 제거 로직 (Map 기반)
  - ✅ 프로필 정보 표시 개선 (API를 통한 프로필 조회)
  - ✅ 타이핑 표시 구조 (실제 동작은 추후 구현)
- ✅ 운영 콘솔 (`/webinar/[id]/console`)
  - ✅ Q&A 모더레이션 (`components/console/QAModeration.tsx`)
  - ✅ 채팅 관리 (`components/console/ChatModeration.tsx`)
  - ✅ 기본 레이아웃 및 탭 구조

## [2025-01-XX] 기술적 개선사항
- ✅ Next.js 15 호환성 (params, cookies() await 처리)
- ✅ RLS 무한 재귀 문제 해결 (Admin Supabase 사용, 애플리케이션 레벨 권한 체크)
- ✅ 에이전시 멤버 권한 확장 (클라이언트 대시보드 접근, 웨비나 생성 권한)
- ✅ 4K 모니터 레이아웃 최적화
- ✅ 모바일 반응형 레이아웃 개선
- ✅ Supabase Realtime 활성화 (messages, questions, quizzes 등 테이블)
- ✅ 프로필 정보 조회 API 엔드포인트 생성 (`/api/profiles/[userId]`)
- ✅ 프로필 RLS 정책 개선 (같은 웨비나/클라이언트/에이전시 사용자 프로필 읽기 허용)
- ✅ 실시간 채팅 Optimistic Update 개선 (프로필 이름 즉시 표시)
- ✅ 채널 구독 관리 개선 (고유한 채널 이름, cleanup 로직)

## [2025-01-XX] 채팅 시스템 대폭 개선
- ✅ `client_msg_id` 기반 정확한 Optimistic Update 매칭
- ✅ API 성공 즉시 UI 교체 (Realtime 대기 없이)
- ✅ 중복 전송 방지 (`client_msg_id` 기반)
- ✅ 타임아웃 처리 (10초, AbortController)
- ✅ 조건부 폴백 폴링 (지터 ±400ms, 가시성/오프라인 고려)
- ✅ 증분 폴링 지원 (`?after=<lastId>`)
- ✅ Realtime 토큰 자동 주입
- ✅ 고정 채널명 사용 (`webinar:${webinarId}:messages`)
- ✅ DELETE/UPDATE payload 검증
- ✅ 자동 재연결 로직 (지수 백오프)
- ✅ 데이터베이스 마이그레이션 (`012_add_client_msg_id_to_messages.sql`)
  - `client_msg_id` 칼럼 추가
  - 복합 인덱스 `(webinar_id, id)` 추가
  - 유니크 제약 조건 추가

## [2025-01-XX] 웨비나 페이지 레이아웃 개선
- ✅ 마진 제거 및 전체 너비 사용
- ✅ 최대 너비 1600px 제한 및 가운데 정렬
- ✅ 모바일 패딩 최소화 (px-0)
- ✅ 웨비나 페이지에서 Sidebar 제거 (LayoutWrapper 수정)

## [2025-01-XX] 관리자 모드 및 Q&A 기능 개선
- ✅ 관리자 모드 구현 (`?admin=true` URL 파라미터 또는 특정 이메일)
- ✅ 관리자 권한 확인 API (`/api/webinars/[webinarId]/check-admin`)
- ✅ 관리자 채팅 메시지 삭제 기능
- ✅ 관리자 질문 삭제 기능
- ✅ 관리자 질문 답변 기능 (답변 내용 저장)
- ✅ 참여자 질문 수정 기능 (자신의 질문만)
- ✅ 참여자 질문 삭제 기능 (자신의 질문만)
- ✅ 답변 표시 개선 (기본 펼침, 접기 기능)
- ✅ 답변 모달 닫기 방지 (답변 중일 때)
- ✅ 데이터베이스 마이그레이션 (`014_add_answer_to_questions.sql`)
  - `answer` 컬럼 추가 (TEXT 타입)
  - 답변 내용 인덱스 추가
- ✅ PresenceBar에 "접속 중: [계정명]" 표시 (관리자 모드 지원)
- ✅ 참여자 목록에서 현재 사용자 제외

## [2025-01-XX] 게스트 접속 및 웨비나별 독립 세션 관리
- ✅ 게스트 계정 생성 API (`/api/auth/guest`)
  - 닉네임만으로 익명 계정 생성
  - 웨비나별 자동 등록
  - 세션 토큰 반환
- ✅ 게스트 입장 UI (`WebinarEntry.tsx`)
  - 게스트 탭 추가 (access_policy가 'guest_allowed'인 경우)
  - 닉네임 입력 폼
  - 기존 세션 로그아웃 처리
- ✅ 웨비나별 독립 회원가입/등록 시스템
  - 회원가입 시 해당 웨비나에만 자동 등록
  - 기존 세션 확인 및 로그아웃 처리
  - 웨비나별 등록 확인 강제 (`/webinar/[id]/live`)
- ✅ 회원가입 시 닉네임 선택 기능
  - 닉네임 필드 추가 (선택사항)
  - 닉네임 미지정 시 이름으로 표기
- ✅ 웨비나별 세션 격리
  - 각 웨비나별 독립적인 등록 관리
  - 게스트 모드 사용 시 기존 세션 자동 로그아웃

## [2025-01-XX] UI/UX 개선 및 페이지 구조 개선
- ✅ 메인 페이지 UI 개선 (`app/page.tsx`)
  - "시작하기", "로그인" 버튼 제거
  - 현재 진행중인 웨비나 카드 표시
  - 웨비나 접근 정책 안내 (게스트 입장 가능 / 회원가입 필요)
  - 웨비나 카드 클릭 시 입장 페이지로 이동
- ✅ 관리자 접속 페이지 생성 (`/admin`)
  - EventLive.ai 소개 섹션
  - 로그인/회원가입 탭 전환
  - 역할 선택 페이지로 이동
  - 사이드바 제거, 최대 너비 1600px 제한
- ✅ 사이드바 모바일 반응형 (`components/layout/Sidebar.tsx`)
  - 데스크톱: 왼쪽 사이드바 (lg 이상)
  - 모바일: 하단 고정 메뉴 아이콘 (lg 미만)
  - 로그아웃 버튼 포함
- ✅ 로그아웃 기능 개선
  - 에러 처리 추가
  - 세션 삭제 확인
  - 메인 페이지로 리다이렉트
- ✅ 웨비나 제목 클릭 기능 (`WebinarView.tsx`)
  - 웨비나 제목 클릭 시 입장 페이지로 이동
  - 호버 효과 추가
- ✅ 헤더 UI 개선 (`components/layout/Header.tsx`)
  - 로그인/회원가입 버튼 제거
  - "관리자 접속" 버튼 추가

## [2025-01-XX] 기술적 개선사항
- ✅ 게스트 계정 세션 설정 개선
  - `signInWithPassword` 사용으로 세션 안정성 향상
  - 세션 확인 및 재시도 로직
- ✅ 메시지 조회 API 인증 개선 (`/api/webinars/[webinarId]/messages`)
  - `requireAuth()` 대신 직접 인증 확인 (Route Handler 호환)
  - 에러 로깅 개선
  - 게스트 계정 지원
- ✅ 웨비나 등록 확인 강제
  - 모든 모드에서 웨비나별 등록 확인
  - 등록되지 않은 웨비나 접근 차단
- ✅ Vercel 리전 설정 (`vercel.json`)
  - 싱가폴 리전 (`sin1`) 설정
  - Supabase 리전과 일치

## [2025-01-XX] 설문/퀴즈 통합 시스템 구현 완료
- ✅ 설문/퀴즈 통합 데이터베이스 스키마 (`015_create_forms_system.sql`)
  - `forms` 테이블 (kind: 'survey' | 'quiz')
  - `form_questions` 테이블
  - `form_submissions` 테이블
  - `form_answers` 테이블
  - `quiz_attempts` 테이블
- ✅ 설문/퀴즈 관리 API (`/api/webinars/[webinarId]/forms/*`)
  - 생성, 조회, 수정, 삭제
  - 상태 변경 (draft → open → closed)
  - 제출 처리 및 퀴즈 채점
  - 결과 조회 및 통계
- ✅ 설문/퀴즈 관리 UI (`FormManagement.tsx`)
  - 설문/퀴즈 생성 및 편집
  - 문항 관리 (단일 선택, 다중 선택, 텍스트)
  - 정답 키 설정 (퀴즈)
  - 결과 조회 모달
- ✅ 참여자 UI (`FormWidget.tsx`)
  - 설문/퀴즈 응답 폼
  - 퀴즈 정답 즉시 표시 (제출 후)
  - 제출 완료 메시지 자동 사라짐
- ✅ 팝업 시스템 구현
  - 세션 소개 탭에 버튼 배치
  - 팝업 모달로 설문/퀴즈/발표자료/추첨 표시
  - 자동 팝업 기능 (오픈된 항목 1회만)
- ✅ 성능 최적화 (`021_optimize_form_loading_indexes.sql`)
  - 병렬 쿼리 실행
  - 필요한 컬럼만 선택
  - 인덱스 추가 (form_submissions, forms)

## [2025-01-XX] 발표자료 다운로드 기능 구현 완료
- ✅ 파일 관리 데이터베이스 스키마 (`016_create_webinar_files.sql`)
  - `webinar_files` 테이블
  - Supabase Storage 연동
- ✅ 파일 관리 API (`/api/webinars/[webinarId]/files/*`)
  - 파일 업로드
  - 파일 목록 조회
  - 파일 다운로드 (서명된 URL)
  - 파일 삭제
- ✅ 파일 관리 UI (`FileManagement.tsx`)
  - 파일 업로드
  - 파일 목록 표시
  - 파일 삭제
- ✅ 참여자 UI (`FileDownload.tsx`)
  - 파일 목록 표시
  - 다운로드 버튼
  - 팝업 모달 통합

## [2025-01-XX] 추첨 기능 구현 완료
- ✅ 추첨 데이터베이스 스키마 (`017_create_giveaways.sql`)
  - `giveaways` 테이블
  - `giveaway_entries` 테이블
  - `giveaway_winners` 테이블
  - Commit-Reveal 패턴 지원 (seed_commit, seed_reveal)
- ✅ 추첨 관리 API (`/api/webinars/[webinarId]/giveaways/*`)
  - 추첨 생성
  - 추첨 목록 조회
  - 추첨 참여 (엔트리 생성)
  - 추첨 실행 (자동 seed 생성)
  - 추첨 결과 조회 (당첨자 이름 포함)
- ✅ 추첨 관리 UI (`GiveawayManagement.tsx`)
  - 추첨 생성 모달
  - 추첨 목록 표시
  - 상태 관리 (draft → open → closed → drawn)
  - 추첨 실행 애니메이션
  - 당첨자 이름 표시
- ✅ 참여자 UI (`GiveawayWidget.tsx`)
  - 추첨 참여 버튼
  - 참여자 수 실시간 표시
  - 당첨자 목록 표시
  - 팝업 모달 통합
- ✅ 추첨 애니메이션
  - 로딩 애니메이션 (슬롯머신 이모지)
  - 완료 애니메이션 (축하 이모지)
  - 당첨자 순차 표시 (fade-in-up)
  - 그라데이션 배경 및 펄스 효과

## [2025-01-XX] 운영 콘솔 개선
- ✅ 운영 콘솔 접근 권한 개선
  - 에이전시 관리자 (owner/admin) 접근 허용
  - 클라이언트 관리자 (owner/admin/operator) 접근 허용
- ✅ Q&A 모더레이션 개선 (`QAModeration.tsx`)
  - 답변 기능 추가
  - 실시간 업데이트
- ✅ 채팅 모더레이션 개선 (`ChatModeration.tsx`)
  - 삭제 기능 추가
  - 실시간 업데이트 (optimistic update)
- ✅ 콘솔 탭 구조 (`ConsoleView.tsx`)
  - 설문/퀴즈 관리 탭
  - 발표자료 관리 탭
  - 추첨 관리 탭

## [2025-01-XX] 슈퍼어드민 기능 구현 완료
- ✅ 슈퍼어드민 계정 생성 (`scripts/seed-super-admin.ts`)
  - JWT `app_metadata`에 `is_super_admin` 저장
  - "admin" 이메일 별칭 지원
- ✅ 슈퍼어드민 대시보드 (`/super/dashboard`)
  - 전체 통계 (에이전시, 클라이언트, 웨비나 수)
  - 최근 에이전시/클라이언트 목록
  - Admin Supabase 사용으로 성능 최적화
- ✅ 에이전시 관리 페이지 (`/super/agencies`)
  - 전체 에이전시 목록 조회
  - 에이전시 생성 기능
  - 에이전시 삭제 기능 (CASCADE로 연관 클라이언트도 삭제)
- ✅ 클라이언트 관리 페이지 (`/super/clients`)
  - 전체 클라이언트 목록 조회
  - 클라이언트 삭제 기능 (CASCADE로 연관 웨비나도 삭제)
- ✅ RLS 무한 재귀 문제 해결
  - JWT `app_metadata` 기반 권한 확인으로 전환
  - `profiles` 테이블 RLS 정책 단순화
  - Admin Supabase를 통한 서버 측 데이터 조회
- ✅ 삭제 API 구현
  - `/api/super/agencies/[agencyId]` DELETE
  - `/api/super/clients/[clientId]` DELETE
  - 감사 로그 기록
- ✅ 인증 가드 개선 (`lib/auth/guards.ts`)
  - JWT `app_metadata` 기반 슈퍼어드민 확인
  - Fallback 메커니즘 (JWT 갱신 전 호환성)

## [2025-01-XX] 채팅 시스템 안정성 개선
- ✅ 메시지 전송 후 새로고침/초기화 문제 해결
  - 초기 로드는 한 번만 실행 (`initialLoadTimeRef` 추적)
  - Realtime 구독 재연결 시 메시지 유지 (초기 로드 건너뛰기)
  - `webinarId` 변경 감지 및 초기 로드 리셋 (`lastWebinarIdRef` 추적)
  - 304 Not Modified 응답 처리 개선 (에러로 처리하지 않음)
  - Realtime INSERT 이벤트 중복 메시지 방지 (`id`, `client_msg_id` 기반)
- ✅ Realtime 연결 디버깅 개선
  - 채널 subscribe 콜백에서 상세한 에러 정보 로깅 (status, error code, reason, wasClean)
  - 재시도 횟수 및 다음 재시도 지연 시간 로깅
  - 디버깅을 위한 구조화된 로그 출력
- ✅ RLS 정책 및 Supabase 설정 확인
  - messages 테이블 RLS 정책 분석 및 정상 작동 확인
  - Supabase Realtime Publication 설정 확인 (messages 테이블 포함 확인)
  - 관련 뷰(me, my_agencies, my_clients) 정의 확인
- ✅ messages 테이블 RLS 정책 단순화 적용
  - JWT 기반 슈퍼어드민 판정 함수 생성 (`jwt_is_super_admin()`)
  - SELECT 정책: 복잡한 조건 제거, registrations 기반 얇은 ACL로 단순화
  - INSERT 정책: 웨비나 등록 확인 제거 (앞단에서 처리), user_id 확인만
  - UPDATE/DELETE 정책: profiles 테이블 조회 제거, JWT 기반 슈퍼어드민 확인
  - registrations 테이블 복합 인덱스 추가 (webinar_id, user_id)
  - 예상 성능 향상: SELECT 5-10배, INSERT 10-20배, UPDATE/DELETE 50-100배

## [2025-01-XX] Broadcast 중심 아키텍처 전환 완료
- ✅ Phase 1: 채널 전환
  - `BroadcastEnvelope` 타입 정의 (`lib/webinar/realtime.ts`)
  - Chat 컴포넌트에서 `postgres_changes` → `broadcast` 전환
  - 재연결 로직 단순화 (SDK 자동 재연결 활용, 3회 실패 시 채널 제거)
  - RLS 영향 제거로 성능 향상 및 무한 재귀 문제 해소
- ✅ Phase 2: 송신 경로 개선
  - 서버 API에서 Broadcast 전파 구현 (`lib/webinar/broadcast.ts`)
  - 메시지 생성/업데이트/삭제 API에 Broadcast 전파 추가
  - API → DB insert → Broadcast 순서 확정
  - 권한 검증은 API/DB RLS에서 처리
- ✅ Phase 3: 이벤트 타입 확장
  - 퀴즈/설문/추첨 이벤트 타입 정의 (quiz:open, quiz:close, poll:open, poll:close, raffle:draw 등)
  - Forms API에 Broadcast 전파 추가 (상태 변경 시)
  - Giveaways API에 Broadcast 전파 추가 (추첨 실행 시)
  - Chat 컴포넌트에 이벤트 타입별 처리 로직 추가
- ✅ 주요 개선사항
  - RLS 영향 제거: `postgres_changes` → `broadcast`로 전환하여 RLS 무한 재귀 문제 해소
  - 재연결 안정화: SDK 자동 재연결 활용, 3회 실패 시 채널 제거로 무한 루프 방지
  - 성능 향상: Broadcast는 RLS를 거치지 않아 지연 시간 감소
  - 확장성: 단일 채널(`webinar:${webinarId}`)로 모든 이벤트 타입 처리 가능

## [2025-01-XX] 다크모드 텍스트 입력창 가시성 개선
- ✅ 모든 입력 필드에 명시적 배경색 및 텍스트 색상 추가
  - `bg-white text-gray-900` 클래스 추가
  - 다크모드에서도 텍스트 입력창이 명확하게 보이도록 개선
- ✅ 수정된 컴포넌트
  - Chat.tsx (메시지 입력)
  - QA.tsx (질문 입력, 질문 수정, 답변 입력)
  - FormWidget.tsx (설문/퀴즈 답변 입력)
  - WebinarEntry.tsx (게스트/로그인/회원가입 입력)
  - login/page.tsx (로그인 입력)
  - settings/profile/page.tsx (프로필 설정 입력)
  - signup/client/page.tsx (클라이언트 회원가입 입력)

## [2025-01-XX] 클라이언트별 초대 기능 구현
- ✅ 데이터베이스 마이그레이션 (`029_add_client_id_to_invitations.sql`)
  - `client_invitations` 테이블에 `client_id` 컬럼 추가
  - 클라이언트별 초대 토큰 관리 가능
- ✅ 초대 API 개선 (`/api/clients/invite`)
  - `clientId` 파라미터 추가
  - 클라이언트 소속 검증 로직 추가
  - 초대 생성 시 `client_id` 저장
- ✅ 클라이언트 목록에 초대 버튼 추가
  - 각 클라이언트 행에 "초대" 버튼 추가 (`ClientInviteButton.tsx`)
  - 클라이언트별 초대 링크 생성 및 모달 표시
- ✅ 회원가입 페이지 개선 (`/signup/client`)
  - 초대 토큰으로 클라이언트 정보 조회 API 추가 (`/api/clients/invite-info`)
  - 클라이언트명 자동 입력 및 고정 (수정 불가)
  - `clientNameFixed` 상태로 입력 필드 비활성화
- ✅ 회원가입 처리 로직 개선 (`/api/clients/create-self`)
  - `client_id`가 있는 경우: 기존 클라이언트에 멤버로 추가 (role: 'member')
  - `client_id`가 없는 경우: 새 클라이언트 생성 및 owner 역할 부여
  - 두 가지 시나리오 모두 지원

## [2025-12-16] Next.js 16 업그레이드 및 보안 취약점 해결
- ✅ Next.js 15 → 16 업그레이드
  - Next.js 16.0.10 설치 완료
  - React 18 → 19 업그레이드 (Next.js 16 요구사항)
  - React 19.2.3 설치 완료
- ✅ 관련 패키지 업데이트
  - `@types/react`: ^18 → ^19
  - `@types/react-dom`: ^18 → ^19
  - `eslint-config-next`: ^15.0.0 → ^16.0.0
  - `eslint`: ^8 → ^9 (Next.js 16 요구사항)
- ✅ 보안 취약점 해결
  - Next.js 15.5.0-15.5.7의 critical 취약점 해결 (RCE, Server Actions Source Code Exposure, DoS)
  - glob 패키지의 high 취약점 해결 (Command injection)
  - 모든 취약점 해결 완료 (0 vulnerabilities)
- ✅ 빌드 테스트 완료
  - Next.js 16.0.10 (Turbopack)로 정상 컴파일
  - TypeScript 검증 통과
  - 33개 정적 페이지 생성 완료
- ⚠️ 향후 작업: middleware → proxy 마이그레이션
  - Next.js 16에서 `middleware.ts`가 deprecated됨
  - `proxy.ts`로 마이그레이션 필요 (향후 Next.js 17+ 호환성)
  - 현재는 경고만 표시되며 기능은 정상 동작

## [2025-01-XX] 웨비나 슬러그 지원 구현
- ✅ 데이터베이스 마이그레이션 (`032_add_slug_to_webinars.sql`)
  - `webinars` 테이블에 `slug` 필드 추가 (unique, nullable)
  - slug 자동 생성 함수 (`generate_slug_from_title`) 구현
  - 기존 웨비나에 slug 자동 생성 (제목 기반)
  - slug 인덱스 추가 (조회 성능 향상)
- ✅ UUID와 slug 모두 지원하는 라우팅 로직
  - `lib/utils/webinar.ts`에 UUID 판별 유틸리티 함수 추가
  - `/webinar/[id]` 경로에서 UUID/slug 자동 판별
  - 모든 웨비나 관련 페이지에서 slug 지원 (입장, 라이브, 콘솔)
- ✅ 웨비나 생성 API 개선
  - 웨비나 생성 시 slug 자동 생성
  - 중복 체크 및 충돌 처리 로직 추가
- ✅ 이메일 템플릿 개선
  - 등록 확인 이메일에서 slug 주소 사용
  - 예: `https://must.ai.kr/webinar/인간지능x인공지능-토크쇼-2025년-ai-결산/live?email=...`
- ✅ 짧은 링크 개선 (`/s/[code]`)
  - 짧은 링크를 통해 접속 시 slug로 리다이렉트
  - URL 파라미터(이메일 등) 유지하면서 리다이렉트
  - 예: `https://must.ai.kr/s/903514?email=ad@ustudio.co.kr` → slug 주소로 리다이렉트
- ✅ 주요 개선사항
  - 웨비나 접속 주소를 UUID 대신 읽기 쉬운 slug로 사용 가능
  - 기존 UUID 주소도 계속 지원 (하위 호환성 유지)
  - 이메일 회신 및 짧은 링크에서도 slug 주소 사용

## [2025-01-XX] 웨비나 등록 시스템 개선 및 이메일 인증 정책 구현
- ✅ 웨비나 등록 용어 변경
  - "회원가입" → "웨비나 등록"으로 UI 텍스트 변경
  - "이 웨비나에 등록" → "웨비나 등록"으로 간소화
  - 버튼 텍스트: "웨비나 등록 신청하기" → "웨비나 등록 및 입장하기"
- ✅ 이메일 인증 접근 정책 구현 (email_auth)
  - 데이터베이스 마이그레이션 (`031_create_webinar_allowed_emails.sql`)
    - `webinar_allowed_emails` 테이블 생성
    - 웨비나별 허용 이메일 목록 관리
    - RLS 정책 설정 (웨비나 소유자 관리, 공개 읽기)
  - 웨비나 생성/수정 시 허용 이메일 목록 설정 기능
  - 웨비나 입장 페이지에 "웨비나 입장" / "웨비나 등록" 탭 추가
  - 이메일 인증 탭: 등록된 이메일로 바로 입장 (비밀번호 불필요)
  - 웨비나 등록 탭: 이름, 이메일, 닉네임(선택)으로 등록 신청
  - 등록 신청 후 자동으로 허용 이메일 목록에 추가
- ✅ 개인정보 수집 및 이용 동의 기능
  - 웨비나 등록 폼에 필수 동의 체크박스 추가
  - "개인정보 수집 및 이용" 링크 클릭 시 상세 모달 표시
  - 동의하지 않으면 등록 버튼 비활성화
  - 동의서 내용: 수집 목적, 항목, 보유 기간, 거부 권리 등
- ✅ 이메일 발송 기능 구현
  - nodemailer 패키지 설치
  - 이메일 발송 유틸리티 함수 생성 (`lib/email.ts`)
  - 구글 SMTP 설정 지원 (admin@modoolecture.com)
  - 웨비나 등록 완료 시 자동 이메일 발송
  - 이메일 내용: 웨비나 제목, 입장 링크, 등록 확인 메시지
  - HTML 및 텍스트 형식 이메일 지원
- ✅ 환경 변수 설정 가이드 작성 (`EMAIL_SETUP.md`)
  - SMTP 설정 방법 안내
  - 구글 앱 비밀번호 생성 방법
  - 환경 변수 예시 제공

## 남은 작업

### Phase 3 - 웨비나 및 실시간 기능 (대부분 완료)
- ✅ 퀴즈 기능 (출제, 응답, 정답 공개) - 완료
- ✅ 추첨 기능 (실행, 당첨자 알림) - 완료
- ✅ 설문조사 기능 - 완료
- ✅ 발표자료 다운로드 기능 - 완료
- ✅ 게스트 모드 (닉네임만으로 입장) - 완료
- ❌ 웨비나 등록 페이지 (`/webinar/[id]/register`)
- ❌ 초대 링크 처리 (`/invite/[token]`)

### Phase 4 - 이벤트 로직 고도화 & 리포트
- ❌ 퀴즈 정답자 집계 및 통계 (기본 통계는 구현됨)
- ❌ 추첨 재현성 보고 및 통계
- ❌ 참여/체류/행동 리포트 고도화
- ❌ 리포트 자동 발송

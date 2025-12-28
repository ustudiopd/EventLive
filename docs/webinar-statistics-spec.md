# 웨비나별 통계 추적 시스템 명세서

## 1. 현재 구현된 통계 (에이전시/클라이언트 단위)

### 1.1 집계 통계
- ✅ **웨비나 수**: 전체 웨비나 개수
- ✅ **총 참여자 수**: 고유 사용자 수 (registrations 테이블 기반)
- ✅ **총 메시지 수**: 전체 메시지 개수
- ✅ **총 질문 수**: 전체 질문 개수

### 1.2 시계열 차트
- ✅ **월별 웨비나 생성 추이**: 최근 6개월
- ✅ **월별 참여자 수**: 최근 6개월
- ✅ **월별 메시지 수**: 최근 6개월
- ✅ **월별 질문 수**: 최근 6개월

### 1.3 구현 위치
- API: `/api/reports/stats` (집계 통계)
- API: `/api/reports/chart-data` (시계열 차트)
- UI: `app/(agency)/agency/[agencyId]/reports/components/StatsDashboard.tsx`

---

## 2. 각 웨비나별 추적 가능한 통계 항목

### 2.1 참여자 통계

#### 2.1.1 등록 및 접속
- **총 등록자 수** (`registrations` 테이블)
  - 데이터 소스: `SELECT COUNT(DISTINCT user_id) FROM registrations WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

- **실제 접속자 수** (Presence 기반)
  - 데이터 소스: `webinar_access_logs` 테이블
  - 현재 상태: ✅ 테이블 존재 확인 (`id`, `webinar_id`, `participant_count`, `logged_at`, `created_at`)
  - 추적 방법: 5분마다 현재 접속자 수 기록 (수집 로직 구현 필요)

- **최대 동시 접속자 수**
  - 데이터 소스: `webinar_access_logs.participant_count`의 최대값
  - 현재 상태: ❌ 미구현

- **평균 접속자 수**
  - 데이터 소스: `webinar_access_logs.participant_count`의 평균값
  - 현재 상태: ❌ 미구현

- **접속 시간대별 분포**
  - 데이터 소스: `webinar_access_logs.logged_at`을 시간대별로 그룹화
  - 현재 상태: ❌ 미구현

#### 2.1.2 등록 출처별 통계
- **이메일 링크로 등록한 사용자 수**
  - 데이터 소스: `registrations.registered_via = 'email'`
  - 현재 상태: ✅ 컬럼 존재 확인 (`registered_via` 컬럼 존재)
  - 현재 데이터: 기존 등록자는 `NULL` 또는 `'manual'`일 수 있음

- **수동 등록 사용자 수**
  - 데이터 소스: `registrations.registered_via = 'manual'`
  - 현재 상태: ⚠️ 컬럼은 추가되었으나 수집 로직 제거됨

- **초대 링크로 등록한 사용자 수**
  - 데이터 소스: `registrations.registered_via = 'invite'`
  - 현재 상태: ⚠️ 컬럼은 추가되었으나 수집 로직 제거됨

#### 2.1.3 참여 패턴
- **평균 참여 시간** (체류 시간)
  - 데이터 소스: 접속/퇴장 시간 추적 필요
  - 현재 상태: ❌ 미구현 (추적 로직 필요)

- **재방문자 수**
  - 데이터 소스: 동일 사용자의 여러 접속 기록
  - 현재 상태: ❌ 미구현

---

### 2.2 상호작용 통계

#### 2.2.1 채팅 (메시지)
- **총 메시지 수**
  - 데이터 소스: `SELECT COUNT(*) FROM messages WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

- **시간대별 메시지 수**
  - 데이터 소스: `messages.created_at`을 시간대별로 그룹화
  - 현재 상태: ❌ 미구현

- **활성 발신자 수** (메시지를 보낸 고유 사용자 수)
  - 데이터 소스: `SELECT COUNT(DISTINCT user_id) FROM messages WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

- **평균 메시지 길이**
  - 데이터 소스: `AVG(LENGTH(content))` from messages
  - 현재 상태: ❌ 미구현

#### 2.2.2 Q&A (질문)
- **총 질문 수**
  - 데이터 소스: `SELECT COUNT(*) FROM questions WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

- **답변된 질문 수**
  - 데이터 소스: `SELECT COUNT(*) FROM questions WHERE webinar_id = ? AND answer IS NOT NULL`
  - 현재 상태: ✅ 집계 가능

- **답변률**
  - 계산: `(답변된 질문 수 / 총 질문 수) * 100`
  - 현재 상태: ✅ 계산 가능

- **평균 답변 시간**
  - 데이터 소스: `questions.created_at`과 `questions.answered_at`의 차이
  - 현재 상태: ✅ 집계 가능 (`answered_at` 컬럼 존재 확인)

- **고정된 질문 수**
  - 데이터 소스: `SELECT COUNT(*) FROM questions WHERE webinar_id = ? AND pinned = true`
  - 현재 상태: ❌ `pinned` 컬럼 없음 (구현 필요)

- **질문자 수** (질문을 한 고유 사용자 수)
  - 데이터 소스: `SELECT COUNT(DISTINCT user_id) FROM questions WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

---

### 2.3 폼/설문/퀴즈 통계

#### 2.3.1 설문 (Survey)
- **설문 수**
  - 데이터 소스: `SELECT COUNT(*) FROM forms WHERE webinar_id = ? AND kind = 'survey'`
  - 현재 상태: ✅ 집계 가능

- **설문 제출 수**
  - 데이터 소스: `SELECT COUNT(*) FROM form_submissions WHERE form_id IN (SELECT id FROM forms WHERE webinar_id = ? AND kind = 'survey')`
  - 현재 상태: ✅ 집계 가능

- **설문 응답률**
  - 계산: `(제출 수 / 등록자 수) * 100`
  - 현재 상태: ✅ 계산 가능

- **문항별 응답 통계**
  - 데이터 소스: `form_answers` 테이블
  - 현재 상태: ✅ API 존재 (`/api/webinars/[webinarId]/forms/[formId]/results`)

#### 2.3.2 퀴즈 (Quiz)
- **퀴즈 수**
  - 데이터 소스: `SELECT COUNT(*) FROM forms WHERE webinar_id = ? AND kind = 'quiz'`
  - 현재 상태: ✅ 집계 가능

- **퀴즈 참여자 수**
  - 데이터 소스: `SELECT COUNT(DISTINCT participant_id) FROM quiz_attempts WHERE form_id IN (SELECT id FROM forms WHERE webinar_id = ? AND kind = 'quiz')`
  - 현재 상태: ✅ 집계 가능

- **평균 점수**
  - 데이터 소스: `quiz_attempts.total_score`의 평균
  - 현재 상태: ✅ 집계 가능

- **정답률**
  - 데이터 소스: `form_answers`와 `form_questions.answer_key` 비교
  - 현재 상태: ✅ API에서 계산 가능

---

### 2.4 추첨 통계

- **추첨 수**
  - 데이터 소스: `SELECT COUNT(*) FROM giveaways WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

- **추첨 참여자 수**
  - 데이터 소스: `SELECT COUNT(DISTINCT participant_id) FROM giveaway_entries WHERE giveaway_id IN (SELECT id FROM giveaways WHERE webinar_id = ?)`
  - 현재 상태: ✅ 집계 가능

- **당첨자 수**
  - 데이터 소스: `SELECT COUNT(*) FROM giveaway_winners WHERE giveaway_id IN (SELECT id FROM giveaways WHERE webinar_id = ?)`
  - 현재 상태: ✅ 집계 가능

---

### 2.5 파일 다운로드 통계

- **파일 수**
  - 데이터 소스: `SELECT COUNT(*) FROM webinar_files WHERE webinar_id = ?`
  - 현재 상태: ✅ 집계 가능

- **다운로드 수** (구현 필요)
  - 데이터 소스: 다운로드 로그 테이블 필요
  - 현재 상태: ❌ 미구현

---

### 2.6 시간 기반 통계

- **웨비나 진행 시간**
  - 데이터 소스: `webinars.start_time`, `webinars.end_time`
  - 현재 상태: ✅ 데이터 존재

- **실제 시작 시간** (첫 접속자 접속 시간)
  - 데이터 소스: `webinar_access_logs.logged_at`의 최소값
  - 현재 상태: ⚠️ 테이블은 있으나 수집 로직 제거됨

- **실제 종료 시간** (마지막 접속자 퇴장 시간)
  - 데이터 소스: `webinar_access_logs.logged_at`의 최대값
  - 현재 상태: ⚠️ 테이블은 있으나 수집 로직 제거됨

- **피크 시간대** (접속자가 가장 많았던 시간)
  - 데이터 소스: `webinar_access_logs`에서 `participant_count`가 최대인 시점
  - 현재 상태: ❌ 미구현

---

### 2.7 참여도 통계

- **활성 참여자 비율**
  - 계산: `(메시지 보낸 사용자 수 + 질문한 사용자 수) / 총 등록자 수`
  - 현재 상태: ✅ 계산 가능

- **평균 참여 활동 수**
  - 계산: `(총 메시지 수 + 총 질문 수) / 총 등록자 수`
  - 현재 상태: ✅ 계산 가능

---

## 3. 구현 우선순위 및 단계

### Phase 1: 기본 통계 (즉시 구현 가능)
**목표**: 현재 데이터로 바로 집계 가능한 통계

1. **웨비나별 기본 통계 API**
   - 엔드포인트: `/api/webinars/[webinarId]/stats`
   - 통계 항목:
     - 총 등록자 수
     - 총 메시지 수
     - 총 질문 수
     - 답변된 질문 수
     - 답변률
     - 설문 수 및 제출 수
     - 퀴즈 수 및 참여자 수
     - 추첨 수 및 참여자 수
     - 파일 수

2. **웨비나별 통계 대시보드**
   - 위치: `/webinar/[id]/stats` 또는 콘솔 페이지에 통계 탭 추가
   - UI: 카드 형태로 주요 지표 표시

### Phase 2: 접속 로그 기반 통계 (데이터 수집 필요)
**목표**: 접속 패턴 분석

1. **접속 로그 수집 시스템 재구현**
   - `webinar_access_logs` 테이블 활용
   - 5분마다 접속자 수 자동 기록
   - 접속/퇴장 이벤트 추적

2. **접속 통계 API**
   - 최대 동시 접속자 수
   - 평균 접속자 수
   - 시간대별 접속자 분포
   - 피크 시간대

### Phase 3: 등록 출처 통계 (데이터 수집 필요)
**목표**: 마케팅 채널 효과 분석

1. **등록 출처 수집 시스템 재구현**
   - `registrations.registered_via` 컬럼 활용
   - 이메일 링크 접속 시 자동 기록
   - 수동 등록 vs 이메일 등록 구분

2. **등록 출처 통계 API**
   - 이메일 등록자 수
   - 수동 등록자 수
   - 초대 링크 등록자 수
   - 등록 출처별 비율

### Phase 4: 고급 통계 (추가 구현 필요)
**목표**: 심층 분석

1. **참여 시간 추적**
   - 사용자별 접속/퇴장 시간 기록
   - 평균 참여 시간 계산
   - 재방문자 추적

2. **시간대별 상호작용 통계**
   - 시간대별 메시지 수
   - 시간대별 질문 수
   - 시간대별 접속자 수

3. **다운로드 통계**
   - 파일별 다운로드 수
   - 다운로드 시간대 분포

---

## 4. 데이터베이스 스키마 요약

### 4.1 현재 사용 가능한 테이블

| 테이블명 | 주요 컬럼 | 통계 활용 |
|---------|---------|---------|
| `webinars` | `id`, `title`, `start_time`, `end_time`, `created_at` | 웨비나 기본 정보, 진행 시간 |
| `registrations` | `webinar_id`, `user_id`, `role`, `nickname`, `registered_via` | 등록자 수, 등록 출처 |
| `messages` | `id`, `webinar_id`, `user_id`, `content`, `created_at` | 메시지 수, 활성 발신자 수 |
| `questions` | `id`, `webinar_id`, `user_id`, `answer`, `created_at` | 질문 수, 답변 수, 답변률 |
| `forms` | `id`, `webinar_id`, `kind`, `status` | 설문/퀴즈 수 |
| `form_submissions` | `form_id`, `participant_id`, `submitted_at` | 설문 제출 수 |
| `quiz_attempts` | `form_id`, `participant_id`, `total_score` | 퀴즈 참여자 수, 평균 점수 |
| `giveaways` | `id`, `webinar_id`, `winners_count` | 추첨 수 |
| `giveaway_entries` | `giveaway_id`, `participant_id` | 추첨 참여자 수 |
| `giveaway_winners` | `giveaway_id`, `participant_id` | 당첨자 수 |
| `webinar_files` | `id`, `webinar_id`, `file_name` | 파일 수 |

### 4.2 추가 구현 필요한 테이블

| 테이블명 | 목적 | 주요 컬럼 |
|---------|------|---------|
| `webinar_access_logs` | 접속자 수 기록 | `webinar_id`, `participant_count`, `logged_at` |
| `webinar_downloads` | 파일 다운로드 추적 | `file_id`, `user_id`, `downloaded_at` |
| `webinar_user_sessions` | 사용자별 접속 세션 | `webinar_id`, `user_id`, `joined_at`, `left_at` |

---

## 5. API 설계

### 5.1 웨비나별 통계 API

**엔드포인트**: `GET /api/webinars/[webinarId]/stats`

**응답 예시**:
```json
{
  "webinar": {
    "id": "uuid",
    "title": "웨비나 제목",
    "start_time": "2025-12-17T08:00:00Z",
    "end_time": "2025-12-17T10:00:00Z"
  },
  "participants": {
    "total_registered": 150,
    "total_accessed": 120,
    "max_concurrent": 95,
    "avg_concurrent": 65,
    "by_source": {
      "email": 100,
      "manual": 40,
      "invite": 10
    }
  },
  "interactions": {
    "messages": {
      "total": 450,
      "active_senders": 80,
      "avg_length": 25
    },
    "questions": {
      "total": 30,
      "answered": 25,
      "answer_rate": 83.3,
      "active_askers": 20,
      "avg_answer_time_minutes": 5
    }
  },
  "forms": {
    "surveys": {
      "count": 2,
      "submissions": 100,
      "response_rate": 66.7
    },
    "quizzes": {
      "count": 1,
      "participants": 80,
      "avg_score": 85.5,
      "pass_rate": 90.0
    }
  },
  "giveaways": {
    "count": 1,
    "participants": 120,
    "winners": 5
  },
  "files": {
    "count": 3,
    "downloads": 200
  },
  "timing": {
    "scheduled_duration_minutes": 120,
    "actual_start_time": "2025-12-17T08:05:00Z",
    "actual_end_time": "2025-12-17T10:15:00Z",
    "peak_time": "2025-12-17T09:30:00Z",
    "peak_concurrent": 95
  },
  "engagement": {
    "active_participant_rate": 66.7,
    "avg_activities_per_participant": 3.2
  }
}
```

### 5.2 시간대별 통계 API

**엔드포인트**: `GET /api/webinars/[webinarId]/stats/timeline`

**쿼리 파라미터**:
- `interval`: `'5min' | '15min' | '1hour'` (기본값: `'15min'`)

**응답 예시**:
```json
{
  "timeline": [
    {
      "time": "2025-12-17T08:00:00Z",
      "participants": 10,
      "messages": 5,
      "questions": 2
    },
    {
      "time": "2025-12-17T08:15:00Z",
      "participants": 45,
      "messages": 25,
      "questions": 8
    }
    // ...
  ]
}
```

---

## 6. UI 컴포넌트 설계

### 6.1 웨비나 통계 대시보드

**위치**: `/webinar/[id]/stats` 또는 콘솔 페이지의 "통계" 탭

**섹션 구성**:
1. **개요 카드**
   - 총 등록자 수
   - 최대 동시 접속자 수
   - 평균 접속자 수
   - 활성 참여자 비율

2. **상호작용 카드**
   - 총 메시지 수
   - 총 질문 수
   - 답변률
   - 평균 답변 시간

3. **폼/퀴즈 카드**
   - 설문 응답률
   - 퀴즈 평균 점수
   - 퀴즈 정답률

4. **시간대별 차트**
   - 접속자 수 추이 (라인 차트)
   - 메시지/질문 수 추이 (라인 차트)
   - 시간대별 분포 (바 차트)

5. **등록 출처 파이 차트**
   - 이메일/수동/초대 비율

---

## 7. 구현 체크리스트

### Phase 1: 기본 통계 (즉시 구현)
- [ ] `/api/webinars/[webinarId]/stats` API 구현
- [ ] 웨비나 통계 대시보드 컴포넌트 생성
- [ ] 콘솔 페이지에 통계 탭 추가
- [ ] 기본 통계 카드 UI 구현

### Phase 2: 접속 로그 (데이터 수집 필요)
- [ ] `webinar_access_logs` 테이블 확인/생성
- [ ] 접속자 수 자동 기록 로직 구현 (5분마다)
- [ ] 접속 통계 API 구현
- [ ] 시간대별 접속자 차트 구현

### Phase 3: 등록 출처 (데이터 수집 필요)
- [ ] `registrations.registered_via` 컬럼 확인
- [ ] 등록 출처 자동 기록 로직 구현
- [ ] 등록 출처 통계 API 구현
- [ ] 등록 출처 파이 차트 구현

### Phase 4: 고급 통계 (추가 구현)
- [ ] 사용자 세션 추적 테이블 생성
- [ ] 다운로드 로그 테이블 생성
- [ ] 시간대별 상호작용 통계 API 구현
- [ ] 참여 시간 분석 기능 구현

---

## 8. 기술 스택

- **백엔드**: Next.js API Routes
- **데이터베이스**: Supabase (PostgreSQL)
- **차트 라이브러리**: Recharts (이미 사용 중)
- **권한 관리**: RLS (Row Level Security)

---

## 9. 참고사항

- 모든 통계는 웨비나 소유자(에이전시/클라이언트 멤버)만 조회 가능
- RLS 정책을 통해 자동으로 권한 제어
- 대용량 데이터 처리를 위한 인덱스 최적화 필요
- 실시간 통계는 캐싱 전략 고려 필요

---

## 10. 현재 데이터베이스 상태 확인 결과

### 10.1 확인된 테이블 및 컬럼

#### `questions` 테이블
- ✅ `id`, `webinar_id`, `user_id`, `content`, `created_at`
- ✅ `answer` (답변 내용)
- ✅ `answered_at` (답변 시간) - **평균 답변 시간 계산 가능**
- ✅ `answered_by` (답변한 사용자)
- ❌ `pinned` 컬럼 없음

#### `registrations` 테이블
- ✅ `webinar_id`, `user_id`, `role`, `nickname`, `created_at`
- ✅ `registered_via` (등록 출처) - **등록 출처별 통계 가능**
  - 가능한 값: `'email'`, `'manual'`, `'invite'`
  - 기존 데이터는 `NULL` 또는 기본값일 수 있음

#### `webinar_access_logs` 테이블
- ✅ `id`, `webinar_id`, `participant_count`, `logged_at`, `created_at`
- ✅ 테이블 존재 확인
- ⚠️ 수집 로직 구현 필요 (5분마다 자동 기록)

### 10.2 즉시 구현 가능한 통계 (Phase 1)

다음 통계는 **현재 데이터로 바로 집계 가능**합니다:

1. **참여자 통계**
   - 총 등록자 수 ✅
   - 등록 출처별 통계 ✅ (기존 데이터는 NULL일 수 있음)

2. **상호작용 통계**
   - 총 메시지 수 ✅
   - 활성 발신자 수 ✅
   - 총 질문 수 ✅
   - 답변된 질문 수 ✅
   - 답변률 ✅
   - 평균 답변 시간 ✅ (`answered_at` 활용)
   - 질문자 수 ✅

3. **폼/퀴즈 통계**
   - 설문 수 및 제출 수 ✅
   - 설문 응답률 ✅
   - 퀴즈 수 및 참여자 수 ✅
   - 퀴즈 평균 점수 ✅
   - 문항별 통계 ✅ (기존 API 활용)

4. **추첨 통계**
   - 추첨 수 ✅
   - 추첨 참여자 수 ✅
   - 당첨자 수 ✅

5. **파일 통계**
   - 파일 수 ✅

### 10.3 데이터 수집 후 구현 가능한 통계 (Phase 2-3)

1. **접속 통계** (접속 로그 수집 필요)
   - 최대 동시 접속자 수
   - 평균 접속자 수
   - 시간대별 접속자 분포
   - 피크 시간대

2. **등록 출처 통계** (등록 시 출처 기록 필요)
   - 이메일 등록자 수
   - 수동 등록자 수
   - 초대 링크 등록자 수

---

## 11. 빠른 시작 가이드

### 11.1 Phase 1 구현 (즉시 시작 가능)

1. **API 엔드포인트 생성**
   ```
   /api/webinars/[webinarId]/stats
   ```

2. **기본 통계 집계 쿼리**
   ```sql
   -- 총 등록자 수
   SELECT COUNT(DISTINCT user_id) FROM registrations WHERE webinar_id = ?
   
   -- 총 메시지 수
   SELECT COUNT(*) FROM messages WHERE webinar_id = ?
   
   -- 총 질문 수 및 답변 수
   SELECT 
     COUNT(*) as total,
     COUNT(answer) as answered
   FROM questions 
   WHERE webinar_id = ?
   
   -- 평균 답변 시간 (분 단위)
   SELECT 
     AVG(EXTRACT(EPOCH FROM (answered_at - created_at)) / 60) as avg_answer_time_minutes
   FROM questions 
   WHERE webinar_id = ? AND answered_at IS NOT NULL
   ```

3. **UI 컴포넌트 생성**
   - 콘솔 페이지에 "통계" 탭 추가
   - 또는 별도 통계 페이지 생성

### 11.2 Phase 2 구현 (접속 로그 수집)

1. **수집 로직 구현**
   - `WebinarView` 컴포넌트에서 5분마다 접속자 수 기록
   - `PresenceBar`에서 접속자 수 변경 시 콜백 호출

2. **통계 쿼리**
   ```sql
   -- 최대 동시 접속자 수
   SELECT MAX(participant_count) 
   FROM webinar_access_logs 
   WHERE webinar_id = ?
   
   -- 평균 접속자 수
   SELECT AVG(participant_count) 
   FROM webinar_access_logs 
   WHERE webinar_id = ?
   
   -- 피크 시간대
   SELECT logged_at, participant_count
   FROM webinar_access_logs 
   WHERE webinar_id = ?
   ORDER BY participant_count DESC 
   LIMIT 1
   ```

---

## 12. 예상 개발 시간

- **Phase 1 (기본 통계)**: 2-3시간
  - API 구현: 1시간
  - UI 컴포넌트: 1-2시간

- **Phase 2 (접속 로그)**: 2-3시간
  - 수집 로직: 1-2시간
  - 통계 API: 1시간

- **Phase 3 (등록 출처)**: 1-2시간
  - 수집 로직: 1시간
  - 통계 API: 1시간

- **Phase 4 (고급 통계)**: 4-6시간
  - 세션 추적: 2-3시간
  - 다운로드 로그: 1-2시간
  - 시간대별 통계: 1-2시간

**총 예상 시간**: 9-14시간








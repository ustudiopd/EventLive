# 기능별 통계 구현 명세서

## 목차
1. [개요](#개요)
2. [채팅 통계](#1-채팅-통계)
3. [Q&A 통계](#2-qa-통계)
4. [폼/퀴즈 통계](#3-폼퀴즈-통계)
5. [추첨 통계](#4-추첨-통계)
6. [파일 통계](#5-파일-통계)
7. [등록자 통계](#6-등록자-통계)
8. [접속 통계](#7-접속-통계)
9. [시간대별 통계](#8-시간대별-통계)
10. [구현 우선순위](#구현-우선순위)
11. [API 설계](#api-설계)
12. [UI 컴포넌트 설계](#ui-컴포넌트-설계)

---

## 개요

### 목적
웨비나 운영 시 각 기능별 상세 통계를 제공하여 운영 효율성과 참여자 만족도를 향상시킵니다.

### 범위
- 웨비나별 기능 통계 (채팅, Q&A, 폼, 추첨, 파일, 등록자, 접속)
- 시간대별 상세 분석
- 실시간 통계 업데이트
- 통계 데이터 내보내기 (CSV)

### 권한
- **조회 권한**: 클라이언트 `owner`, `admin`, `operator`, `analyst`, `member` / 에이전시 `owner`, `admin`, `analyst` / 슈퍼 관리자
- **데이터 접근**: RLS 정책을 통해 자동 제어

---

## 1. 채팅 통계

### 1.1 추적 항목

#### 기본 통계
- **총 메시지 수**: 전체 채팅 메시지 개수
- **고유 발신자 수**: 메시지를 보낸 참여자 수
- **평균 메시지 수**: 총 메시지 수 / 고유 발신자 수
- **최다 발신자**: 가장 많은 메시지를 보낸 참여자 (TOP 10)

#### 시간대별 통계
- **시간대별 메시지 수**: 5분/15분/1시간 단위 메시지 분포
- **피크 시간대**: 메시지가 가장 많이 발생한 시간대
- **시간대별 발신자 수**: 각 시간대에 메시지를 보낸 참여자 수

#### 참여도 통계
- **채팅 참여율**: (메시지를 보낸 참여자 수 / 총 등록자 수) × 100
- **비활성 참여자 수**: 등록했지만 메시지를 보내지 않은 참여자 수

### 1.2 데이터 소스

```sql
-- 테이블: messages
-- 주요 컬럼:
--   - id: 메시지 ID
--   - webinar_id: 웨비나 ID
--   - user_id: 발신자 ID
--   - content: 메시지 내용
--   - created_at: 발신 시간
--   - hidden: 숨김 여부 (관리자가 숨긴 메시지)
```

### 1.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/chat
```

#### SQL 쿼리 예시

```sql
-- 총 메시지 수
SELECT COUNT(*) as total_messages
FROM messages
WHERE webinar_id = $1 AND hidden = false;

-- 고유 발신자 수
SELECT COUNT(DISTINCT user_id) as unique_senders
FROM messages
WHERE webinar_id = $1 AND hidden = false;

-- 시간대별 메시지 수 (5분 단위)
SELECT 
  DATE_TRUNC('minute', created_at) / 5 * 5 as time_slot,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as sender_count
FROM messages
WHERE webinar_id = $1 AND hidden = false
GROUP BY time_slot
ORDER BY time_slot;

-- 최다 발신자 TOP 10
SELECT 
  user_id,
  profiles.nickname,
  COUNT(*) as message_count
FROM messages
JOIN profiles ON messages.user_id = profiles.id
WHERE messages.webinar_id = $1 AND messages.hidden = false
GROUP BY user_id, profiles.nickname
ORDER BY message_count DESC
LIMIT 10;
```

#### 응답 형식

```typescript
interface ChatStats {
  // 기본 통계
  totalMessages: number
  uniqueSenders: number
  avgMessagesPerSender: number
  participationRate: number // 채팅 참여율 (%)
  
  // 시간대별 통계
  timeline: Array<{
    time: string // ISO 8601
    messageCount: number
    senderCount: number
  }>
  
  // 최다 발신자
  topSenders: Array<{
    userId: string
    nickname: string
    messageCount: number
  }>
  
  // 피크 시간대
  peakTime: {
    time: string
    messageCount: number
  } | null
}
```

### 1.4 필요한 작업

- [x] 기본 통계 집계 (현재 구현됨)
- [ ] 시간대별 통계 API 구현
- [ ] 최다 발신자 통계 API 구현
- [ ] 채팅 통계 UI 컴포넌트 구현
- [ ] 시간대별 메시지 추이 차트 구현

---

## 2. Q&A 통계

### 2.1 추적 항목

#### 기본 통계
- **총 질문 수**: 전체 질문 개수
- **답변된 질문 수**: 답변이 있는 질문 개수
- **답변률**: (답변된 질문 수 / 총 질문 수) × 100
- **미답변 질문 수**: 아직 답변이 없는 질문 수
- **고유 질문자 수**: 질문을 한 참여자 수

#### 답변 시간 통계
- **평균 답변 시간**: 질문 등록부터 답변까지의 평균 시간 (분 단위)
- **최단 답변 시간**: 가장 빠른 답변 시간
- **최장 답변 시간**: 가장 느린 답변 시간
- **답변 시간 분포**: 5분 이내, 10분 이내, 30분 이내, 1시간 이내, 1시간 이상

#### 시간대별 통계
- **시간대별 질문 수**: 5분/15분/1시간 단위 질문 분포
- **시간대별 답변 수**: 각 시간대에 답변된 질문 수
- **피크 질문 시간대**: 질문이 가장 많이 발생한 시간대

#### 질문자 통계
- **최다 질문자**: 가장 많은 질문을 한 참여자 (TOP 10)
- **평균 질문 수**: 총 질문 수 / 고유 질문자 수

### 2.2 데이터 소스

```sql
-- 테이블: questions
-- 주요 컬럼:
--   - id: 질문 ID
--   - webinar_id: 웨비나 ID
--   - user_id: 질문자 ID
--   - content: 질문 내용
--   - answer: 답변 내용
--   - answered_at: 답변 시간
--   - answered_by: 답변한 사용자 ID
--   - created_at: 질문 등록 시간
--   - status: 상태 (published, answered, hidden, pinned)
```

### 2.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/qa
```

#### SQL 쿼리 예시

```sql
-- 기본 통계
SELECT 
  COUNT(*) as total_questions,
  COUNT(answer) as answered_questions,
  COUNT(DISTINCT user_id) as unique_questioners
FROM questions
WHERE webinar_id = $1 AND status != 'hidden';

-- 평균 답변 시간 (분 단위)
SELECT 
  AVG(EXTRACT(EPOCH FROM (answered_at - created_at)) / 60) as avg_answer_time_minutes,
  MIN(EXTRACT(EPOCH FROM (answered_at - created_at)) / 60) as min_answer_time_minutes,
  MAX(EXTRACT(EPOCH FROM (answered_at - created_at)) / 60) as max_answer_time_minutes
FROM questions
WHERE webinar_id = $1 AND answered_at IS NOT NULL;

-- 답변 시간 분포
SELECT 
  CASE
    WHEN EXTRACT(EPOCH FROM (answered_at - created_at)) / 60 <= 5 THEN '5분 이내'
    WHEN EXTRACT(EPOCH FROM (answered_at - created_at)) / 60 <= 10 THEN '10분 이내'
    WHEN EXTRACT(EPOCH FROM (answered_at - created_at)) / 60 <= 30 THEN '30분 이내'
    WHEN EXTRACT(EPOCH FROM (answered_at - created_at)) / 60 <= 60 THEN '1시간 이내'
    ELSE '1시간 이상'
  END as time_range,
  COUNT(*) as count
FROM questions
WHERE webinar_id = $1 AND answered_at IS NOT NULL
GROUP BY time_range
ORDER BY 
  CASE time_range
    WHEN '5분 이내' THEN 1
    WHEN '10분 이내' THEN 2
    WHEN '30분 이내' THEN 3
    WHEN '1시간 이내' THEN 4
    ELSE 5
  END;

-- 시간대별 질문 수
SELECT 
  DATE_TRUNC('minute', created_at) / 5 * 5 as time_slot,
  COUNT(*) as question_count,
  COUNT(answer) as answered_count
FROM questions
WHERE webinar_id = $1 AND status != 'hidden'
GROUP BY time_slot
ORDER BY time_slot;

-- 최다 질문자 TOP 10
SELECT 
  user_id,
  profiles.nickname,
  COUNT(*) as question_count
FROM questions
JOIN profiles ON questions.user_id = profiles.id
WHERE questions.webinar_id = $1 AND questions.status != 'hidden'
GROUP BY user_id, profiles.nickname
ORDER BY question_count DESC
LIMIT 10;
```

#### 응답 형식

```typescript
interface QAStats {
  // 기본 통계
  totalQuestions: number
  answeredQuestions: number
  unansweredQuestions: number
  answerRate: number // %
  uniqueQuestioners: number
  avgQuestionsPerQuestioner: number
  
  // 답변 시간 통계
  avgAnswerTime: number // 분
  minAnswerTime: number // 분
  maxAnswerTime: number // 분
  answerTimeDistribution: Array<{
    range: string // "5분 이내", "10분 이내", ...
    count: number
  }>
  
  // 시간대별 통계
  timeline: Array<{
    time: string
    questionCount: number
    answeredCount: number
  }>
  
  // 최다 질문자
  topQuestioners: Array<{
    userId: string
    nickname: string
    questionCount: number
  }>
  
  // 피크 시간대
  peakQuestionTime: {
    time: string
    questionCount: number
  } | null
}
```

### 2.4 필요한 작업

- [x] 기본 통계 집계 (현재 구현됨)
- [x] 평균 답변 시간 계산 (현재 구현됨)
- [ ] 답변 시간 분포 통계 API 구현
- [ ] 시간대별 질문 통계 API 구현
- [ ] 최다 질문자 통계 API 구현
- [ ] Q&A 통계 UI 컴포넌트 구현
- [ ] 답변 시간 분포 차트 구현

---

## 3. 폼/퀴즈 통계

### 3.1 추적 항목

#### 설문 통계
- **총 설문 수**: 설문 폼 개수
- **총 응답 수**: 설문 제출 횟수
- **응답률**: (응답 수 / 총 등록자 수) × 100
- **평균 응답 시간**: 설문 오픈부터 제출까지의 평균 시간

#### 퀴즈 통계
- **총 퀴즈 수**: 퀴즈 폼 개수
- **총 참여자 수**: 퀴즈에 참여한 고유 사용자 수
- **평균 점수**: 전체 참여자의 평균 점수
- **최고 점수**: 가장 높은 점수
- **정답률**: 전체 문항 중 정답 비율
- **문항별 정답률**: 각 문항의 정답률

#### 문항별 통계 (설문)
- **선택지별 응답 분포**: 각 선택지에 대한 응답 수 및 비율
- **텍스트 응답 요약**: 텍스트 응답의 키워드 추출 (선택)

#### 문항별 통계 (퀴즈)
- **문항별 정답률**: 각 문항의 정답률
- **문항별 평균 점수**: 각 문항의 평균 배점 획득률
- **가장 어려운 문항**: 정답률이 가장 낮은 문항
- **가장 쉬운 문항**: 정답률이 가장 높은 문항

### 3.2 데이터 소스

```sql
-- 테이블: forms
-- 주요 컬럼:
--   - id: 폼 ID
--   - webinar_id: 웨비나 ID
--   - kind: 폼 종류 ('survey', 'quiz')
--   - status: 상태 ('draft', 'open', 'closed')
--   - created_at: 생성 시간

-- 테이블: form_questions
-- 주요 컬럼:
--   - id: 문항 ID
--   - form_id: 폼 ID
--   - type: 문항 유형 ('single', 'multiple', 'text')
--   - body: 문항 내용
--   - options: 선택지 (JSON)
--   - points: 배점 (퀴즈)
--   - answer_key: 정답 (퀴즈)

-- 테이블: form_submissions
-- 주요 컬럼:
--   - id: 제출 ID
--   - form_id: 폼 ID
--   - participant_id: 참여자 ID
--   - submitted_at: 제출 시간

-- 테이블: form_answers
-- 주요 컬럼:
--   - id: 답변 ID
--   - submission_id: 제출 ID
--   - question_id: 문항 ID
--   - answer_value: 답변 값 (JSON)

-- 테이블: quiz_attempts
-- 주요 컬럼:
--   - id: 시도 ID
--   - form_id: 폼 ID
--   - participant_id: 참여자 ID
--   - total_score: 총 점수
--   - submitted_at: 제출 시간
```

### 3.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/forms
GET /api/webinars/[webinarId]/forms/[formId]/stats
```

#### SQL 쿼리 예시

```sql
-- 설문 통계
SELECT 
  COUNT(*) FILTER (WHERE kind = 'survey') as total_surveys,
  COUNT(*) FILTER (WHERE kind = 'quiz') as total_quizzes
FROM forms
WHERE webinar_id = $1;

-- 설문 응답 수
SELECT 
  COUNT(DISTINCT fs.participant_id) as unique_respondents,
  COUNT(*) as total_submissions
FROM form_submissions fs
JOIN forms f ON fs.form_id = f.id
WHERE f.webinar_id = $1 AND f.kind = 'survey';

-- 퀴즈 통계
SELECT 
  COUNT(DISTINCT qa.participant_id) as unique_participants,
  COUNT(*) as total_attempts,
  AVG(qa.total_score) as avg_score,
  MAX(qa.total_score) as max_score,
  MIN(qa.total_score) as min_score
FROM quiz_attempts qa
JOIN forms f ON qa.form_id = f.id
WHERE f.webinar_id = $1 AND f.kind = 'quiz';

-- 문항별 정답률 (퀴즈)
SELECT 
  fq.id as question_id,
  fq.body as question_body,
  COUNT(*) FILTER (WHERE fa.answer_value = fq.answer_key) as correct_count,
  COUNT(*) as total_attempts,
  (COUNT(*) FILTER (WHERE fa.answer_value = fq.answer_key)::float / COUNT(*) * 100) as correct_rate
FROM form_questions fq
JOIN forms f ON fq.form_id = f.id
LEFT JOIN form_answers fa ON fa.question_id = fq.id
LEFT JOIN form_submissions fs ON fa.submission_id = fs.id
WHERE f.id = $1 AND f.kind = 'quiz'
GROUP BY fq.id, fq.body, fq.answer_key;

-- 선택지별 응답 분포 (설문)
SELECT 
  fq.id as question_id,
  fq.body as question_body,
  option->>'id' as option_id,
  option->>'text' as option_text,
  COUNT(*) as response_count
FROM form_questions fq
JOIN forms f ON fq.form_id = f.id
CROSS JOIN LATERAL jsonb_array_elements(fq.options) as option
LEFT JOIN form_answers fa ON fa.question_id = fq.id 
  AND fa.answer_value::jsonb @> jsonb_build_array(option->>'id')
LEFT JOIN form_submissions fs ON fa.submission_id = fs.id
WHERE f.id = $1 AND f.kind = 'survey' AND fq.type IN ('single', 'multiple')
GROUP BY fq.id, fq.body, option->>'id', option->>'text'
ORDER BY fq.id, response_count DESC;
```

#### 응답 형식

```typescript
interface FormStats {
  // 설문 통계
  survey: {
    totalSurveys: number
    totalSubmissions: number
    uniqueRespondents: number
    responseRate: number // %
  }
  
  // 퀴즈 통계
  quiz: {
    totalQuizzes: number
    totalAttempts: number
    uniqueParticipants: number
    avgScore: number
    maxScore: number
    minScore: number
    overallCorrectRate: number // %
  }
  
  // 폼별 상세 통계
  forms: Array<{
    formId: string
    title: string
    kind: 'survey' | 'quiz'
    submissionCount: number
    // 설문인 경우
    questionStats?: Array<{
      questionId: string
      questionBody: string
      optionDistribution: Array<{
        optionId: string
        optionText: string
        count: number
        percentage: number
      }>
    }>
    // 퀴즈인 경우
    questionStats?: Array<{
      questionId: string
      questionBody: string
      correctRate: number // %
      avgPoints: number
    }>
  }>
}
```

### 3.4 필요한 작업

- [x] 기본 통계 집계 (현재 구현됨)
- [x] 폼 결과 조회 API (현재 구현됨: `/api/webinars/[webinarId]/forms/[formId]/results`)
- [ ] 폼별 상세 통계 API 구현
- [ ] 문항별 통계 API 구현
- [ ] 폼 통계 UI 컴포넌트 구현
- [ ] 선택지별 분포 차트 구현
- [ ] 문항별 정답률 차트 구현

---

## 4. 추첨 통계

### 4.1 추적 항목

#### 기본 통계
- **총 추첨 수**: 추첨 이벤트 개수
- **총 참여자 수**: 추첨에 참여한 고유 사용자 수
- **총 참여 횟수**: 전체 참여 횟수 (중복 참여 포함)
- **평균 참여 횟수**: 총 참여 횟수 / 고유 참여자 수
- **당첨자 수**: 전체 당첨자 수

#### 추첨별 통계
- **추첨별 참여자 수**: 각 추첨에 참여한 사용자 수
- **추첨별 당첨자 수**: 각 추첨의 당첨자 수
- **추첨별 당첨률**: (당첨자 수 / 참여자 수) × 100

#### 시간대별 통계
- **시간대별 참여 수**: 각 시간대에 발생한 참여 횟수
- **피크 참여 시간대**: 참여가 가장 많았던 시간대

### 4.2 데이터 소스

```sql
-- 테이블: giveaways
-- 주요 컬럼:
--   - id: 추첨 ID
--   - webinar_id: 웨비나 ID
--   - title: 추첨 제목
--   - winners_count: 당첨자 수
--   - status: 상태 ('draft', 'open', 'closed', 'drawn')
--   - created_at: 생성 시간
--   - drawn_at: 추첨 시간

-- 테이블: giveaway_entries
-- 주요 컬럼:
--   - id: 참여 ID
--   - giveaway_id: 추첨 ID
--   - participant_id: 참여자 ID
--   - created_at: 참여 시간

-- 테이블: giveaway_winners
-- 주요 컬럼:
--   - id: 당첨 ID
--   - giveaway_id: 추첨 ID
--   - participant_id: 당첨자 ID
--   - created_at: 당첨 시간
```

### 4.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/giveaways
```

#### SQL 쿼리 예시

```sql
-- 기본 통계
SELECT 
  COUNT(*) as total_giveaways,
  COUNT(*) FILTER (WHERE status = 'drawn') as drawn_giveaways
FROM giveaways
WHERE webinar_id = $1;

-- 총 참여자 수 및 참여 횟수
SELECT 
  COUNT(DISTINCT ge.participant_id) as unique_participants,
  COUNT(*) as total_entries
FROM giveaway_entries ge
JOIN giveaways g ON ge.giveaway_id = g.id
WHERE g.webinar_id = $1;

-- 총 당첨자 수
SELECT COUNT(*) as total_winners
FROM giveaway_winners gw
JOIN giveaways g ON gw.giveaway_id = g.id
WHERE g.webinar_id = $1;

-- 추첨별 통계
SELECT 
  g.id,
  g.title,
  g.winners_count,
  COUNT(DISTINCT ge.participant_id) as participant_count,
  COUNT(*) as entry_count,
  COUNT(DISTINCT gw.participant_id) as winner_count
FROM giveaways g
LEFT JOIN giveaway_entries ge ON g.id = ge.giveaway_id
LEFT JOIN giveaway_winners gw ON g.id = gw.giveaway_id
WHERE g.webinar_id = $1
GROUP BY g.id, g.title, g.winners_count
ORDER BY g.created_at;

-- 시간대별 참여 수
SELECT 
  DATE_TRUNC('minute', ge.created_at) / 5 * 5 as time_slot,
  COUNT(*) as entry_count,
  COUNT(DISTINCT ge.participant_id) as participant_count
FROM giveaway_entries ge
JOIN giveaways g ON ge.giveaway_id = g.id
WHERE g.webinar_id = $1
GROUP BY time_slot
ORDER BY time_slot;
```

#### 응답 형식

```typescript
interface GiveawayStats {
  // 기본 통계
  totalGiveaways: number
  drawnGiveaways: number
  totalEntries: number
  uniqueParticipants: number
  avgEntriesPerParticipant: number
  totalWinners: number
  
  // 추첨별 상세 통계
  giveaways: Array<{
    giveawayId: string
    title: string
    winnersCount: number
    participantCount: number
    entryCount: number
    winnerCount: number
    winRate: number // %
  }>
  
  // 시간대별 통계
  timeline: Array<{
    time: string
    entryCount: number
    participantCount: number
  }>
  
  // 피크 시간대
  peakTime: {
    time: string
    entryCount: number
  } | null
}
```

### 4.4 필요한 작업

- [x] 기본 통계 집계 (현재 구현됨)
- [ ] 추첨별 상세 통계 API 구현
- [ ] 시간대별 참여 통계 API 구현
- [ ] 추첨 통계 UI 컴포넌트 구현
- [ ] 추첨별 참여/당첨 차트 구현

---

## 5. 파일 통계

### 5.1 추적 항목

#### 기본 통계
- **총 파일 수**: 업로드된 파일 개수
- **총 다운로드 수**: 전체 다운로드 횟수
- **고유 다운로더 수**: 파일을 다운로드한 고유 사용자 수
- **평균 다운로드 수**: 총 다운로드 수 / 총 파일 수

#### 파일별 통계
- **파일별 다운로드 수**: 각 파일의 다운로드 횟수
- **인기 파일**: 다운로드가 가장 많은 파일 (TOP 10)
- **미다운로드 파일**: 한 번도 다운로드되지 않은 파일

#### 시간대별 통계
- **시간대별 다운로드 수**: 각 시간대에 발생한 다운로드 횟수
- **피크 다운로드 시간대**: 다운로드가 가장 많았던 시간대

### 5.2 데이터 소스

```sql
-- 테이블: webinar_files
-- 주요 컬럼:
--   - id: 파일 ID
--   - webinar_id: 웨비나 ID
--   - file_name: 파일명
--   - file_size: 파일 크기
--   - created_at: 업로드 시간

-- 테이블: webinar_downloads (구현 필요)
-- 주요 컬럼:
--   - id: 다운로드 ID
--   - file_id: 파일 ID
--   - user_id: 다운로드한 사용자 ID
--   - downloaded_at: 다운로드 시간
```

### 5.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/files
```

#### SQL 쿼리 예시

```sql
-- 기본 통계
SELECT 
  COUNT(*) as total_files
FROM webinar_files
WHERE webinar_id = $1;

-- 총 다운로드 수 및 고유 다운로더 수
SELECT 
  COUNT(*) as total_downloads,
  COUNT(DISTINCT user_id) as unique_downloaders
FROM webinar_downloads
WHERE file_id IN (
  SELECT id FROM webinar_files WHERE webinar_id = $1
);

-- 파일별 다운로드 수
SELECT 
  wf.id,
  wf.file_name,
  wf.file_size,
  COUNT(wd.id) as download_count
FROM webinar_files wf
LEFT JOIN webinar_downloads wd ON wf.id = wd.file_id
WHERE wf.webinar_id = $1
GROUP BY wf.id, wf.file_name, wf.file_size
ORDER BY download_count DESC;

-- 시간대별 다운로드 수
SELECT 
  DATE_TRUNC('minute', wd.downloaded_at) / 5 * 5 as time_slot,
  COUNT(*) as download_count,
  COUNT(DISTINCT wd.user_id) as downloader_count
FROM webinar_downloads wd
JOIN webinar_files wf ON wd.file_id = wf.id
WHERE wf.webinar_id = $1
GROUP BY time_slot
ORDER BY time_slot;
```

#### 응답 형식

```typescript
interface FileStats {
  // 기본 통계
  totalFiles: number
  totalDownloads: number
  uniqueDownloaders: number
  avgDownloadsPerFile: number
  
  // 파일별 상세 통계
  files: Array<{
    fileId: string
    fileName: string
    fileSize: number
    downloadCount: number
  }>
  
  // 인기 파일 TOP 10
  popularFiles: Array<{
    fileId: string
    fileName: string
    downloadCount: number
  }>
  
  // 시간대별 통계
  timeline: Array<{
    time: string
    downloadCount: number
    downloaderCount: number
  }>
  
  // 피크 시간대
  peakTime: {
    time: string
    downloadCount: number
  } | null
}
```

### 5.4 필요한 작업

- [x] 기본 파일 수 집계 (현재 구현됨)
- [ ] `webinar_downloads` 테이블 생성
- [ ] 파일 다운로드 시 로그 기록 로직 구현
- [ ] 파일 통계 API 구현
- [ ] 파일 통계 UI 컴포넌트 구현
- [ ] 파일별 다운로드 차트 구현

---

## 6. 등록자 통계

### 6.1 추적 항목

#### 기본 통계
- **총 등록자 수**: 웨비나에 등록한 고유 사용자 수
- **실제 접속자 수**: 실제로 웨비나에 접속한 사용자 수
- **접속률**: (실제 접속자 수 / 총 등록자 수) × 100

#### 등록 출처별 통계
- **이메일 등록자 수**: 이메일 링크를 통해 등록한 사용자 수
- **수동 등록자 수**: 관리자가 수동으로 등록한 사용자 수
- **초대 등록자 수**: 초대 링크를 통해 등록한 사용자 수
- **등록 출처별 비율**: 각 출처의 등록자 비율

#### 역할별 통계
- **참가자 수**: `role = 'attendee'`인 등록자 수
- **호스트 수**: `role = 'host'`인 등록자 수
- **모더레이터 수**: `role = 'moderator'`인 등록자 수

#### 시간대별 통계
- **시간대별 등록 수**: 각 시간대에 등록한 사용자 수
- **시간대별 접속 수**: 각 시간대에 접속한 사용자 수

### 6.2 데이터 소스

```sql
-- 테이블: registrations
-- 주요 컬럼:
--   - webinar_id: 웨비나 ID
--   - user_id: 사용자 ID
--   - role: 역할 ('attendee', 'host', 'moderator')
--   - registered_via: 등록 출처 ('email', 'manual', 'invite')
--   - created_at: 등록 시간

-- 테이블: webinar_access_logs
-- 주요 컬럼:
--   - webinar_id: 웨비나 ID
--   - participant_count: 접속자 수
--   - logged_at: 기록 시간
```

### 6.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/registrants
```

#### SQL 쿼리 예시

```sql
-- 기본 통계
SELECT 
  COUNT(DISTINCT user_id) as total_registrants
FROM registrations
WHERE webinar_id = $1;

-- 등록 출처별 통계
SELECT 
  COALESCE(registered_via, 'unknown') as source,
  COUNT(*) as count
FROM registrations
WHERE webinar_id = $1
GROUP BY registered_via;

-- 역할별 통계
SELECT 
  role,
  COUNT(*) as count
FROM registrations
WHERE webinar_id = $1
GROUP BY role;

-- 실제 접속자 수 (webinar_access_logs의 최대값)
SELECT MAX(participant_count) as max_concurrent_participants
FROM webinar_access_logs
WHERE webinar_id = $1;

-- 시간대별 등록 수
SELECT 
  DATE_TRUNC('hour', created_at) as time_slot,
  COUNT(*) as registration_count
FROM registrations
WHERE webinar_id = $1
GROUP BY time_slot
ORDER BY time_slot;
```

#### 응답 형식

```typescript
interface RegistrantStats {
  // 기본 통계
  totalRegistrants: number
  maxConcurrentParticipants: number
  accessRate: number // %
  
  // 등록 출처별 통계
  registrationSource: {
    email: number
    manual: number
    invite: number
    unknown: number
  }
  
  // 역할별 통계
  roleDistribution: {
    attendee: number
    host: number
    moderator: number
  }
  
  // 시간대별 통계
  timeline: Array<{
    time: string
    registrationCount: number
    participantCount: number // webinar_access_logs 기반
  }>
}
```

### 6.4 필요한 작업

- [x] 기본 통계 집계 (현재 구현됨)
- [x] 등록 출처별 통계 (현재 구현됨)
- [ ] 역할별 통계 API 구현
- [ ] 시간대별 등록 통계 API 구현
- [ ] 등록자 통계 UI 컴포넌트 구현
- [ ] 등록 출처 파이 차트 구현

---

## 7. 접속 통계

### 7.1 추적 항목

#### 기본 통계
- **최대 동시 접속자 수**: 웨비나 진행 중 최대 동시 접속자 수
- **평균 접속자 수**: 웨비나 진행 중 평균 접속자 수
- **총 접속 시간**: 전체 접속 시간 합계 (사용자별)

#### 시간대별 통계
- **시간대별 접속자 수**: 5분/15분/1시간 단위 접속자 수 분포
- **피크 접속 시간대**: 접속자가 가장 많았던 시간대
- **접속자 수 추이**: 시간에 따른 접속자 수 변화 (라인 차트)

#### 참여 시간 통계
- **평균 참여 시간**: 사용자별 평균 참여 시간
- **최장 참여 시간**: 가장 오래 참여한 사용자의 참여 시간
- **참여 시간 분포**: 10분 이내, 30분 이내, 1시간 이내, 1시간 이상

### 7.2 데이터 소스

```sql
-- 테이블: webinar_access_logs
-- 주요 컬럼:
--   - id: 로그 ID
--   - webinar_id: 웨비나 ID
--   - participant_count: 접속자 수
--   - logged_at: 기록 시간
--   - created_at: 생성 시간

-- 테이블: webinar_user_sessions (구현 필요)
-- 주요 컬럼:
--   - id: 세션 ID
--   - webinar_id: 웨비나 ID
--   - user_id: 사용자 ID
--   - joined_at: 접속 시간
--   - left_at: 퇴장 시간
```

### 7.3 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/access
```

#### SQL 쿼리 예시

```sql
-- 최대 동시 접속자 수
SELECT MAX(participant_count) as max_concurrent_participants
FROM webinar_access_logs
WHERE webinar_id = $1;

-- 평균 접속자 수
SELECT AVG(participant_count) as avg_participants
FROM webinar_access_logs
WHERE webinar_id = $1;

-- 시간대별 접속자 수
SELECT 
  DATE_TRUNC('minute', logged_at) / 5 * 5 as time_slot,
  AVG(participant_count) as avg_participants,
  MAX(participant_count) as max_participants,
  MIN(participant_count) as min_participants
FROM webinar_access_logs
WHERE webinar_id = $1
GROUP BY time_slot
ORDER BY time_slot;

-- 피크 접속 시간대
SELECT 
  DATE_TRUNC('minute', logged_at) / 5 * 5 as time_slot,
  MAX(participant_count) as max_participants
FROM webinar_access_logs
WHERE webinar_id = $1
GROUP BY time_slot
ORDER BY max_participants DESC
LIMIT 1;

-- 사용자별 참여 시간 (webinar_user_sessions 기반)
SELECT 
  user_id,
  SUM(EXTRACT(EPOCH FROM (left_at - joined_at)) / 60) as total_minutes,
  COUNT(*) as session_count
FROM webinar_user_sessions
WHERE webinar_id = $1 AND left_at IS NOT NULL
GROUP BY user_id;
```

#### 응답 형식

```typescript
interface AccessStats {
  // 기본 통계
  maxConcurrentParticipants: number
  avgParticipants: number
  
  // 시간대별 통계
  timeline: Array<{
    time: string
    avgParticipants: number
    maxParticipants: number
    minParticipants: number
  }>
  
  // 피크 시간대
  peakTime: {
    time: string
    participantCount: number
  } | null
  
  // 참여 시간 통계 (webinar_user_sessions 구현 시)
  participationTime?: {
    avgMinutes: number
    maxMinutes: number
    distribution: Array<{
      range: string
      count: number
    }>
  }
}
```

### 7.4 필요한 작업

- [x] 기본 통계 집계 (현재 구현됨: 최대 동시 접속자 수)
- [ ] 접속 로그 수집 로직 구현 (5분마다 자동 기록)
- [ ] 평균 접속자 수 계산 API 구현
- [ ] 시간대별 접속자 수 통계 API 구현
- [ ] `webinar_user_sessions` 테이블 생성 (선택)
- [ ] 접속 통계 UI 컴포넌트 구현
- [ ] 접속자 수 추이 차트 구현

---

## 8. 시간대별 통계

### 8.1 추적 항목

#### 통합 시간대별 통계
- **시간대별 메시지 수**: 각 시간대에 발생한 메시지 수
- **시간대별 질문 수**: 각 시간대에 발생한 질문 수
- **시간대별 접속자 수**: 각 시간대의 접속자 수
- **시간대별 상호작용 수**: 메시지 + 질문 + 폼 제출 + 추첨 참여

#### 상관관계 분석
- **접속자 수 vs 메시지 수**: 접속자 수와 메시지 수의 상관관계
- **접속자 수 vs 질문 수**: 접속자 수와 질문 수의 상관관계
- **피크 시간대 일치 여부**: 각 기능의 피크 시간대가 일치하는지 분석

### 8.2 구현 방법

#### API 엔드포인트
```
GET /api/webinars/[webinarId]/stats/timeline
```

#### SQL 쿼리 예시

```sql
-- 통합 시간대별 통계
WITH time_slots AS (
  SELECT generate_series(
    DATE_TRUNC('minute', (SELECT MIN(created_at) FROM messages WHERE webinar_id = $1)),
    DATE_TRUNC('minute', (SELECT MAX(created_at) FROM messages WHERE webinar_id = $1)),
    '5 minutes'::interval
  ) AS time_slot
)
SELECT 
  ts.time_slot,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT q.id) as question_count,
  COALESCE(MAX(wal.participant_count), 0) as participant_count
FROM time_slots ts
LEFT JOIN messages m ON DATE_TRUNC('minute', m.created_at) = ts.time_slot AND m.webinar_id = $1
LEFT JOIN questions q ON DATE_TRUNC('minute', q.created_at) = ts.time_slot AND q.webinar_id = $1
LEFT JOIN webinar_access_logs wal ON DATE_TRUNC('minute', wal.logged_at) = ts.time_slot AND wal.webinar_id = $1
GROUP BY ts.time_slot
ORDER BY ts.time_slot;
```

#### 응답 형식

```typescript
interface TimelineStats {
  timeline: Array<{
    time: string
    messageCount: number
    questionCount: number
    participantCount: number
    formSubmissionCount: number
    giveawayEntryCount: number
    totalInteractions: number
  }>
  
  // 피크 시간대
  peakTimes: {
    messages: string | null
    questions: string | null
    participants: string | null
    interactions: string | null
  }
  
  // 상관관계
  correlations: {
    participantsVsMessages: number // -1 ~ 1
    participantsVsQuestions: number
  }
}
```

### 8.3 필요한 작업

- [ ] 통합 시간대별 통계 API 구현
- [ ] 상관관계 분석 로직 구현
- [ ] 시간대별 통계 UI 컴포넌트 구현
- [ ] 통합 타임라인 차트 구현

---

## 구현 우선순위

### Phase 1: 기본 통계 강화 (즉시 구현 가능)
**목표**: 현재 데이터로 바로 집계 가능한 통계를 강화

1. **Q&A 통계 강화**
   - [ ] 답변 시간 분포 통계
   - [ ] 시간대별 질문 통계
   - [ ] 최다 질문자 통계

2. **채팅 통계 강화**
   - [ ] 시간대별 메시지 통계
   - [ ] 최다 발신자 통계
   - [ ] 채팅 참여율 계산

3. **폼 통계 강화**
   - [ ] 문항별 통계 API 개선
   - [ ] 선택지별 분포 차트

4. **추첨 통계 강화**
   - [ ] 추첨별 상세 통계
   - [ ] 시간대별 참여 통계

### Phase 2: 데이터 수집 시스템 구축
**목표**: 추가 통계를 위한 데이터 수집 인프라 구축

1. **접속 로그 수집**
   - [ ] `webinar_access_logs` 자동 기록 로직 구현 (5분마다)
   - [ ] 접속자 수 실시간 추적

2. **다운로드 로그 수집**
   - [ ] `webinar_downloads` 테이블 생성
   - [ ] 파일 다운로드 시 로그 기록

3. **사용자 세션 추적** (선택)
   - [ ] `webinar_user_sessions` 테이블 생성
   - [ ] 접속/퇴장 이벤트 추적

### Phase 3: 고급 통계 및 분석
**목표**: 심층 분석 기능 제공

1. **통합 시간대별 통계**
   - [ ] 모든 기능의 시간대별 통계 통합
   - [ ] 상관관계 분석

2. **통계 대시보드 개선**
   - [ ] 인터랙티브 차트 구현
   - [ ] 필터링 기능 (날짜, 시간대 등)
   - [ ] 통계 데이터 내보내기 (CSV)

3. **비교 분석**
   - [ ] 웨비나 간 통계 비교
   - [ ] 시리즈 웨비나 추이 분석

---

## API 설계

### 통합 통계 API

#### 엔드포인트
```
GET /api/webinars/[webinarId]/stats
```

#### 쿼리 파라미터
- `sections`: 통계 섹션 선택 (쉼표로 구분)
  - 예: `?sections=chat,qa,forms,giveaways,files,registrants,access`
  - 기본값: 모든 섹션

#### 응답 형식

```typescript
interface WebinarStats {
  webinarId: string
  webinarTitle: string
  
  // 각 기능별 통계 (선택적)
  chat?: ChatStats
  qa?: QAStats
  forms?: FormStats
  giveaways?: GiveawayStats
  files?: FileStats
  registrants?: RegistrantStats
  access?: AccessStats
  timeline?: TimelineStats
}
```

### 개별 통계 API

각 기능별로 개별 API 엔드포인트 제공:

```
GET /api/webinars/[webinarId]/stats/chat
GET /api/webinars/[webinarId]/stats/qa
GET /api/webinars/[webinarId]/stats/forms
GET /api/webinars/[webinarId]/stats/giveaways
GET /api/webinars/[webinarId]/stats/files
GET /api/webinars/[webinarId]/stats/registrants
GET /api/webinars/[webinarId]/stats/access
GET /api/webinars/[webinarId]/stats/timeline
```

### 권한 확인

모든 통계 API는 다음 권한 확인 로직을 공통으로 사용:

```typescript
// 권한 확인 로직 (예시)
async function checkStatsPermission(webinarId: string, userId: string) {
  // 슈퍼 관리자
  if (isSuperAdmin(userId)) return true
  
  // 클라이언트 멤버 확인
  const clientMember = await getClientMember(webinar.client_id, userId)
  if (clientMember && ['owner', 'admin', 'operator', 'analyst', 'member'].includes(clientMember.role)) {
    return true
  }
  
  // 에이전시 멤버 확인
  const agencyMember = await getAgencyMember(webinar.agency_id, userId)
  if (agencyMember && ['owner', 'admin', 'analyst'].includes(agencyMember.role)) {
    return true
  }
  
  return false
}
```

---

## UI 컴포넌트 설계

### 통계 대시보드 구조

```
/webinar/[id]/stats
├── 개요 카드 섹션
│   ├── 총 등록자 수
│   ├── 최대 동시 접속자
│   ├── 활성 참여자 비율
│   └── 평균 참여 활동
│
├── 기능별 통계 탭
│   ├── 채팅 통계
│   │   ├── 기본 통계 카드
│   │   ├── 시간대별 메시지 추이 차트
│   │   └── 최다 발신자 목록
│   │
│   ├── Q&A 통계
│   │   ├── 기본 통계 카드
│   │   ├── 답변 시간 분포 차트
│   │   ├── 시간대별 질문 추이 차트
│   │   └── 최다 질문자 목록
│   │
│   ├── 폼/퀴즈 통계
│   │   ├── 설문 통계 카드
│   │   ├── 퀴즈 통계 카드
│   │   ├── 폼별 상세 통계
│   │   └── 문항별 통계 차트
│   │
│   ├── 추첨 통계
│   │   ├── 기본 통계 카드
│   │   ├── 추첨별 상세 통계
│   │   └── 시간대별 참여 추이 차트
│   │
│   ├── 파일 통계
│   │   ├── 기본 통계 카드
│   │   ├── 파일별 다운로드 수
│   │   └── 인기 파일 목록
│   │
│   └── 접속 통계
│       ├── 기본 통계 카드
│       └── 접속자 수 추이 차트
│
└── 통합 타임라인
    └── 시간대별 통합 상호작용 차트
```

### 컴포넌트 구조

```
components/stats/
├── StatsDashboard.tsx          # 메인 통계 대시보드
├── StatCard.tsx                # 통계 카드 컴포넌트
├── StatChart.tsx               # 차트 래퍼 컴포넌트
│
├── chat/
│   ├── ChatStats.tsx           # 채팅 통계 섹션
│   ├── ChatTimelineChart.tsx   # 시간대별 메시지 차트
│   └── TopSendersList.tsx      # 최다 발신자 목록
│
├── qa/
│   ├── QAStats.tsx             # Q&A 통계 섹션
│   ├── AnswerTimeChart.tsx     # 답변 시간 분포 차트
│   ├── QATimelineChart.tsx     # 시간대별 질문 차트
│   └── TopQuestionersList.tsx  # 최다 질문자 목록
│
├── forms/
│   ├── FormStats.tsx            # 폼 통계 섹션
│   ├── FormDetailStats.tsx     # 폼별 상세 통계
│   └── QuestionStatsChart.tsx  # 문항별 통계 차트
│
├── giveaways/
│   ├── GiveawayStats.tsx       # 추첨 통계 섹션
│   └── GiveawayTimelineChart.tsx # 시간대별 참여 차트
│
├── files/
│   ├── FileStats.tsx            # 파일 통계 섹션
│   └── PopularFilesList.tsx    # 인기 파일 목록
│
└── timeline/
    └── TimelineChart.tsx        # 통합 타임라인 차트
```

### 차트 라이브러리

- **Recharts** (현재 사용 중)
  - 라인 차트: 시간대별 추이
  - 바 차트: 분포, 비교
  - 파이 차트: 비율 표시
  - 영역 차트: 누적 통계

### 데이터 로딩 전략

1. **초기 로딩**: 기본 통계만 로드 (빠른 응답)
2. **지연 로딩**: 각 탭 클릭 시 해당 통계 로드
3. **캐싱**: 통계 데이터를 5분간 캐시하여 성능 최적화
4. **실시간 업데이트**: Supabase Realtime 구독으로 실시간 통계 업데이트 (선택)

---

## 데이터베이스 최적화

### 인덱스 추가

```sql
-- 메시지 통계 최적화
CREATE INDEX IF NOT EXISTS idx_messages_webinar_created 
ON messages(webinar_id, created_at) WHERE hidden = false;

CREATE INDEX IF NOT EXISTS idx_messages_webinar_user 
ON messages(webinar_id, user_id) WHERE hidden = false;

-- 질문 통계 최적화
CREATE INDEX IF NOT EXISTS idx_questions_webinar_created 
ON questions(webinar_id, created_at) WHERE status != 'hidden';

CREATE INDEX IF NOT EXISTS idx_questions_webinar_answered 
ON questions(webinar_id, answered_at) WHERE answered_at IS NOT NULL;

-- 폼 제출 통계 최적화
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_created 
ON form_submissions(form_id, submitted_at);

-- 추첨 참여 통계 최적화
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_created 
ON giveaway_entries(giveaway_id, created_at);

-- 접속 로그 최적화
CREATE INDEX IF NOT EXISTS idx_webinar_access_logs_webinar_logged 
ON webinar_access_logs(webinar_id, logged_at);

-- 등록 통계 최적화
CREATE INDEX IF NOT EXISTS idx_registrations_webinar_created 
ON registrations(webinar_id, created_at);
```

### 파티셔닝 고려사항

대용량 데이터 처리를 위해 다음 테이블에 파티셔닝 고려:

- `messages`: `created_at` 기준 월별 파티셔닝
- `questions`: `created_at` 기준 월별 파티셔닝
- `webinar_access_logs`: `logged_at` 기준 일별 파티셔닝

---

## 성능 고려사항

### 쿼리 최적화

1. **집계 쿼리 최적화**
   - 필요한 컬럼만 SELECT
   - 적절한 인덱스 활용
   - WHERE 절로 불필요한 데이터 제외

2. **병렬 처리**
   - 여러 통계를 동시에 조회할 때 `Promise.all` 사용
   - 데이터베이스 연결 풀 최적화

3. **캐싱 전략**
   - 통계 데이터를 Redis 또는 메모리 캐시에 저장
   - TTL: 5분 (실시간성 요구사항에 따라 조정)

### 대용량 데이터 처리

1. **페이지네이션**
   - 목록 데이터는 페이지네이션 적용
   - 기본 페이지 크기: 20개

2. **샘플링**
   - 매우 큰 데이터셋의 경우 샘플링 적용
   - 예: 시간대별 통계에서 1시간 이상 데이터는 15분 단위로 샘플링

3. **백그라운드 작업**
   - 복잡한 통계 계산은 백그라운드 작업으로 처리
   - 결과를 캐시에 저장하여 빠른 응답

---

## 보안 고려사항

### 데이터 접근 제어

1. **RLS 정책**
   - 모든 통계 쿼리는 RLS 정책을 통해 자동으로 권한 제어
   - 사용자는 자신이 접근 권한이 있는 웨비나의 통계만 조회 가능

2. **개인정보 보호**
   - 통계에서 개인 식별 정보 제거
   - 닉네임만 표시 (이메일, 전화번호 등 제외)

3. **API 인증**
   - 모든 통계 API는 인증된 사용자만 접근 가능
   - JWT 토큰 검증 필수

---

## 마이그레이션 계획

### 단계별 구현

1. **1단계**: 기본 통계 강화 (2주)
   - Q&A 통계 강화
   - 채팅 통계 강화
   - 폼 통계 강화

2. **2단계**: 데이터 수집 시스템 (2주)
   - 접속 로그 수집
   - 다운로드 로그 수집

3. **3단계**: 고급 통계 (2주)
   - 통합 시간대별 통계
   - 통계 대시보드 개선

### 롤백 계획

- 각 단계는 독립적으로 배포 가능
- 문제 발생 시 해당 단계만 롤백
- 데이터 수집 로직은 비활성화 가능하도록 구현

---

## 참고 자료

- [기존 통계 명세서](./webinar-statistics-spec.md)
- [API 라우트 구조](../app/api/)
- [데이터베이스 스키마](../supabase/migrations/)





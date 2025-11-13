# 채팅 시스템 구현 기술 문서

## 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [프론트엔드 구현](#프론트엔드-구현)
5. [백엔드 API](#백엔드-api)
6. [실시간 기능](#실시간-기능)
7. [프로필 정보 표시](#프로필-정보-표시)
8. [성능 최적화](#성능-최적화)
9. [에러 처리](#에러-처리)
10. [보안](#보안)

---

## 개요

웨비나 플랫폼의 실시간 채팅 시스템은 Supabase Realtime을 활용하여 구현되었습니다. Optimistic Update 패턴을 사용하여 사용자 경험을 최적화하고, 프로필 정보를 실시간으로 표시합니다.

### 주요 특징
- ✅ 실시간 메시지 동기화 (Supabase Realtime)
- ✅ Optimistic Update로 즉각적인 UI 반응
- ✅ 프로필 정보 자동 표시
- ✅ 메시지 모더레이션 지원 (숨김 기능)
- ✅ 자동 스크롤 및 메시지 제한
- ✅ RLS 기반 보안

---

## 아키텍처

### 전체 흐름도

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │
       │ 1. 메시지 입력
       ▼
┌─────────────────────────────────┐
│  Chat Component (Frontend)     │
│  - Optimistic Update            │
│  - 프로필 정보 사전 로드        │
└──────┬──────────────────────────┘
       │
       │ 2. POST /api/messages/create
       ▼
┌─────────────────────────────────┐
│  API Route Handler              │
│  - 인증 확인                    │
│  - 메시지 검증                  │
│  - DB 저장 (Admin Supabase)     │
└──────┬──────────────────────────┘
       │
       │ 3. INSERT 이벤트 발생
       ▼
┌─────────────────────────────────┐
│  Supabase Realtime             │
│  - postgres_changes 구독        │
│  - 브로드캐스트                  │
└──────┬──────────────────────────┘
       │
       │ 4. 실시간 업데이트 수신
       ▼
┌─────────────────────────────────┐
│  Chat Component (Frontend)      │
│  - Optimistic 메시지 교체       │
│  - 프로필 정보 업데이트          │
└─────────────────────────────────┘
```

### 컴포넌트 구조

```
components/webinar/Chat.tsx
├── 상태 관리
│   ├── messages: Message[]          // 메시지 목록
│   ├── newMessage: string          // 입력 중인 메시지
│   ├── currentUser: User           // 현재 사용자 정보
│   └── loading/sending: boolean   // 로딩 상태
├── 실시간 구독
│   └── Supabase Realtime Channel   // postgres_changes 구독
├── 메시지 로드
│   └── loadMessages()              // 초기 메시지 로드
└── 메시지 전송
    └── handleSend()                // Optimistic Update + API 호출
```

---

## 데이터베이스 스키마

### messages 테이블

```sql
CREATE TABLE public.messages (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL,
  client_id UUID NOT NULL,
  webinar_id UUID NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_messages_webinar_id ON public.messages(webinar_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
```

### 자동 필드 채움 트리거

```sql
-- webinar_id만으로 작성 시 agency_id/client_id 자동 주입
CREATE OR REPLACE FUNCTION public.fill_org_fields() RETURNS TRIGGER AS $$
DECLARE w RECORD;
BEGIN
  SELECT agency_id, client_id INTO w 
  FROM public.webinars 
  WHERE id = NEW.webinar_id;
  
  IF NEW.agency_id IS NULL THEN 
    NEW.agency_id := w.agency_id; 
  END IF;
  
  IF NEW.client_id IS NULL THEN 
    NEW.client_id := w.client_id; 
  END IF;
  
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_fill_org_fields_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_org_fields();
```

### Realtime 활성화

```sql
-- Supabase Realtime publication에 messages 테이블 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

---

## 프론트엔드 구현

### Chat 컴포넌트 (`components/webinar/Chat.tsx`)

#### Props 인터페이스

```typescript
interface ChatProps {
  webinarId: string              // 웨비나 ID (필수)
  maxMessages?: number           // 최대 표시 메시지 수 (기본값: 50)
  canSend?: boolean              // 메시지 전송 가능 여부 (기본값: true)
  className?: string             // 커스텀 CSS 클래스
  onMessageSent?: (message: Message) => void    // 전송 완료 콜백
  onMessageClick?: (message: Message) => void   // 메시지 클릭 콜백
  renderMessage?: (message: Message) => React.ReactNode  // 커스텀 렌더러
}
```

#### Message 인터페이스

```typescript
interface Message {
  id: number | string            // 실제 메시지는 number, Optimistic은 string
  user_id: string                // 사용자 ID
  content: string                // 메시지 내용
  created_at: string             // 생성 시간 (ISO 8601)
  hidden?: boolean                // 숨김 여부
  user?: {                        // 프로필 정보
    display_name?: string
    email?: string
  }
  isOptimistic?: boolean         // Optimistic Update 플래그
}
```

### 주요 기능

#### 1. 현재 사용자 정보 로드

```typescript
useEffect(() => {
  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // API를 통해 프로필 정보 조회 (RLS 우회)
      const response = await fetch(`/api/profiles/${user.id}`)
      if (response.ok) {
        const { profile } = await response.json()
        setCurrentUser({
          id: user.id,
          display_name: profile?.display_name,
          email: profile?.email,
        })
      }
    }
  }
  loadCurrentUser()
}, [supabase])
```

**특징:**
- API를 통한 프로필 조회로 RLS 정책 우회
- 폴백 로직으로 직접 조회 시도
- 프로필 정보가 없어도 사용자 ID는 설정

#### 2. 메시지 초기 로드

```typescript
const loadMessages = async () => {
  setLoading(true)
  try {
    // API를 통해 메시지 조회 (프로필 정보 포함, RLS 우회)
    const response = await fetch(`/api/webinars/${webinarId}/messages`)
    
    if (!response.ok) {
      throw new Error('메시지 조회 실패')
    }
    
    const { messages } = await response.json()
    setMessages(messages || [])
  } catch (error) {
    // 폴백: 클라이언트에서 직접 조회 시도
    const { data } = await supabase
      .from('messages')
      .select(`
        id, user_id, content, created_at, hidden,
        profiles:user_id (display_name, email)
      `)
      .eq('webinar_id', webinarId)
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(maxMessages)
    
    // 메시지 포맷팅 및 상태 업데이트
  } finally {
    setLoading(false)
  }
}
```

**특징:**
- API 우선 사용 (RLS 우회, 프로필 정보 포함)
- 폴백으로 클라이언트 직접 조회
- 최신 메시지부터 정렬 후 역순으로 표시

#### 3. 실시간 구독 설정

```typescript
useEffect(() => {
  // 고유한 채널 이름 생성 (타임스탬프 포함하여 중복 방지)
  const channelName = `webinar-${webinarId}-messages-${Date.now()}`
  
  const channel = supabase
    .channel(channelName, {
      config: {
        broadcast: { self: false }, // 자신의 메시지는 제외 (Optimistic Update로 처리)
      },
    })
    .on(
      'postgres_changes',
      {
        event: '*',                    // INSERT, UPDATE, DELETE 모두 구독
        schema: 'public',
        table: 'messages',
        filter: `webinar_id=eq.${webinarId}`,
      },
      (payload) => {
        // 이벤트 처리 로직
      }
    )
    .subscribe((status, err) => {
      // 구독 상태 확인
    })
  
  return () => {
    // 채널 구독 해제 및 제거
    channel.unsubscribe().then(() => {
      supabase.removeChannel(channel)
    })
  }
}, [webinarId])
```

**특징:**
- 고유한 채널 이름으로 중복 구독 방지
- `broadcast: { self: false }`로 자신의 메시지 제외 (Optimistic Update 사용)
- 컴포넌트 언마운트 시 채널 완전히 제거

#### 4. 실시간 이벤트 처리

##### INSERT 이벤트

```typescript
if (payload.eventType === 'INSERT') {
  const newMsg = payload.new as any
  if (newMsg && !newMsg.hidden) {
    // 프로필 정보를 API로 빠르게 조회
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profiles/${newMsg.user_id}`)
        if (response.ok) {
          const { profile } = await response.json()
          return profile
        }
      } catch (apiError) {
        // 폴백: 직접 조회 시도
      }
      return null
    }
    
    fetchProfile().then((profile) => {
      setMessages((prev) => {
        // Optimistic 메시지가 있으면 실제 메시지로 교체
        const optimisticIndex = prev.findIndex(
          m => m.isOptimistic && 
          m.user_id === newMsg.user_id && 
          m.content === newMsg.content
        )
        
        if (optimisticIndex !== -1) {
          // Optimistic 메시지를 실제 메시지로 교체
          return prev.map((msg, idx) => 
            idx === optimisticIndex
              ? { ...newMsg, user: profile || msg.user, isOptimistic: false }
              : msg
          ).filter(msg => !msg.isOptimistic || msg.user_id !== newMsg.user_id)
        }
        
        // 새 메시지 추가
        return [...prev, {
          id: newMsg.id,
          user_id: newMsg.user_id,
          content: newMsg.content,
          created_at: newMsg.created_at,
          hidden: newMsg.hidden,
          user: profile,
        }].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    })
  }
}
```

**특징:**
- Optimistic 메시지와 실제 메시지 매칭 (user_id + content)
- 프로필 정보 API 우선 조회
- 중복 메시지 방지 로직

##### UPDATE 이벤트

```typescript
else if (payload.eventType === 'UPDATE') {
  const updatedMsg = payload.new as any
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === updatedMsg.id
        ? { ...msg, ...updatedMsg, hidden: updatedMsg.hidden }
        : msg
    ).filter(msg => !msg.hidden)  // 숨김 메시지 제거
  )
}
```

##### DELETE 이벤트

```typescript
else if (payload.eventType === 'DELETE') {
  const deletedMsg = payload.old as any
  setMessages((prev) => prev.filter((msg) => msg.id !== deletedMsg.id))
}
```

#### 5. Optimistic Update 패턴

```typescript
const handleSend = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!newMessage.trim() || sending || !canSend) return
  
  const messageContent = newMessage.trim()
  const tempId = `temp-${Date.now()}-${Math.random()}`
  const now = new Date().toISOString()
  
  // 프로필 정보가 없으면 먼저 조회
  let userProfile = currentUser
  if (!currentUser.display_name && !currentUser.email) {
    const response = await fetch(`/api/profiles/${currentUser.id}`)
    if (response.ok) {
      const { profile } = await response.json()
      userProfile = { ...currentUser, ...profile }
      setCurrentUser(userProfile)
    }
  }
  
  // Optimistic Update: 즉시 UI에 임시 메시지 추가
  const optimisticMessage: Message = {
    id: tempId,
    user_id: currentUser.id,
    content: messageContent,
    created_at: now,
    hidden: false,
    user: (userProfile.display_name || userProfile.email) ? {
      display_name: userProfile.display_name,
      email: userProfile.email,
    } : undefined,
    isOptimistic: true,
  }
  
  setMessages((prev) => [...prev, optimisticMessage])
  setNewMessage('')
  setSending(true)
  
  try {
    // API를 통해 메시지 전송
    const response = await fetch('/api/messages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webinarId,
        content: messageContent,
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || result.error) {
      // 실패 시 Optimistic 메시지 제거
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      throw new Error(result.error || '메시지 전송 실패')
    }
    
    // 성공 시 Optimistic 메시지는 실시간 구독에서 실제 메시지로 교체됨
    onMessageSent?.(result.message)
  } catch (error: any) {
    // 실패한 메시지를 다시 입력창에 복원
    setNewMessage(messageContent)
    alert(error.message || '메시지 전송에 실패했습니다')
  } finally {
    setSending(false)
  }
}
```

**특징:**
- 프로필 정보 사전 로드로 즉시 이름 표시
- 임시 ID로 Optimistic 메시지 식별
- 실패 시 자동 롤백 및 입력 복원
- 성공 시 실시간 구독에서 자동 교체

#### 6. 자동 스크롤

```typescript
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

---

## 백엔드 API

### 1. 메시지 생성 API

**엔드포인트:** `POST /api/messages/create`

**요청 본문:**
```json
{
  "webinarId": "uuid",
  "content": "메시지 내용 (1-500자)"
}
```

**처리 흐름:**
1. 인증 확인 (`createServerSupabase()`)
2. 웨비나 정보 조회 (`agency_id`, `client_id` 가져오기)
3. 메시지 내용 검증 (1-500자)
4. 메시지 저장 (Admin Supabase 사용)
5. 트리거로 `agency_id`, `client_id` 자동 채움

**응답:**
```json
{
  "success": true,
  "message": {
    "id": 123,
    "webinar_id": "uuid",
    "user_id": "uuid",
    "content": "메시지 내용",
    "created_at": "2025-01-13T...",
    "hidden": false
  }
}
```

**에러 응답:**
- `400`: 필수 파라미터 누락 또는 내용 길이 오류
- `401`: 인증되지 않은 사용자
- `404`: 웨비나를 찾을 수 없음
- `500`: 서버 오류

### 2. 메시지 목록 조회 API

**엔드포인트:** `GET /api/webinars/[webinarId]/messages`

**처리 흐름:**
1. 인증 확인 (`requireAuth()`)
2. 웨비나 존재 확인
3. 사용자 웨비나 등록 확인 및 자동 등록
4. 메시지 조회 (프로필 정보 포함, Admin Supabase 사용)
5. 숨김 메시지 제외, 최신순 정렬, 최대 100개

**응답:**
```json
{
  "messages": [
    {
      "id": 123,
      "user_id": "uuid",
      "content": "메시지 내용",
      "created_at": "2025-01-13T...",
      "hidden": false,
      "user": {
        "display_name": "사용자 이름",
        "email": "user@example.com"
      }
    }
  ]
}
```

**특징:**
- Admin Supabase로 RLS 우회
- 프로필 정보 자동 조인
- 웨비나 자동 등록 기능

### 3. 프로필 정보 조회 API

**엔드포인트:** `GET /api/profiles/[userId]`

**처리 흐름:**
1. 인증 확인
2. 자신의 프로필인지 확인
3. Admin Supabase로 프로필 조회 (RLS 우회)

**응답:**
```json
{
  "profile": {
    "id": "uuid",
    "display_name": "사용자 이름",
    "email": "user@example.com"
  }
}
```

**사용 목적:**
- Optimistic Update에서 프로필 정보 즉시 표시
- 실시간 이벤트에서 프로필 정보 조회
- PresenceBar에서 참여자 이름 표시

### 4. 메시지 수정/삭제 API

**엔드포인트:** `PATCH /api/messages/[messageId]` (숨김 처리)
**엔드포인트:** `DELETE /api/messages/[messageId]` (삭제)

**권한:**
- 슈퍼 관리자
- 클라이언트 소유자/관리자/운영자
- 에이전시 소유자/관리자

---

## 실시간 기능

### Supabase Realtime 설정

#### 1. Realtime 활성화

```sql
-- messages 테이블을 Realtime publication에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

#### 2. 채널 구독

```typescript
const channel = supabase
  .channel(`webinar-${webinarId}-messages-${Date.now()}`, {
    config: {
      broadcast: { self: false },  // 자신의 메시지 제외
    },
  })
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `webinar_id=eq.${webinarId}`,
  }, (payload) => {
    // 이벤트 처리
  })
  .subscribe()
```

#### 3. 구독 상태 관리

```typescript
.subscribe((status, err) => {
  if (status === 'SUBSCRIBED') {
    console.log('✅ 실시간 구독 성공')
  } else if (status === 'CHANNEL_ERROR') {
    console.error('❌ 실시간 구독 오류:', err)
  } else if (status === 'TIMED_OUT') {
    console.warn('⏱️ 실시간 구독 타임아웃')
  } else if (status === 'CLOSED') {
    console.log('🔒 실시간 구독 종료')
  }
})
```

#### 4. 채널 정리

```typescript
return () => {
  channel.unsubscribe().then(() => {
    supabase.removeChannel(channel)
  }).catch((err) => {
    console.warn('채널 구독 해제 오류:', err)
  })
}
```

**특징:**
- 고유한 채널 이름으로 중복 구독 방지
- 컴포넌트 언마운트 시 완전한 정리
- 에러 처리 및 로깅

---

## 프로필 정보 표시

### 문제점 및 해결

**문제:** RLS 정책으로 인해 다른 사용자의 프로필 정보를 읽을 수 없어 "익명"으로 표시됨

**해결 방법:**

1. **RLS 정책 추가**
```sql
-- 같은 웨비나/클라이언트/에이전시 사용자 프로필 읽기 허용
CREATE POLICY "read profiles in same webinar" ON public.profiles
FOR SELECT
USING (
  (id = auth.uid())  -- 자신의 프로필
  OR EXISTS (
    SELECT 1 FROM public.registrations r1
    JOIN public.registrations r2 ON r1.webinar_id = r2.webinar_id
    WHERE r1.user_id = auth.uid() AND r2.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.client_members cm1
    JOIN public.client_members cm2 ON cm1.client_id = cm2.client_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.agency_members am1
    JOIN public.agency_members am2 ON am1.agency_id = am2.agency_id
    WHERE am1.user_id = auth.uid() AND am2.user_id = profiles.id
  )
);
```

2. **API 엔드포인트 생성**
- `/api/profiles/[userId]` 엔드포인트로 Admin Supabase 사용
- RLS 우회하여 프로필 정보 조회

3. **프로필 정보 사전 로드**
- 컴포넌트 마운트 시 현재 사용자 프로필 로드
- 메시지 전송 전 프로필 정보 확인 및 로드
- 실시간 이벤트 수신 시 프로필 정보 즉시 조회

### 프로필 표시 우선순위

```typescript
{message.user?.display_name || message.user?.email || '익명'}
```

1. `display_name` (우선)
2. `email` (차선)
3. "익명" (폴백)

---

## 성능 최적화

### 1. Optimistic Update

- **목적:** 네트워크 지연을 사용자가 느끼지 않도록 즉시 UI 업데이트
- **구현:** 임시 메시지를 즉시 표시하고, 서버 응답 후 실제 메시지로 교체
- **효과:** 체감 응답 시간 단축

### 2. 프로필 정보 캐싱

- 현재 사용자 프로필 정보를 컴포넌트 상태에 저장
- Optimistic 메시지 생성 시 재사용
- 실시간 이벤트에서도 프로필 정보 재사용

### 3. 메시지 제한

- 초기 로드: 최대 50개 (기본값)
- API 조회: 최대 100개
- 불필요한 데이터 전송 방지

### 4. 중복 방지

- Optimistic 메시지와 실제 메시지 매칭 로직
- 동일 ID 메시지 중복 추가 방지
- 실시간 이벤트 중복 처리 방지

### 5. 폴백 메커니즘

- API 실패 시 클라이언트 직접 조회
- 프로필 조회 실패 시 재시도 로직
- 네트워크 오류에 대한 복원력

---

## 에러 처리

### 1. 메시지 전송 실패

```typescript
if (!response.ok || result.error) {
  // Optimistic 메시지 제거
  setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
  // 입력창에 메시지 복원
  setNewMessage(messageContent)
  // 에러 알림
  alert(error.message || '메시지 전송에 실패했습니다')
}
```

### 2. 실시간 구독 실패

```typescript
if (status === 'CHANNEL_ERROR') {
  console.error('❌ 실시간 구독 오류:', err)
  console.warn('⚠️ Realtime이 활성화되지 않았을 수 있습니다.')
}
```

### 3. 프로필 조회 실패

- API 실패 시 폴백으로 직접 조회 시도
- 프로필 정보 없이도 메시지 표시
- 나중에 프로필 정보 업데이트 시도 (1초 후)

---

## 보안

### 1. 인증 및 권한

- 모든 API 엔드포인트에서 인증 확인
- 웨비나 등록 확인 후 메시지 조회 허용
- RLS 정책으로 데이터베이스 레벨 보안

### 2. 입력 검증

- 메시지 내용: 1-500자 제한
- 공백만 있는 메시지 거부
- XSS 방지를 위한 텍스트만 허용

### 3. RLS 정책

```sql
-- 메시지 읽기 정책
CREATE POLICY "read messages if in scope" ON public.messages
FOR SELECT
USING (
  (SELECT is_super_admin FROM public.me) IS TRUE
  OR EXISTS (SELECT 1 FROM public.my_agencies a WHERE a.agency_id = messages.agency_id)
  OR EXISTS (SELECT 1 FROM public.my_clients c WHERE c.client_id = messages.client_id)
  OR EXISTS (
    SELECT 1 FROM public.registrations r 
    WHERE r.webinar_id = messages.webinar_id AND r.user_id = auth.uid()
  )
);
```

### 4. Admin Supabase 사용

- API 엔드포인트에서 Admin Supabase 사용
- RLS 우회 후 애플리케이션 레벨 권한 체크
- 무한 재귀 문제 해결

---

## 사용 예시

### 기본 사용

```tsx
import Chat from '@/components/webinar/Chat'

<Chat 
  webinarId={webinar.id}
  canSend={true}
  onMessageSent={(message) => {
    console.log('메시지 전송 완료:', message)
  }}
/>
```

### 커스텀 렌더러

```tsx
<Chat
  webinarId={webinar.id}
  renderMessage={(message) => (
    <div className="custom-message">
      <strong>{message.user?.display_name}</strong>
      <p>{message.content}</p>
    </div>
  )}
/>
```

### 메시지 클릭 핸들러

```tsx
<Chat
  webinarId={webinar.id}
  onMessageClick={(message) => {
    // 메시지 상세 정보 표시
    showMessageDetail(message)
  }}
/>
```

---

## 향후 개선 사항

### 1. 타이핑 표시
- Broadcast 채널을 활용한 타이핑 상태 전파
- "입력 중..." 표시 기능

### 2. 메시지 페이징
- 무한 스크롤 또는 페이지네이션
- 오래된 메시지 지연 로드

### 3. 메시지 검색
- 웨비나 내 메시지 검색 기능
- 키워드 하이라이트

### 4. 파일 첨부
- 이미지/파일 업로드 지원
- Supabase Storage 연동

### 5. 이모지 지원
- 이모지 피커 추가
- 이모지 반응 기능

### 6. 메시지 수정
- 전송한 메시지 수정 기능
- 수정 이력 표시

---

## 참고 자료

- [Supabase Realtime 문서](https://supabase.com/docs/guides/realtime)
- [Next.js App Router 문서](https://nextjs.org/docs/app)
- [React Optimistic Updates 패턴](https://react.dev/reference/react/useOptimistic)

---

**작성일:** 2025-01-13  
**최종 수정일:** 2025-01-13  
**버전:** 1.0.0


# Realtime 연결 문제 근본 원인 분석 보고서

## 📋 현재 설계 및 구동 방식

### 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    브라우저 (클라이언트)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WebinarView Component                              │   │
│  │  - 모바일/데스크톱 레이아웃 분리                     │   │
│  │  - useMemo로 Chat/QA 단일 인스턴스 보장              │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Chat Component                                     │   │
│  │  - Supabase Realtime 구독                           │   │
│  │  - 폴백 폴링 (15초 주기)                            │   │
│  │  - 재연결 로직 (수동)                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Supabase Client (싱글턴)                           │   │
│  │  - createClientSupabase()                           │   │
│  │  - useMemo로 고정                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                      │
└────────────────────────┼──────────────────────────────────────┘
                         │ WebSocket (wss://)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Realtime 서버                          │
│  - PostgreSQL 변경사항 감지 (WAL)                            │
│  - WebSocket 연결 관리                                       │
│  - 자동 재연결 메커니즘 (SDK 내부)                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. 현재 구현 상세

#### 2.1 Supabase 클라이언트 생성 (`lib/supabase/client.ts`)

```typescript
// 싱글턴 패턴으로 한 번만 생성
let supabaseClientInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClientSupabase() {
  if (supabaseClientInstance) {
    return supabaseClientInstance  // 재사용
  }
  
  supabaseClientInstance = createBrowserClient(...)
  
  // Auth 상태 변경 시 Realtime 토큰 주입
  supabaseClientInstance.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      supabaseClientInstance!.realtime.setAuth(session.access_token)
    }
  })
  
  return supabaseClientInstance
}
```

**특징:**
- ✅ 싱글턴 패턴으로 인스턴스 재사용
- ✅ Auth 상태 변경 시 자동 토큰 주입
- ⚠️ **문제**: `onAuthStateChange`가 여러 번 호출될 수 있음

#### 2.2 Chat 컴포넌트 Realtime 구독 (`components/webinar/Chat.tsx`)

```typescript
useEffect(() => {
  const setupRealtimeSubscription = async () => {
    // 1. 기존 채널 정리
    const existingChannel = supabase.getChannels().find(...)
    if (existingChannel) {
      await existingChannel.unsubscribe()
      supabase.removeChannel(existingChannel)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // 2. 새 채널 생성 및 구독
    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { ... }, (payload) => { ... })
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectTriesRef.current = 0
          // 성공 처리
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          reconnectTriesRef.current++
          
          // 3회 실패 시 폴백 활성화
          if (reconnectTriesRef.current >= 3) {
            setFallbackOn(true)
            // 재연결 중단
            return
          }
          
          // 토큰 재주입
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            supabase.realtime.setAuth(session.access_token)
          }
          
          // 재연결 타이머 설정
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectKey(prev => prev + 1)  // useEffect 재실행
          }, delay)
        }
      })
    
    channelRef.current = channel
  }
  
  setupRealtimeSubscription()
  
  return () => {
    // cleanup: 채널 정리
    if (channelRef.current) {
      channelRef.current.unsubscribe().then(() => {
        supabase.removeChannel(channelRef.current)
      })
    }
    // 타이머 정리
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
  }
}, [webinarId, currentUser?.id, reconnectKey])
```

**특징:**
- ✅ 기존 채널 정리 후 새 채널 생성
- ✅ 재연결 시도 횟수 제한 (3회)
- ✅ 폴백 폴링 활성화
- ⚠️ **문제**: Supabase SDK의 자동 재연결과 충돌

#### 2.3 폴백 폴링 (`components/webinar/Chat.tsx`)

```typescript
useEffect(() => {
  if (!fallbackOn) return
  
  const pollWithJitter = async () => {
    // 15초 주기 + 지터로 폴링
    const response = await fetch(`/api/webinars/${webinarId}/messages?...`)
    
    if (response.ok) {
      // 새 메시지 처리
    }
    
    // 다음 폴링 예약
    setTimeout(pollWithJitter, nextDelay)
  }
  
  pollWithJitter()
  
  return () => {
    // 모든 폴링 타이머 취소
  }
}, [fallbackOn, webinarId])
```

**특징:**
- ✅ 15초 주기 + 지터 (±5초)
- ✅ 가시성/온라인 상태 확인
- ✅ 지수 백오프
- ✅ 모든 타이머 추적 및 cleanup

---

## 🔴 핵심 문제점 분석

### 문제 1: Supabase Realtime SDK의 자동 재연결 메커니즘과 충돌

**현상:**
```
로그에서 보이는 스택 트레이스:
- _rejoin
- subscribe
- resend
- startTimeout
```

**원인:**
1. **Supabase Realtime SDK는 내부적으로 자동 재연결 메커니즘을 가지고 있습니다.**
   - WebSocket 연결이 끊기면 SDK가 자동으로 `_rejoin()`을 호출
   - `_rejoin()`은 내부적으로 `subscribe()`를 다시 호출
   - 이것이 우리의 `subscribe` 콜백을 다시 트리거

2. **우리의 수동 재연결 로직과 SDK의 자동 재연결이 동시에 작동:**
   ```
   TIMED_OUT 발생
   ├─> 우리 코드: reconnectTriesRef.current++ (4가 됨)
   ├─> 우리 코드: reconnectTriesRef.current >= 3이므로 재연결 중단
   └─> SDK 내부: _rejoin() 호출 → subscribe() 재시도
       └─> 우리의 subscribe 콜백이 다시 호출됨
           └─> TIMED_OUT 다시 발생 → 무한 루프
   ```

3. **`reconnectTriesRef.current >= 3` 체크가 SDK의 자동 재연결을 막지 못함:**
   - 우리는 `setupRealtimeSubscription` 함수 시작 부분에서 체크
   - 하지만 SDK는 이미 채널을 생성한 후에 자동으로 재연결을 시도
   - 따라서 우리의 체크가 SDK의 재연결을 막지 못함

**증거:**
- 로그에서 `retryCount: 4`가 나오는 것은 우리의 카운터가 계속 증가하고 있다는 의미
- 스택 트레이스에서 `_rejoin`, `subscribe`가 반복적으로 호출되는 것은 SDK의 자동 재연결이 작동하고 있다는 의미

### 문제 2: 채널 정리 타이밍 문제

**현상:**
- "기존 채널 발견, 제거 중" 로그가 반복적으로 나타남
- 채널이 완전히 정리되기 전에 새 채널이 생성됨

**원인:**
1. **비동기 정리와 동기 생성의 경쟁 상태:**
   ```typescript
   await existingChannel.unsubscribe()  // 비동기
   supabase.removeChannel(existingChannel)  // 동기
   await new Promise(resolve => setTimeout(resolve, 100))  // 100ms 대기
   
   // 하지만 SDK의 자동 재연결이 이 사이에 개입할 수 있음
   const channel = supabase.channel(...)  // 새 채널 생성
   ```

2. **SDK의 자동 재연결이 채널 정리 중에 발생:**
   - 기존 채널이 아직 완전히 정리되지 않은 상태에서 SDK가 재연결 시도
   - 새 채널과 기존 채널이 동시에 존재
   - 이것이 연결 불안정을 유발

### 문제 3: 토큰 재주입 타이밍 문제

**현상:**
- "토큰 재주입 완료" 로그가 나오지만 여전히 TIMED_OUT 발생

**원인:**
1. **토큰 재주입이 채널 재구독보다 먼저 발생:**
   ```typescript
   // 토큰 재주입
   supabase.realtime.setAuth(session.access_token)
   
   // 재연결 타이머 설정
   reconnectTimeoutRef.current = setTimeout(() => {
     setReconnectKey(prev => prev + 1)  // useEffect 재실행
   }, delay)
   ```
   
   - 토큰을 재주입했지만, 기존 채널은 이미 생성되어 있음
   - 기존 채널은 이전 토큰으로 생성되었을 수 있음
   - 새 토큰이 적용되려면 채널을 다시 생성해야 함

2. **SDK의 자동 재연결이 토큰 재주입을 무시:**
   - SDK가 자동으로 재연결할 때 이전 토큰을 사용할 수 있음
   - 우리가 토큰을 재주입해도 SDK의 내부 상태가 업데이트되지 않을 수 있음

### 문제 4: useEffect 의존성으로 인한 불필요한 재실행

**현재 의존성:**
```typescript
useEffect(() => {
  // ...
}, [webinarId, currentUser?.id, reconnectKey])
```

**문제:**
1. **`currentUser?.id`가 변경되면 전체 구독이 재시작됨:**
   - 사용자 정보가 업데이트될 때마다 채널이 재생성됨
   - 이것이 불필요한 재연결을 유발할 수 있음

2. **`reconnectKey` 변경 시 전체 구독 재시작:**
   - 재연결 시 전체 구독 로직이 다시 실행됨
   - 기존 채널 정리 → 새 채널 생성 과정이 반복됨
   - 이 과정에서 SDK의 자동 재연결과 충돌 가능

### 문제 5: 폴백 모드에서도 SDK의 자동 재연결이 계속 작동

**현상:**
- "재연결 시도 횟수 초과, 폴백 모드 유지" 로그가 나오지만 여전히 TIMED_OUT 발생

**원인:**
1. **우리는 재연결을 중단했지만 SDK는 계속 재연결을 시도:**
   ```typescript
   if (reconnectTriesRef.current >= 3 && fallbackOn) {
     console.log('재연결 시도 횟수 초과, 폴백 모드 유지')
     return  // 우리의 재연결 중단
   }
   ```
   
   - 이것은 우리의 `setupRealtimeSubscription` 함수만 중단시킴
   - 하지만 SDK는 이미 채널을 생성했고, 내부적으로 계속 재연결을 시도
   - SDK의 자동 재연결을 막을 방법이 없음

2. **채널이 여전히 존재하므로 SDK가 계속 재연결 시도:**
   - `channelRef.current`에 채널이 저장되어 있음
   - SDK는 이 채널을 계속 재연결하려고 시도
   - 우리가 채널을 명시적으로 제거하지 않는 한 SDK는 계속 시도

---

## 🎯 근본 원인 요약

### 핵심 문제: **이중 재연결 메커니즘 충돌**

1. **Supabase Realtime SDK의 자동 재연결** (제어 불가)
   - SDK 내부에서 WebSocket 연결이 끊기면 자동으로 `_rejoin()` 호출
   - 우리가 이를 막을 방법이 없음

2. **우리의 수동 재연결 로직** (제어 가능)
   - `reconnectTriesRef`로 재시도 횟수 제한
   - `setReconnectKey`로 useEffect 재실행
   - 하지만 SDK의 자동 재연결과 충돌

3. **결과:**
   - SDK가 자동으로 재연결 시도 → 우리의 `subscribe` 콜백 호출
   - 우리는 재연결을 중단하려고 하지만 SDK는 계속 시도
   - 무한 루프 발생

### 부차적 문제들

1. **채널 정리 타이밍**: 비동기 정리와 동기 생성의 경쟁 상태
2. **토큰 재주입 타이밍**: 토큰 재주입이 채널 재생성보다 먼저 발생
3. **useEffect 의존성**: 불필요한 재실행으로 인한 재연결 유발
4. **폴백 모드에서도 SDK 재연결**: 채널이 존재하는 한 SDK는 계속 재연결 시도

---

## 📊 현재 문제 발생 시나리오

### 시나리오 1: 정상 연결 후 네트워크 불안정

```
1. 초기 연결 성공 (SUBSCRIBED)
2. 네트워크 불안정으로 WebSocket 연결 끊김
3. SDK 자동 재연결 시도 (_rejoin)
4. 우리의 subscribe 콜백 호출 → TIMED_OUT
5. reconnectTriesRef.current++ (1)
6. 우리: 재연결 타이머 설정 (1초 후)
7. SDK: 계속 자동 재연결 시도
8. 우리의 subscribe 콜백 다시 호출 → TIMED_OUT
9. reconnectTriesRef.current++ (2)
10. 우리: 재연결 타이머 설정 (2초 후)
11. SDK: 계속 자동 재연결 시도
12. 우리의 subscribe 콜백 다시 호출 → TIMED_OUT
13. reconnectTriesRef.current++ (3)
14. 우리: 폴백 활성화, 재연결 중단
15. 하지만 SDK는 계속 자동 재연결 시도
16. 우리의 subscribe 콜백 다시 호출 → TIMED_OUT
17. reconnectTriesRef.current++ (4) ← 이미 3을 넘었지만 계속 증가
18. 무한 루프...
```

### 시나리오 2: 채널 정리 중 SDK 재연결

```
1. 기존 채널 정리 시작 (unsubscribe)
2. SDK가 자동 재연결 시도 (_rejoin)
3. 새 채널 생성 시도
4. 기존 채널 정리 완료 전에 새 채널 생성
5. 두 채널이 동시에 존재
6. 연결 불안정
7. TIMED_OUT 발생
8. 무한 루프...
```

---

## 🔍 로그 분석

### 현재 로그에서 보이는 패턴:

```
토큰 재주입 완료
재연결 시도 횟수 초과, 폴백 모드 유지
실시간 구독 상태: {status: 'TIMED_OUT', ...}
⚠️ 실시간 구독 실패 (TIMED_OUT) {retryCount: 4, maxRetries: 3, ...}
🔴 실시간 구독 3회 실패, 폴백 폴링 활성화 (재연결 중단)
```

**분석:**
1. `retryCount: 4` → 우리의 카운터가 3을 넘어서 계속 증가하고 있음
2. "재연결 시도 횟수 초과, 폴백 모드 유지" → 우리는 재연결을 중단하려고 함
3. 하지만 여전히 "실시간 구독 상태: TIMED_OUT" → SDK가 계속 재연결 시도
4. 스택 트레이스에서 `_rejoin`, `subscribe` 반복 → SDK의 자동 재연결이 작동 중

---

## 💡 해결 방향

### 방향 1: SDK의 자동 재연결을 완전히 비활성화하고 우리가 완전히 제어

**장점:**
- 재연결 로직을 완전히 제어 가능
- 예측 가능한 동작

**단점:**
- SDK의 자동 재연결 기능을 사용할 수 없음
- 모든 재연결 로직을 직접 구현해야 함

### 방향 2: SDK의 자동 재연결을 활용하고 우리의 수동 재연결 제거

**장점:**
- SDK의 검증된 재연결 로직 활용
- 코드 단순화

**단점:**
- SDK의 재연결 동작을 완전히 제어할 수 없음
- 재연결 횟수 제한 등을 설정하기 어려움

### 방향 3: 하이브리드 접근 - SDK 재연결 허용하되 채널을 완전히 제거하여 중단

**장점:**
- SDK의 자동 재연결 활용
- 필요시 채널 제거로 재연결 중단 가능

**단점:**
- 채널 제거 타이밍이 중요
- 여전히 경쟁 상태 가능성

---

## 📝 다음 단계

1. **SDK 문서 확인**: Supabase Realtime SDK의 자동 재연결 메커니즘 정확히 이해
2. **채널 제거 전략**: 폴백 모드 진입 시 채널을 완전히 제거하여 SDK 재연결 중단
3. **토큰 관리 개선**: 토큰 재주입 타이밍 최적화
4. **의존성 최적화**: useEffect 의존성 최소화
5. **로깅 강화**: SDK의 자동 재연결 시도 추적


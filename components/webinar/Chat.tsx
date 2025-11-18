'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import type { BroadcastEnvelope, ChatMessagePayload } from '@/lib/webinar/realtime'
import { isValidBroadcastEnvelope } from '@/lib/webinar/realtime'

interface Message {
  id: number | string // 임시 메시지는 문자열 ID 사용
  user_id: string
  content: string
  created_at: string
  hidden?: boolean
  user?: {
    id?: string
    display_name?: string
    email?: string
  }
  isOptimistic?: boolean // Optimistic Update 플래그
  client_msg_id?: string // 클라이언트 메시지 ID (정확한 매칭용)
}

interface ChatProps {
  /** 웨비나 ID */
  webinarId: string
  /** 최대 표시 메시지 수 */
  maxMessages?: number
  /** 메시지 전송 가능 여부 */
  canSend?: boolean
  /** 커스텀 클래스명 */
  className?: string
  /** 메시지 전송 콜백 */
  onMessageSent?: (message: Message) => void
  /** 메시지 클릭 콜백 */
  onMessageClick?: (message: Message) => void
  /** 커스텀 메시지 렌더러 */
  renderMessage?: (message: Message) => React.ReactNode
  /** 관리자 모드 */
  isAdminMode?: boolean
}

/**
 * 실시간 채팅 컴포넌트
 * 모듈화되어 재사용 가능하며 커스터마이징 가능
 */
export default function Chat({
  webinarId,
  maxMessages = 50,
  canSend = true,
  className = '',
  onMessageSent,
  onMessageClick,
  renderMessage,
  isAdminMode = false,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false) // 상단 더보기 로딩 상태
  const [sending, setSending] = useState(false)
  const [fallbackOn, setFallbackOn] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0) // 재연결을 위한 키
  const [currentUser, setCurrentUser] = useState<{ id: string; display_name?: string; email?: string } | null>(null)
  const [nextCursor, setNextCursor] = useState<{ beforeTs: string; beforeId: number } | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null) // 상단 sentinel
  const messagesContainerRef = useRef<HTMLDivElement>(null) // 메시지 컨테이너
  const sendingClientMsgIdRef = useRef<string | null>(null)
  const lastEventAt = useRef<number>(Date.now())
  const lastMessageIdRef = useRef<number>(0)
  const reconnectTriesRef = useRef<number>(0)
  const initialLoadTimeRef = useRef<number>(0) // 초기 로드 완료 시간
  const etagRef = useRef<string | null>(null) // ETag 캐시
  const pollBackoffRef = useRef<number>(0) // 폴링 백오프 (에러 시 증가)
  const lastWebinarIdRef = useRef<string | null>(null) // 마지막 webinarId 추적
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 재연결 타이머
  const fallbackReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 폴백 재연결 타이머
  const channelRef = useRef<any>(null) // 현재 채널 참조 (cleanup용)
  const isSettingUpRef = useRef<boolean>(false) // 채널 설정 중 플래그
  const channelNameRef = useRef<string | null>(null) // 현재 채널명 (cleanup용)
  const manualCloseRef = useRef<boolean>(false) // 수동 종료 플래그 (A번 수정안)
  const pendingEventsRef = useRef<BroadcastEnvelope<ChatMessagePayload>[]>([]) // 초기 로드 중 이벤트 버퍼링 (해결책.md A안)
  const seenMidRef = useRef<Set<string>>(new Set()) // envelope 단위 중복 제거 (해결책.md 3번)
  // Supabase 클라이언트를 useMemo로 명시적 고정 (해결책.md 권장사항)
  const supabase = useMemo(() => createClientSupabase(), [])
  
  // 최근 메시지만 유지하는 윈도우 크기 (50~100개)
  const MAX_MESSAGES_WINDOW = 100
  
  // 현재 사용자 정보 로드 및 관리자 여부 확인
  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          // 웨비나 등록 정보 확인 (참여자 여부)
          const [registrationResponse, profileResponse, adminCheckResponse] = await Promise.all([
            supabase
              .from('registrations')
              .select('role')
              .eq('webinar_id', webinarId)
              .eq('user_id', user.id)
              .maybeSingle(),
            fetch(`/api/profiles/${user.id}`),
            fetch(`/api/webinars/${webinarId}/check-admin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userIds: [user.id] }),
            })
          ])
          
          const registration = registrationResponse.data as { role?: string } | null
          const isParticipant = (registration as any)?.role === 'attendee'
          
          // 관리자 여부 확인
          let isAdmin = false
          if (adminCheckResponse.ok) {
            const adminResult = await adminCheckResponse.json()
            isAdmin = adminResult.adminUserIds?.includes(user.id) || false
          }
          
          let profile = null
          if (profileResponse.ok) {
            const result = await profileResponse.json()
            profile = result.profile
          }
          
          setCurrentUser({
            id: user.id,
            display_name: isAdmin || !isParticipant
              ? '관리자'
              : ((profile as any)?.display_name || (profile as any)?.email || '익명'),
            email: (profile as any)?.email,
          })
          return
        } catch (apiError) {
          console.warn('API를 통한 프로필 조회 실패:', apiError)
        }
        
        // 폴백: 직접 조회 시도
        try {
          // 웨비나 등록 정보 확인
          const { data: registration } = await supabase
            .from('registrations')
            .select('role')
            .eq('webinar_id', webinarId)
            .eq('user_id', user.id)
            .maybeSingle()
          
          const isParticipant = (registration as any)?.role === 'attendee'
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', user.id)
            .single()
          
          setCurrentUser({
            id: user.id,
            display_name: isParticipant 
              ? ((profile as any)?.display_name || (profile as any)?.email || '익명')
              : '관리자',
            email: (profile as any)?.email,
          })
        } catch (error) {
          console.warn('직접 프로필 조회 실패:', error)
          // 프로필 정보가 없어도 사용자 ID는 설정
          // 기본적으로 관리자로 표시 (참여자 여부 확인 불가)
          setCurrentUser({
            id: user.id,
            display_name: '관리자',
          })
        }
      }
    }
    loadCurrentUser()
  }, [supabase, webinarId])
  
  // 초기 메시지 로드 (최근 메시지)
  const loadMessages = async (isInitial = true) => {
    if (isInitial) {
      setLoading(true)
    }
    
    try {
      // API를 통해 메시지 조회 (프로필 정보 포함, RLS 우회)
      const limit = isInitial ? 10 : 20 // 초기: 10개, 더보기: 20개
      let response: Response
      
      try {
        // ETag가 있고 초기 로드인 경우 If-None-Match 헤더 추가
        const headers: HeadersInit = {}
        if (etagRef.current && isInitial) {
          headers['If-None-Match'] = etagRef.current
        }
        
        response = await fetch(`/api/webinars/${webinarId}/messages?limit=${limit}`, {
          credentials: 'include', // 쿠키 포함
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        })
      } catch (fetchError: any) {
        // fetch 호출 자체가 실패한 경우 (네트워크 오류 등)
        if (fetchError.name === 'TypeError' && fetchError.message === 'Failed to fetch') {
          console.warn('네트워크 오류: 메시지 조회 실패 (서버 연결 불가)')
          // 네트워크 오류는 조용히 처리 (폴백 폴링이 있으므로)
          if (isInitial) {
            setMessages([])
          }
          return
        }
        // 기타 fetch 오류는 다시 throw
        throw fetchError
      }
      
      if (!response.ok) {
        // 401 에러인 경우 인증 상태 확인
        if (response.status === 401) {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            console.warn('인증 세션이 없습니다. 로그인 페이지로 이동합니다.')
            // 로그인 페이지로 리다이렉트 (현재 페이지 URL을 쿼리 파라미터로 전달)
            const currentUrl = window.location.href
            window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`
            return
          }
          // 세션이 있는데도 401이면 토큰 갱신 시도
          console.warn('인증 토큰이 만료되었을 수 있습니다. 토큰 갱신 시도...')
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError || !refreshedSession) {
            console.error('토큰 갱신 실패:', refreshError)
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`
            return
          }
          // 토큰 갱신 후 재시도
          console.log('토큰 갱신 성공, 메시지 조회 재시도...')
          // 재귀 호출로 재시도 (무한 루프 방지를 위해 한 번만)
          return loadMessages(isInitial)
        }
        
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText.substring(0, 200) }
        }
        console.error('메시지 조회 API 에러:', response.status, errorData)
        throw new Error(errorData.error || `메시지 조회 실패 (${response.status})`)
      }
      
      // ETag 업데이트 (304가 아닌 경우)
      if (response.status !== 304) {
        const newEtag = response.headers.get('ETag')
        if (newEtag) {
          etagRef.current = newEtag
        }
      }
      
      // 304 Not Modified: 데이터 변경 없음
      if (response.status === 304) {
        const newEtag = response.headers.get('ETag')
        if (newEtag) {
          etagRef.current = newEtag
        }
        // 초기 로드인 경우 빈 배열로 설정하지 않고 기존 상태 유지
        if (isInitial) {
          setLoading(false)
        }
        return
      }
      
      const result = await response.json()
      
      if (!result.success) {
        console.error('메시지 조회 실패:', result)
        throw new Error(result.error || '메시지 조회 실패')
      }
      
      // API에서 이미 pd@ustudio.co.kr 이메일은 "관리자"로 표시하도록 처리됨
      const { messages: loadedMessages, nextCursor: cursor, hasMore: more } = result
      
      // 마지막 메시지 ID 업데이트 (폴백 폴링용)
      if (loadedMessages.length > 0) {
        lastMessageIdRef.current = Math.max(
          ...loadedMessages.map((m: Message) => typeof m.id === 'number' ? m.id : 0),
          lastMessageIdRef.current
        )
      }
      
      if (isInitial) {
        setMessages(loadedMessages || [])
        // 초기 로드 완료 시간 기록
        initialLoadTimeRef.current = Date.now()
        
        // 해결책.md A안: 버퍼링된 이벤트 처리
        if (pendingEventsRef.current.length > 0) {
          console.log(`📦 버퍼링된 이벤트 ${pendingEventsRef.current.length}개 처리 시작`)
          // 버퍼링된 이벤트를 순차적으로 처리
          // 주의: 이벤트는 이미 broadcast 핸들러에서 처리되므로, 여기서는 단순히 재트리거
          // 실제로는 이벤트를 다시 발생시키는 대신, 메시지 목록과 비교하여 누락된 메시지만 추가
          const bufferedEvents = [...pendingEventsRef.current]
          pendingEventsRef.current = []
          
          // 버퍼링된 이벤트 중 chat:new 이벤트만 처리
          bufferedEvents.forEach((env) => {
            // 버퍼링된 이벤트도 mid 중복 체크
            if (env?.mid && typeof env.mid === 'string') {
              const seen = seenMidRef.current
              if (seen.has(env.mid)) {
                console.log('📦 버퍼링된 이벤트 중복(mid) 무시:', env.mid)
                return // 중복이면 스킵
              }
              seen.add(env.mid)
            }
            
            if (env.t === 'chat:new') {
              const newMsg = env.payload as ChatMessagePayload
              if (newMsg && !newMsg.hidden) {
                // 메시지 목록에 이미 있는지 확인
                const existingMessages = loadedMessages || []
                const isDuplicate = existingMessages.some(
                  (m: Message) => m.id === newMsg.id || 
                  (newMsg.client_msg_id && m.client_msg_id === newMsg.client_msg_id)
                )
                
                if (!isDuplicate) {
                  console.log('📦 버퍼링된 메시지 추가:', newMsg.id)
                  // 메시지 추가 (프로필 정보는 나중에 로드)
                  setMessages((prev) => {
                    const updated = [...prev, {
                      id: newMsg.id,
                      user_id: newMsg.user_id,
                      content: newMsg.content,
                      created_at: newMsg.created_at,
                      hidden: newMsg.hidden,
                      user: undefined,
                      client_msg_id: newMsg.client_msg_id,
                    }].sort((a, b) => 
                      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    )
                    
                    // lastMessageIdRef 갱신
                    if (typeof newMsg.id === 'number') {
                      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMsg.id)
                    }
                    
                    return updated
                  })
                  
                  // 프로필 정보 비동기 로드
                  fetch(`/api/profiles/${newMsg.user_id}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(result => {
                      if (result?.profile) {
                        setMessages((prev) => prev.map(m => 
                          m.id === newMsg.id 
                            ? { ...m, user: result.profile }
                            : m
                        ))
                      }
                    })
                    .catch(() => {})
                }
              }
            }
          })
        }
      } else {
        // 더보기: 기존 메시지 앞에 추가
        setMessages((prev) => {
          const combined = [...(loadedMessages || []), ...prev]
          // 중복 제거 (id 기준)
          const uniqueMap = new Map()
          combined.forEach((msg) => {
            uniqueMap.set(String(msg.id), msg)
          })
          const unique = Array.from(uniqueMap.values())
          
          // 최대 윈도우 크기 제한 (가장 오래된 것부터 제거)
          if (unique.length > MAX_MESSAGES_WINDOW) {
            return unique.slice(-MAX_MESSAGES_WINDOW)
          }
          return unique
        })
      }
      
      setNextCursor(cursor)
      setHasMore(more)
    } catch (error: any) {
      // fetch 호출 자체가 실패한 경우는 이미 처리됨
      // 여기서는 response 처리 중 발생한 에러만 처리
      console.error('메시지 로드 실패:', error)
      
      // 네트워크 오류인 경우 (이미 처리되었지만 안전장치)
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.warn('네트워크 오류: 서버에 연결할 수 없습니다.')
        // 네트워크 오류는 사용자에게 알리지 않고 조용히 처리
        // (폴백 폴링이나 재시도가 있으므로)
      } else {
        // 기타 에러는 콘솔에만 기록
        console.error('메시지 로드 중 오류:', error.message || error)
      }
      
      // 에러 발생 시 즉시 종료 (고착 방지)
      if (isInitial) {
        setMessages([])
      }
    } finally {
      if (isInitial) {
        setLoading(false)
      }
    }
  }
  
  // 상단 더보기 (과거 메시지 로드)
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !nextCursor || !hasMore) return
    
    setLoadingMore(true)
    
    try {
      const { beforeTs, beforeId } = nextCursor
      const response = await fetch(
        `/api/webinars/${webinarId}/messages?limit=20&beforeTs=${encodeURIComponent(beforeTs)}&beforeId=${beforeId}`,
        {
          credentials: 'include', // 쿠키 포함
        }
      )
      
      if (!response.ok) {
        // 401 에러인 경우 인증 상태 확인
        if (response.status === 401) {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            console.warn('인증 세션이 없습니다. 로그인 페이지로 이동합니다.')
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`
            return
          }
          // 세션이 있는데도 401이면 토큰 갱신 시도
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError || !refreshedSession) {
            console.error('토큰 갱신 실패:', refreshError)
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`
            return
          }
          // 토큰 갱신 후 재시도
          return loadMoreMessages()
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '메시지 더보기 실패')
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '메시지 더보기 실패')
      }
      
      const { messages: loadedMessages, nextCursor: cursor, hasMore: more } = result
      
      if (loadedMessages.length > 0) {
        // 스크롤 복원을 위한 높이 저장
        const container = messagesContainerRef.current
        const prevScrollHeight = container?.scrollHeight || 0
        
        // 기존 메시지 앞에 추가
        setMessages((prev) => {
          const combined = [...loadedMessages, ...prev]
          // 중복 제거
          const uniqueMap = new Map()
          combined.forEach((msg) => {
            uniqueMap.set(String(msg.id), msg)
          })
          const unique = Array.from(uniqueMap.values())
          
          // 최대 윈도우 크기 제한
          if (unique.length > MAX_MESSAGES_WINDOW) {
            return unique.slice(-MAX_MESSAGES_WINDOW)
          }
          return unique
        })
        
        // 스크롤 복원 (requestAnimationFrame으로 레이아웃 커밋 후 실행)
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight
            const scrollDiff = newScrollHeight - prevScrollHeight
            container.scrollTop = scrollDiff
          }
        })
      }
      
      setNextCursor(cursor)
      setHasMore(more)
    } catch (error) {
      console.error('메시지 더보기 실패:', error)
      // 에러 발생 시 즉시 종료
    } finally {
      setLoadingMore(false)
    }
  }, [webinarId, nextCursor, hasMore, loadingMore])
  
  // 메시지 로드 및 Realtime 구독
  useEffect(() => {
    // webinarId가 변경되면 초기 로드 리셋 및 재시도 횟수 리셋
    if (lastWebinarIdRef.current !== webinarId) {
      initialLoadTimeRef.current = 0
      lastWebinarIdRef.current = webinarId
      reconnectTriesRef.current = 0 // webinarId 변경 시 재시도 횟수 리셋
      pendingEventsRef.current = [] // 해결책.md: webinarId 변경 시 버퍼 초기화
      seenMidRef.current.clear() // webinarId 변경 시 중복 체크 Set 초기화
    }
    
    // 초기 로드는 한 번만 실행 (재연결 시에는 메시지 유지)
    const isInitialLoad = initialLoadTimeRef.current === 0
    if (isInitialLoad) {
      loadMessages(true) // 초기 로드만 실행
    }
    
    // 고정 채널명 사용 (중복 구독 방지)
    // Phase 1: Broadcast 중심 아키텍처 - 단일 채널 사용
    const channelName = `webinar:${webinarId}`
    channelNameRef.current = channelName // cleanup용으로 저장
    
    // 실시간 구독 설정 (기존 채널 정리는 비동기로 처리)
    const setupRealtimeSubscription = async () => {
      // 이미 설정 중이면 무시
      if (isSettingUpRef.current) {
        console.log('채널 설정이 이미 진행 중입니다. 무시합니다.')
        return
      }
      
      // 3회 이상 실패했고 폴백이 활성화되어 있으면 재연결 시도하지 않음
      if (reconnectTriesRef.current >= 3 && fallbackOn) {
        console.log('재연결 시도 횟수 초과, 폴백 모드 유지')
        return
      }
      
      isSettingUpRef.current = true
      
      try {
        // 기존 채널 확인 및 제거 (E번 수정안: 우리가 만든 채널만 정리)
        const ch = channelRef.current
        if (ch && ch.topic === `realtime:${channelName}`) {
          console.warn('기존 채널 발견, 제거 중:', channelName)
          manualCloseRef.current = true // 수동 종료 플래그 설정 (A번 수정안)
          await ch.unsubscribe()
          supabase.removeChannel(ch)
          manualCloseRef.current = false // 플래그 리셋
          // 약간의 지연을 두어 정리가 완전히 완료되도록 함
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // 실시간 구독 (Broadcast 중심 아키텍처)
        // B번 수정안: presence 제거 (채팅만 사용하므로 필수 아님)
        const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }, // 자신의 메시지는 제외 (Optimistic Update로 처리)
        },
      })
      .on(
        'broadcast',
        { event: '*' },
        (payload: any) => {
          // Supabase Broadcast payload 구조: { payload: { ... } } 또는 직접 envelope
          // 서버에서 channel.send({ type: 'broadcast', event: eventType, payload: envelope })로 보내면
          // 클라이언트에서는 payload.payload로 접근
          const env = (payload?.payload || payload) as BroadcastEnvelope<ChatMessagePayload> | undefined
          
          if (!isValidBroadcastEnvelope(env)) {
            console.warn('잘못된 Broadcast Envelope:', payload, 'env:', env)
            return
          }
          
          // 해결책.md 3번: envelope 단위 중복 제거 (mid 기반) - 가장 먼저 체크
          if (env?.mid && typeof env.mid === 'string') {
            const seen = seenMidRef.current
            if (seen.has(env.mid)) {
              console.log('중복 envelope(mid) 무시:', env.mid)
              return // 중복이면 즉시 리턴 (아래 로직 실행 안 함)
            }
            seen.add(env.mid)
            // 메모리 보호 (최대 2000개만 유지)
            if (seen.size > 2000) {
              const first = seen.values().next().value
              if (first) {
                seen.delete(first)
              }
            }
          }
          
          console.log('실시간 Broadcast 이벤트:', env.t, env)
          
          lastEventAt.current = Date.now() // 이벤트 수신 시간 업데이트
          reconnectTriesRef.current = 0 // 재연결 시도 횟수 리셋
          
          // 이벤트 수신 시 폴백 끄기 (실시간 구독이 정상 작동 중)
          if (fallbackOn) {
            console.log('✅ 실시간 이벤트 수신, 폴백 폴링 비활성화')
            setFallbackOn(false)
          }
          
          // 이벤트 타입별 처리
          if (env.t === 'chat:new') {
            const newMsg = env.payload as ChatMessagePayload
            if (newMsg && !newMsg.hidden) {
              console.log('새 메시지 수신:', newMsg)
              
              // 해결책.md A안: 초기 로드 중 이벤트 버퍼링
              if (initialLoadTimeRef.current === 0) {
                console.log('초기 로드 전, 이벤트 버퍼링:', env.t)
                pendingEventsRef.current.push(env)
                return
              }
              
              // 프로필 정보를 API로 빠르게 조회
              const fetchProfile = async () => {
                try {
                  // 프로필, 참여자 여부, 관리자 여부 동시 조회
                  const [profileResponse, registrationResponse, adminCheckResponse] = await Promise.all([
                    fetch(`/api/profiles/${newMsg.user_id}`),
                    supabase
                      .from('registrations')
                      .select('role')
                      .eq('webinar_id', webinarId)
                      .eq('user_id', newMsg.user_id)
                      .maybeSingle(),
                    fetch(`/api/webinars/${webinarId}/check-admin`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userIds: [newMsg.user_id] }),
                    })
                  ])
                  
                  let profile = null
                  if (profileResponse.ok) {
                    const result = await profileResponse.json()
                    profile = result.profile
                  }
                  
                  const registration = registrationResponse.data as { role?: string } | null
                  const isParticipant = (registration as any)?.role === 'attendee'
                  
                  // 관리자 여부 확인
                  let isAdmin = false
                  if (adminCheckResponse.ok) {
                    const adminResult = await adminCheckResponse.json()
                    isAdmin = adminResult.adminUserIds?.includes(newMsg.user_id) || false
                  }
                  
                  const displayName = isAdmin || !isParticipant
                    ? '관리자'
                    : ((profile as any)?.display_name || (profile as any)?.email || '익명')
                  
                  if (profile) {
                    return {
                      ...profile,
                      display_name: displayName,
                    }
                  }
                  
                  // 프로필이 없어도 기본 정보 반환
                  return {
                    id: newMsg.user_id,
                    display_name: displayName,
                    email: null,
                  }
                } catch (error) {
                  console.warn('프로필 조회 실패:', error)
                  // 기본값: 관리자로 표시
                  return {
                    id: newMsg.user_id,
                    display_name: '관리자',
                    email: null,
                  }
                }
              }
              
              fetchProfile().then((profileWithDisplayName) => {
                setMessages((prev) => {
                  // 해결책.md 1번: prev.length === 0 가드 제거 (첫 메시지 누락 방지)
                  
                  // 해결책.md 2번: 중복 방지 먼저 체크 (id / client_msg_id)
                  if (prev.some(m => {
                    // ID로 중복 확인
                    if (m.id === newMsg.id) return true
                    // client_msg_id로 중복 확인 (Optimistic 메시지와 실제 메시지 매칭)
                    if (newMsg.client_msg_id && m.client_msg_id === newMsg.client_msg_id) return true
                    return false
                  })) {
                    console.log('중복 메시지 무시 (Realtime):', newMsg.id, newMsg.client_msg_id)
                    return prev
                  }
              
              // client_msg_id로 optimistic 메시지 정확 교체
              const optimisticIndex = prev.findIndex(m => {
                if (!m.isOptimistic) return false
                if (newMsg.client_msg_id) {
                  // client_msg_id가 있으면 정확 매칭
                  return m.client_msg_id === newMsg.client_msg_id
                }
                // 하위 호환성: client_msg_id가 없으면 기존 방식 사용
                return m.user_id === newMsg.user_id && m.content === newMsg.content
              })
              
              if (optimisticIndex !== -1) {
                // Optimistic 메시지를 실제 메시지로 교체
                // fetchProfile에서 이미 관리자 여부를 확인하여 "관리자"로 표시하도록 처리됨
                const finalUser = profileWithDisplayName || prev[optimisticIndex].user
                
                const updated = [...prev]
                updated[optimisticIndex] = {
                  ...newMsg,
                  user: finalUser,
                  isOptimistic: false,
                }
                
                // 해결책.md: lastMessageIdRef 갱신
                if (typeof newMsg.id === 'number') {
                  lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMsg.id)
                }
                
                return updated
              }
              
              // 해결책.md 2번: "과거" 판정은 id 우선, 그다음 created_at
              const prevMaxId = prev.reduce((acc, m) => 
                typeof m.id === 'number' ? Math.max(acc, m.id) : acc, 
                lastMessageIdRef.current
              )
              
              // id가 있으면 id 기준
              if (typeof newMsg.id === 'number') {
                if (newMsg.id <= prevMaxId) {
                  console.log('과거 메시지(SEQ) 무시:', newMsg.id, '<=', prevMaxId)
                  return prev
                }
              } else {
                // id 없을 때만 created_at 보조 비교 (strict < 만 과거로 간주)
                // 초기 로드 직후 2초 이내에는 시간 비교를 하지 않음
                const timeSinceInitialLoad = Date.now() - initialLoadTimeRef.current
                const shouldCheckTime = timeSinceInitialLoad > 2000 // 2초 이후에만 시간 체크
                
                if (shouldCheckTime && prev.length > 0) {
                  const latestMsg = prev[prev.length - 1]
                  if (latestMsg && latestMsg.created_at) {
                    const latestTime = new Date(latestMsg.created_at).getTime()
                    const newMsgTime = new Date(newMsg.created_at).getTime()
                    
                    // 해결책.md: <= → < 로 변경 (동일 시각 허용, 엄격히 과거만 버림)
                    if (newMsgTime < latestTime) {
                      console.log('과거 메시지(TS) 무시:', newMsg.created_at, '<', latestMsg.created_at)
                      return prev
                    }
                  }
                }
              }
                  
              // fetchProfile에서 이미 관리자 여부를 확인하여 "관리자"로 표시하도록 처리됨
              const finalUser = profileWithDisplayName
              
              const updated = [...prev, {
                id: newMsg.id,
                user_id: newMsg.user_id,
                content: newMsg.content,
                created_at: newMsg.created_at,
                hidden: newMsg.hidden,
                user: finalUser,
                client_msg_id: newMsg.client_msg_id,
              }].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              
              // 해결책.md 2번: lastMessageIdRef 갱신 (실시간/폴백 공용 커서)
              if (typeof newMsg.id === 'number') {
                lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMsg.id)
              }
              
              // 윈도우 크기 제한 (가장 오래된 것부터 제거)
              if (updated.length > MAX_MESSAGES_WINDOW) {
                return updated.slice(-MAX_MESSAGES_WINDOW)
              }
              return updated
                })
                
                // 내가 보낸 메시지면 스피너 끄기 (이중 안전장치)
                if (newMsg.user_id === currentUser?.id) {
                  setSending(false)
                  sendingClientMsgIdRef.current = null
                }
              }).catch((error) => {
                console.error('프로필 조회 오류:', error)
                // 프로필 없이도 메시지 추가
                setMessages((prev) => {
                  // 해결책.md 1번: prev.length === 0 가드 제거 (첫 메시지 누락 방지)
                  
                  // 해결책.md 2번: 중복 방지 먼저 체크 (id / client_msg_id)
                  if (prev.some(m => {
                    if (m.id === newMsg.id) return true
                    if (newMsg.client_msg_id && m.client_msg_id === newMsg.client_msg_id) return true
                    return false
                  })) {
                    console.log('중복 메시지 무시 (Realtime, 프로필 오류):', newMsg.id, newMsg.client_msg_id)
                    return prev
                  }
                  
                  // 해결책.md 2번: "과거" 판정은 id 우선, 그다음 created_at
                  const prevMaxId = prev.reduce((acc, m) => 
                    typeof m.id === 'number' ? Math.max(acc, m.id) : acc, 
                    lastMessageIdRef.current
                  )
                  
                  // id가 있으면 id 기준
                  if (typeof newMsg.id === 'number') {
                    if (newMsg.id <= prevMaxId) {
                      console.log('과거 메시지(SEQ) 무시 (프로필 오류):', newMsg.id, '<=', prevMaxId)
                      return prev
                    }
                  } else {
                    // id 없을 때만 created_at 보조 비교 (strict < 만 과거로 간주)
                    const timeSinceInitialLoad = Date.now() - initialLoadTimeRef.current
                    const shouldCheckTime = timeSinceInitialLoad > 2000
                    
                    if (shouldCheckTime && prev.length > 0) {
                      const latestMsg = prev[prev.length - 1]
                      if (latestMsg && latestMsg.created_at) {
                        const latestTime = new Date(latestMsg.created_at).getTime()
                        const newMsgTime = new Date(newMsg.created_at).getTime()
                        
                        // 해결책.md: <= → < 로 변경 (동일 시각 허용, 엄격히 과거만 버림)
                        if (newMsgTime < latestTime) {
                          console.log('과거 메시지(TS) 무시 (프로필 오류):', newMsg.created_at, '<', latestMsg.created_at)
                          return prev
                        }
                      }
                    }
                  }
                  
                  const optimisticIndex = prev.findIndex(m => {
                    if (!m.isOptimistic) return false
                    if (newMsg.client_msg_id) {
                      return m.client_msg_id === newMsg.client_msg_id
                    }
                    return m.user_id === newMsg.user_id && m.content === newMsg.content
                  })
                  
                  let filtered = prev
                  if (optimisticIndex !== -1) {
                    filtered = prev.filter((_, idx) => idx !== optimisticIndex)
                  }
                  
                  const updated = [...filtered, {
                    id: newMsg.id,
                    user_id: newMsg.user_id,
                    content: newMsg.content,
                    created_at: newMsg.created_at,
                    hidden: newMsg.hidden,
                    user: undefined,
                    client_msg_id: newMsg.client_msg_id,
                  }].sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  )
                  
                  // 해결책.md 2번: lastMessageIdRef 갱신 (실시간/폴백 공용 커서)
                  if (typeof newMsg.id === 'number') {
                    lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMsg.id)
                  }
                  
                  // 윈도우 크기 제한 (가장 오래된 것부터 제거)
                  if (updated.length > MAX_MESSAGES_WINDOW) {
                    return updated.slice(-MAX_MESSAGES_WINDOW)
                  }
                  return updated
                })
              })
            }
          } else if (env.t === 'chat:update') {
            // 업데이트된 메시지 반영 (id 필수 확인)
            const updatedMsg = env.payload as ChatMessagePayload
            if (!updatedMsg?.id) {
              console.warn('UPDATE 이벤트에 id가 없습니다:', env)
              return
            }
            
            console.log('메시지 업데이트 이벤트 수신:', updatedMsg.id, 'hidden:', updatedMsg.hidden)
            
            setMessages((prev) => {
              const hasMessage = prev.some(msg => msg.id === updatedMsg.id)
              
              if (!hasMessage) {
                // 메시지가 목록에 없으면 무시 (아직 로드되지 않은 메시지)
                console.log('업데이트된 메시지가 목록에 없음:', updatedMsg.id)
                return prev
              }
              
              // 메시지 업데이트 및 숨김 메시지 필터링
              const updated = prev.map((msg) =>
                msg.id === updatedMsg.id
                  ? { ...msg, ...updatedMsg, hidden: updatedMsg.hidden ?? false }
                  : msg
              ).filter(msg => !msg.hidden)
              
              console.log('메시지 업데이트 반영 완료:', updatedMsg.id, 'hidden:', updatedMsg.hidden, '남은 메시지 수:', updated.length)
              
              return updated
            })
          } else if (env.t === 'chat:delete') {
            // 삭제된 메시지 제거 (id 필수 확인)
            const deletedMsg = env.payload as { id: number }
            if (!deletedMsg?.id) {
              console.warn('DELETE 이벤트에 id가 없습니다:', env)
              return
            }
            setMessages((prev) => prev.filter((msg) => msg.id !== deletedMsg.id))
          }
          // Phase 3: 다른 이벤트 타입 처리
          else if (env.t === 'quiz:open' || env.t === 'quiz:close') {
            // 퀴즈 열기/닫기 이벤트 (FormWidget에서 처리)
            console.log('퀴즈 이벤트 수신:', env.t, env.payload)
            // 필요시 상위 컴포넌트로 전달할 수 있음
          } else if (env.t === 'poll:open' || env.t === 'poll:close') {
            // 설문 열기/닫기 이벤트 (FormWidget에서 처리)
            console.log('설문 이벤트 수신:', env.t, env.payload)
            // 필요시 상위 컴포넌트로 전달할 수 있음
          } else if (env.t === 'raffle:start' || env.t === 'raffle:draw' || env.t === 'raffle:done') {
            // 추첨 이벤트 (GiveawayWidget에서 처리)
            console.log('추첨 이벤트 수신:', env.t, env.payload)
            // 필요시 상위 컴포넌트로 전달할 수 있음
          }
        }
      )
      .subscribe(async (status, err) => {
        // 상세한 로깅 (디버깅 개선)
        console.log('실시간 구독 상태:', {
          status,
          channel: channelName,
          error: err ? {
            message: err.message,
            code: (err as any)?.code,
            reason: (err as any)?.reason,
            wasClean: (err as any)?.wasClean,
            error: err,
          } : null,
        })
        
        if (status === 'SUBSCRIBED') {
          // 기존 재연결 타이머 취소
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }
          if (fallbackReconnectTimeoutRef.current) {
            clearTimeout(fallbackReconnectTimeoutRef.current)
            fallbackReconnectTimeoutRef.current = null
          }
          
          reconnectTriesRef.current = 0
          if (fallbackOn) {
            console.log('✅ 실시간 구독 성공, 폴백 폴링 비활성화')
            setFallbackOn(false)
          }
          lastEventAt.current = Date.now()
          console.log('✅ 실시간 구독 성공:', channelName)
          
          // 채널 설정 완료 플래그 리셋 (구독 성공 후)
          isSettingUpRef.current = false
        } else if (status === 'CLOSED') {
          // A번 수정안: 수동 종료인 경우 실패로 카운팅하지 않음
          if (manualCloseRef.current || !err) {
            // 정상/수동 종료: 실패로 간주하지 않음
            console.log('✅ 채널 정상 종료 (수동 해제 또는 에러 없음)')
            return
          }
          // 에러가 있는 CLOSED는 실패로 처리
          reconnectTriesRef.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectTriesRef.current - 1), 10000)
          
          // 상세한 에러 정보 로깅
          console.warn(`⚠️ 실시간 구독 실패 (${status})`, {
            status,
            channel: channelName,
            retryCount: reconnectTriesRef.current,
            maxRetries: 3,
            nextRetryDelay: delay,
            error: err ? {
              message: err.message,
              code: (err as any)?.code,
              reason: (err as any)?.reason,
              wasClean: (err as any)?.wasClean,
              error: err,
            } : null,
          })
          
          // 3회 실패 시 폴백 활성화 및 채널 제거 (SDK 자동 재연결 중단)
          if (reconnectTriesRef.current >= 3) {
            console.warn('🔴 실시간 구독 3회 실패, 폴백 폴링 활성화 (채널 제거로 재연결 중단)')
            setFallbackOn(true)
            
            // 기존 타이머 취소
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current)
              reconnectTimeoutRef.current = null
            }
            
            // 채널을 완전히 제거하여 SDK의 자동 재연결 중단
            const ch = channelRef.current
            if (ch) {
              console.log('채널 제거 중 (SDK 자동 재연결 중단)')
              ch.unsubscribe().then(() => {
                supabase.removeChannel(ch)
                channelRef.current = null
                isSettingUpRef.current = false
              }).catch((err: unknown) => {
                console.warn('채널 제거 오류:', err)
                channelRef.current = null
                isSettingUpRef.current = false
              })
            }
            
            // 30초 후 재연결 시도 (채널 재생성)
            if (!fallbackReconnectTimeoutRef.current) {
              fallbackReconnectTimeoutRef.current = setTimeout(() => {
                console.log('🔄 폴백 모드에서 재연결 시도 (30초 후)')
                reconnectTriesRef.current = 0 // 재시도 횟수 리셋
                setFallbackOn(false) // 폴백 비활성화하여 재연결 시도
                setReconnectKey(prev => prev + 1) // 재연결 시도 (초기 로드는 건너뜀)
                fallbackReconnectTimeoutRef.current = null
              }, 30000) // 30초 후 재연결 시도
            }
            return
          }
          
          // 3회 미만 실패 시: SDK 자동 재연결에 맡김 (수동 재연결 제거)
          // 토큰만 재주입하고 SDK가 자동으로 재연결 시도
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              supabase.realtime.setAuth(session.access_token)
              console.log('토큰 재주입 완료 (SDK 자동 재연결 대기)')
            }
          } catch (tokenError) {
            console.warn('토큰 재주입 실패:', tokenError)
          }
        } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
          reconnectTriesRef.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectTriesRef.current - 1), 10000)
          
          // 상세한 에러 정보 로깅
          console.warn(`⚠️ 실시간 구독 실패 (${status})`, {
            status,
            channel: channelName,
            retryCount: reconnectTriesRef.current,
            maxRetries: 3,
            nextRetryDelay: delay,
            error: err ? {
              message: err.message,
              code: (err as any)?.code,
              reason: (err as any)?.reason,
              wasClean: (err as any)?.wasClean,
              error: err,
            } : null,
          })
          
          // 3회 실패 시 폴백 활성화 및 채널 제거 (SDK 자동 재연결 중단)
          if (reconnectTriesRef.current >= 3) {
            console.warn('🔴 실시간 구독 3회 실패, 폴백 폴링 활성화 (채널 제거로 재연결 중단)')
            setFallbackOn(true)
            
            // 기존 타이머 취소
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current)
              reconnectTimeoutRef.current = null
            }
            
            // 채널을 완전히 제거하여 SDK의 자동 재연결 중단
            const ch = channelRef.current
            if (ch) {
              console.log('채널 제거 중 (SDK 자동 재연결 중단)')
              ch.unsubscribe().then(() => {
                supabase.removeChannel(ch)
                channelRef.current = null
                isSettingUpRef.current = false
              }).catch((err: unknown) => {
                console.warn('채널 제거 오류:', err)
                channelRef.current = null
                isSettingUpRef.current = false
              })
            }
            
            // 30초 후 재연결 시도 (채널 재생성)
            if (!fallbackReconnectTimeoutRef.current) {
              fallbackReconnectTimeoutRef.current = setTimeout(() => {
                console.log('🔄 폴백 모드에서 재연결 시도 (30초 후)')
                reconnectTriesRef.current = 0 // 재시도 횟수 리셋
                setFallbackOn(false) // 폴백 비활성화하여 재연결 시도
                setReconnectKey(prev => prev + 1) // 재연결 시도 (초기 로드는 건너뜀)
                fallbackReconnectTimeoutRef.current = null
              }, 30000) // 30초 후 재연결 시도
            }
            return
          }
          
          // 3회 미만 실패 시: SDK 자동 재연결에 맡김 (수동 재연결 제거)
          // 토큰만 재주입하고 SDK가 자동으로 재연결 시도
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              supabase.realtime.setAuth(session.access_token)
              console.log('토큰 재주입 완료 (SDK 자동 재연결 대기)')
            }
          } catch (tokenError) {
            console.warn('토큰 재주입 실패:', tokenError)
          }
          
          // 수동 재연결 타이머 제거 (SDK 자동 재연결 활용)
          // SDK가 자동으로 재연결을 시도하므로 우리는 상태만 통지
        }
      })
      
        // 채널을 ref에 저장 (cleanup용)
        channelRef.current = channel
        isSettingUpRef.current = false
        
        return channel
      } catch (error) {
        console.error('채널 설정 중 오류:', error)
        isSettingUpRef.current = false
        channelRef.current = null
      }
    }
    
    // 실시간 구독 설정 실행
    setupRealtimeSubscription()
    
    return () => {
      // 모든 타이머 취소
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (fallbackReconnectTimeoutRef.current) {
        clearTimeout(fallbackReconnectTimeoutRef.current)
        fallbackReconnectTimeoutRef.current = null
      }
      
      // E번 수정안: 우리가 만든 채널만 정리 (간소화)
      const currentChannel = channelRef.current
      const currentChannelName = channelNameRef.current
      
      if (currentChannel && currentChannel.topic === `realtime:${currentChannelName}` && !isSettingUpRef.current) {
        console.log('실시간 구독 해제:', currentChannelName)
        // A번 수정안: 수동 종료 플래그 설정
        manualCloseRef.current = true
        currentChannel.unsubscribe().then(() => {
          supabase.removeChannel(currentChannel)
          channelRef.current = null
          channelNameRef.current = null
          manualCloseRef.current = false // 플래그 리셋
        }).catch((err: unknown) => {
          console.warn('채널 구독 해제 오류:', err)
          channelRef.current = null
          channelNameRef.current = null
          manualCloseRef.current = false // 플래그 리셋
        })
      } else if (isSettingUpRef.current) {
        // 설정 중이면 설정 완료 후 정리되도록 대기
        console.log('채널 설정 중이므로 cleanup을 지연합니다.')
        const checkAndCleanup = () => {
          const channel = channelRef.current
          const channelName = channelNameRef.current
          if (!isSettingUpRef.current && channel && channel.topic === `realtime:${channelName}`) {
            console.log('실시간 구독 해제 (지연):', channelName)
            // A번 수정안: 수동 종료 플래그 설정
            manualCloseRef.current = true
            channel.unsubscribe().then(() => {
              supabase.removeChannel(channel)
              channelRef.current = null
              channelNameRef.current = null
              manualCloseRef.current = false // 플래그 리셋
            }).catch((err: unknown) => {
              console.warn('채널 구독 해제 오류:', err)
              channelRef.current = null
              channelNameRef.current = null
              manualCloseRef.current = false // 플래그 리셋
            })
          } else if (isSettingUpRef.current) {
            // 아직 설정 중이면 다시 확인 (최대 5초 대기)
            setTimeout(checkAndCleanup, 100)
          }
        }
        setTimeout(checkAndCleanup, 100)
      }
    }
  }, [webinarId, reconnectKey]) // B번 수정안: currentUser?.id 제거 (supabase는 싱글턴이므로 dependency에서 제거)
  
  // C번 수정안: 헬스체크를 채널 상태 기준으로 변경
  // "이벤트 부재" 대신 "채널 상태"로 판단하여 조용한 시간대에 불필요한 폴백 방지
  // 해결책.md 4번: 헬스체크 임계치 완화 (3초 → 30초)
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      // 초기 로드 후 10초 이내에는 헬스체크 비활성화 (해결책.md: 3초 → 10초)
      const timeSinceInitialLoad = Date.now() - initialLoadTimeRef.current
      if (timeSinceInitialLoad < 10000) {
        return // 초기 로드 후 10초 이내에는 헬스체크 건너뛰기
      }
      
      // 채널 상태 확인 (C번 수정안)
      const channel = channelRef.current
      const isJoined = channel?.state === 'joined'
      
      // 채널이 joined 상태가 아니고 폴백이 비활성화되어 있으면 폴백 활성화
      if (!isJoined && !fallbackOn) {
        console.warn('⚠️ 채널 상태가 joined가 아님, 폴백 폴링 활성화', {
          channelState: channel?.state,
          channelTopic: channel?.topic,
          timeSinceInitialLoad,
        })
        setFallbackOn(true)
      }
    }, 5000) // 해결책.md 4번: 5초마다 체크 (3초 → 5초로 완화)
    
    return () => clearInterval(healthCheckInterval)
  }, [fallbackOn])
  
  // 조건부 폴백 폴링 (증분 로드만 수행 - 새 메시지만 가져오기)
  useEffect(() => {
    if (!fallbackOn) {
      return // 폴백이 비활성화되면 아무것도 하지 않음 (로그 제거)
    }
    
    // 가시성 및 온라인 상태 확인
    const isVisible = document.visibilityState === 'visible'
    const isOnline = navigator.onLine
    
    if (!isVisible || !isOnline) {
      return // 가시성/오프라인 상태면 아무것도 하지 않음 (로그 제거)
    }
    
    console.log('🔄 폴백 폴링 시작 (증분 로드 - 새 메시지만)')
    
    // 지터가 포함된 폴링 함수
    let isPollingActive = true
    const pollingTimeouts: NodeJS.Timeout[] = [] // 모든 폴링 타이머 추적
    
    const pollWithJitter = async () => {
      // 폴백이 비활성화되었으면 중지
      if (!fallbackOn || !isPollingActive) {
        return // 로그 제거하여 반복 로그 방지
      }
      
      // 가시성 및 온라인 상태 확인 (폴링 중에도 체크)
      const isVisible = document.visibilityState === 'visible'
      const isOnline = navigator.onLine
      
      if (!isVisible || !isOnline) {
        // 가시성/오프라인 상태면 다음 주기에서 재시도 (더 긴 간격)
        const base = 10000 // 10초 기본 (비활성 시)
        const jitter = 2000 - Math.random() * 4000 // ±2초
        const nextDelay = base + jitter + pollBackoffRef.current
        // 폴백이 여전히 활성화되어 있을 때만 다음 폴링 예약
        if (fallbackOn && isPollingActive) {
          const timeout = setTimeout(pollWithJitter, nextDelay)
          pollingTimeouts.push(timeout)
        }
        return
      }
      
      try {
        // 증분 로드: 마지막 메시지 ID 이후의 새 메시지만 가져오기
        const afterParam = lastMessageIdRef.current > 0 ? `&after=${lastMessageIdRef.current}` : ''
        
        // D번 수정안: 증분 조회(after=)에는 ETag 제거 (304 오인 방지)
        const headers: HeadersInit | undefined = afterParam
          ? undefined // 증분 요청엔 ETag 미사용
          : (etagRef.current ? { 'If-None-Match': etagRef.current } : undefined)
        
        const response = await fetch(
          `/api/webinars/${webinarId}/messages?limit=20${afterParam}`,
          {
            credentials: 'include', // 쿠키 포함
            headers,
          }
        )
        
        // 401 에러인 경우 폴백 폴링 중지 (인증 문제)
        if (response.status === 401) {
          console.warn('폴백 폴링 중 401 에러 발생, 폴링 중지')
          isPollingActive = false
          setFallbackOn(false)
          return
        }
        
        // 304 Not Modified: 데이터 변경 없음 → ETag만 업데이트하고 다음 폴링으로
        if (response.status === 304) {
          const newEtag = response.headers.get('ETag')
          if (newEtag) {
            etagRef.current = newEtag
          }
          // 백오프 초기화 (성공)
          pollBackoffRef.current = 0
          lastEventAt.current = Date.now()
          
          // 다음 폴링 스케줄링 (공격적 폴링: 2초)
          const base = 2000 // 2초 기본 (빠른 응답)
          const jitter = 500 - Math.random() * 1000 // ±0.5초
          const nextDelay = base + jitter + pollBackoffRef.current
          if (fallbackOn && isPollingActive) {
            const timeout = setTimeout(pollWithJitter, nextDelay)
            pollingTimeouts.push(timeout)
          }
          return
        }
        
        if (response.ok) {
          // ETag 업데이트
          const newEtag = response.headers.get('ETag')
          if (newEtag) {
            etagRef.current = newEtag
          }
          
          const result = await response.json()
          
          if (result.success && result.messages) {
            const fetchedMessages = result.messages
            
            if (fetchedMessages.length > 0) {
              console.log(`📥 폴백 폴링: ${fetchedMessages.length}개 새 메시지 수신`)
              
              // 숨김 메시지 제외하고 기존 메시지에 추가
              const visibleNewMessages = fetchedMessages.filter((m: Message) => !m.hidden)
              
              if (visibleNewMessages.length > 0) {
                setMessages((prev) => {
                  const existingIds = new Set(prev.map(m => m.id))
                  const trulyNew = visibleNewMessages.filter((m: Message) => !existingIds.has(m.id))
                  
                  if (trulyNew.length === 0) return prev
                  
                  const merged = [...prev, ...trulyNew]
                  const sorted = merged.sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  )
                  
                  // 윈도우 크기 제한 (가장 오래된 것부터 제거)
                  let windowed = sorted
                  if (sorted.length > MAX_MESSAGES_WINDOW) {
                    windowed = sorted.slice(-MAX_MESSAGES_WINDOW)
                  }
                  
                  return windowed
                })
                
                // 마지막 메시지 ID 업데이트
                const maxId = Math.max(
                  ...visibleNewMessages.map((m: any) => typeof m.id === 'number' ? m.id : 0),
                  lastMessageIdRef.current
                )
                lastMessageIdRef.current = maxId
              }
              
              // 이벤트 수신 시간 업데이트
              lastEventAt.current = Date.now()
            }
          }
          
          // 백오프 초기화 (성공)
          pollBackoffRef.current = 0
        } else {
          // 에러 발생 시 백오프 증가 (지수 백오프)
          pollBackoffRef.current = Math.min(pollBackoffRef.current * 2 + 5000, 60000) // 최대 60초
          console.warn(`폴백 폴링 에러 (${response.status}), 백오프: ${pollBackoffRef.current}ms`)
        }
      } catch (error: any) {
        // 네트워크 오류는 조용히 처리 (재시도될 예정)
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          console.warn('폴백 폴링: 네트워크 오류 (다음 폴링에서 재시도)')
        } else {
          console.error('폴백 폴링 오류:', error)
        }
        // 에러 발생 시 백오프 증가
        pollBackoffRef.current = Math.min(pollBackoffRef.current * 2 + 5000, 60000)
      }
      
      // 지터 적용: 기본 2초 ± 0.5초 랜덤 (공격적 폴링)
      const base = 2000 // 2초 기본 (빠른 응답)
      const jitter = 500 - Math.random() * 1000 // ±0.5초
      const nextDelay = base + jitter + pollBackoffRef.current
      
      // 폴백이 여전히 활성화되어 있을 때만 다음 폴링 예약
      if (fallbackOn && isPollingActive) {
        const timeout = setTimeout(pollWithJitter, nextDelay)
        pollingTimeouts.push(timeout)
      }
    }
    
    // 초기 폴링 시작
    const timeoutId = setTimeout(pollWithJitter, 0)
    pollingTimeouts.push(timeoutId)
    
    // 가시성/온라인 상태 변경 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && fallbackOn && isPollingActive) {
        // 복귀 시 즉시 1회 폴링 (백오프 초기화)
        pollBackoffRef.current = 0
        pollWithJitter()
      }
    }
    
    const handleOnline = () => {
      if (document.visibilityState === 'visible' && fallbackOn && isPollingActive) {
        // 온라인 복귀 시 즉시 1회 폴링 (백오프 초기화)
        pollBackoffRef.current = 0
        pollWithJitter()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    
    return () => {
      isPollingActive = false
      // 모든 폴링 타이머 취소
      pollingTimeouts.forEach(timeout => clearTimeout(timeout))
      pollingTimeouts.length = 0 // 배열 비우기
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [fallbackOn, webinarId])
  
  // 상단 무한 스크롤은 제거하고 수동 버튼으로 변경
  
  // 스크롤 자동 이동 (새 메시지가 추가될 때만)
  useEffect(() => {
    // 초기 로드가 아니고, 사용자가 하단에 있을 때만 자동 스크롤
    if (!loading && messages.length > 0) {
      const container = messagesContainerRef.current
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }
  }, [messages.length, loading]) // messages.length만 감지 (내용 변경은 무시)
  
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending || !canSend) return
    
    if (!currentUser) {
      alert('로그인이 필요합니다')
      return
    }
    
    // 고유 client_msg_id 생성
    const clientMsgId = crypto.randomUUID()
    
    // 중복 전송 방지: 동일 client_msg_id로 이미 전송 중이면 차단
    if (sendingClientMsgIdRef.current === clientMsgId) {
      return
    }
    
    const tempId = `temp-${clientMsgId}`
    const messageContent = newMessage.trim()
    const now = new Date().toISOString()
    
    // 전송 시작 표시
    sendingClientMsgIdRef.current = clientMsgId
    
    // 프로필 정보가 없으면 먼저 조회 (Optimistic 메시지 생성 전에)
    let userProfile = currentUser
    if (!currentUser.display_name && !currentUser.email) {
      try {
        const response = await fetch(`/api/profiles/${currentUser.id}`)
        if (response.ok) {
          const { profile } = await response.json()
          userProfile = {
            id: currentUser.id,
            display_name: (profile as any)?.display_name,
            email: (profile as any)?.email,
          }
          // currentUser 상태 업데이트
          setCurrentUser(userProfile)
        }
      } catch (error) {
        console.warn('프로필 정보 조회 실패:', error)
      }
    }
    
    // currentUser의 display_name이 "관리자"이면 그대로 사용, 아니면 프로필 정보 사용
    const displayName = userProfile.display_name === '관리자'
      ? '관리자'
      : (userProfile.display_name || userProfile.email || '익명')
    
    // Optimistic Update: 즉시 UI에 임시 메시지 추가 (프로필 정보 포함)
    const optimisticMessage: Message = {
      id: tempId,
      user_id: currentUser.id,
      content: messageContent,
      created_at: now,
      hidden: false,
      user: {
        id: currentUser.id,
        display_name: displayName,
        email: userProfile.email || undefined,
      },
      isOptimistic: true,
      client_msg_id: clientMsgId,
    }
    
    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage('')
    setSending(true)
    
    // 타임아웃 설정
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃
    
    try {
      // API를 통해 메시지 전송
      const response = await fetch('/api/messages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webinarId,
          content: messageContent,
          clientMsgId,
        }),
        signal: controller.signal,
      })
      
      const result = await response.json().catch(() => ({}))
      
      if (!response.ok || result?.error || !result?.success) {
        // 실패: Optimistic 메시지 제거 및 입력 복원
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
        setNewMessage(messageContent)
        throw new Error(result?.error || `HTTP ${response.status}`)
      }
      
      // ✅ API 성공 즉시 UI 교체 (Realtime 대기 없이)
      const serverMsg = result.message
      // API에서 이미 관리자 여부를 확인하여 "관리자"로 표시하도록 처리됨
      // currentUser의 display_name이 "관리자"이면 그대로 사용
      const serverMsgUser = serverMsg.user || userProfile || { id: currentUser.id, display_name: displayName }
      
      setMessages((prev) => prev.map((msg) => {
        if (msg.id === tempId) {
          return {
            ...serverMsg,
            user: serverMsgUser,
            isOptimistic: false,
          }
        }
        return msg
      }))
      
      // 스피너 즉시 끄기
      setSending(false)
      sendingClientMsgIdRef.current = null // 전송 완료
      
      // 콜백 호출
      onMessageSent?.(serverMsg)
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // 타임아웃: Optimistic 메시지 유지 (나중에 Realtime INSERT로 교체될 수 있음)
        console.warn('메시지 전송 타임아웃, Realtime을 기다립니다')
        // 스피너는 끄지만 메시지는 유지
        setSending(false)
        sendingClientMsgIdRef.current = null // 타임아웃 시에도 해제
      } else {
        // 다른 에러: Optimistic 메시지 제거 및 입력 복원
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
        setNewMessage(messageContent)
        alert(error.message || '메시지 전송에 실패했습니다')
        setSending(false)
        sendingClientMsgIdRef.current = null // 에러 시 해제
      }
    } finally {
      clearTimeout(timeout)
    }
  }
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 메시지 목록 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4 space-y-2 sm:space-y-3"
      >
        {/* 과거 메시지 더보기 버튼 */}
        {hasMore && !loadingMore && (
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 border-b border-gray-200">
            <button
              onClick={loadMoreMessages}
              className="w-full px-4 py-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              과거 메시지 더보기
            </button>
          </div>
        )}
        
        {/* 더보기 로딩 표시 */}
        {loadingMore && (
          <div className="text-center text-gray-500 py-2 text-xs sm:text-sm">
            과거 메시지 불러오는 중...
          </div>
        )}
        
        {loading && messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-xs sm:text-sm">메시지를 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-xs sm:text-sm">아직 메시지가 없습니다</div>
        ) : (
          messages.map((message, index) => {
            // React key를 고유하게 만들기: id + client_msg_id + index 조합
            const uniqueKey = message.client_msg_id 
              ? `${message.id}-${message.client_msg_id}` 
              : `${message.id}-${index}`
            
            if (renderMessage) {
              return (
                <div key={uniqueKey} onClick={() => onMessageClick?.(message)}>
                  {renderMessage(message)}
                </div>
              )
            }
            
            return (
              <div
                key={uniqueKey}
                className={`hover:bg-gray-50 p-1.5 sm:p-2 rounded-lg transition-colors ${
                  message.isOptimistic ? 'opacity-70' : ''
                } ${onMessageClick ? 'cursor-pointer' : ''}`}
                onClick={() => onMessageClick?.(message)}
              >
                <div className="flex items-start gap-1.5 sm:gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-gray-800">
                        {message.user?.display_name || message.user?.email || '익명'}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        {formatTime(message.created_at)}
                      </span>
                      {message.isOptimistic && (
                        <span className="text-[10px] sm:text-xs text-blue-500">전송 중...</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 break-words leading-relaxed">{message.content}</p>
                  </div>
                  {/* 관리자 모드: 메시지 삭제 버튼 */}
                  {isAdminMode && !message.isOptimistic && typeof message.id === 'number' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('이 메시지를 삭제하시겠습니까?')) return
                        
                        try {
                          const response = await fetch(`/api/messages/${message.id}`, {
                            method: 'DELETE',
                          })
                          
                          if (!response.ok) {
                            const result = await response.json()
                            throw new Error(result.error || '메시지 삭제 실패')
                          }
                          
                          // 메시지 목록에서 제거
                          setMessages((prev) => prev.filter((msg) => msg.id !== message.id))
                        } catch (error: any) {
                          console.error('메시지 삭제 실패:', error)
                          alert(error.message || '메시지 삭제에 실패했습니다')
                        }
                      }}
                      className="text-red-500 hover:text-red-700 text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="메시지 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 메시지 입력 */}
      {canSend && (
        <form onSubmit={handleSend} className="border-t border-gray-200 p-2 sm:p-3 lg:p-4 flex-shrink-0">
          <div className="flex gap-1.5 sm:gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
            >
              {sending ? '전송 중...' : '전송'}
            </button>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
            {newMessage.length}/500
          </p>
        </form>
      )}
    </div>
  )
}


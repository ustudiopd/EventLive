'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

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
  const supabase = createClientSupabase()
  
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
          
          const registration = registrationResponse.data
          const isParticipant = registration?.role === 'attendee'
          
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
              : (profile?.display_name || profile?.email || '익명'),
            email: profile?.email,
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
          
          const isParticipant = registration?.role === 'attendee'
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', user.id)
            .single()
          
          setCurrentUser({
            id: user.id,
            display_name: isParticipant 
              ? (profile?.display_name || profile?.email || '익명')
              : '관리자',
            email: profile?.email,
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
      const response = await fetch(`/api/webinars/${webinarId}/messages?limit=${limit}`)
      
      if (!response.ok) {
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
    } catch (error) {
      console.error('메시지 로드 실패:', error)
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
        `/api/webinars/${webinarId}/messages?limit=20&beforeTs=${encodeURIComponent(beforeTs)}&beforeId=${beforeId}`
      )
      
      if (!response.ok) {
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
    loadMessages(true) // 초기 로드
    
    // 고정 채널명 사용 (중복 구독 방지)
    const channelName = `webinar:${webinarId}:messages`
    
    // 기존 채널 확인 및 제거 (안전장치)
    const existingChannel = supabase.getChannels().find(
      ch => ch.topic === `realtime:${channelName}`
    )
    if (existingChannel) {
      console.warn('기존 채널 발견, 제거 중:', channelName)
      existingChannel.unsubscribe().then(() => {
        supabase.removeChannel(existingChannel)
      })
    }
    
    // 실시간 구독
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }, // 자신의 메시지는 제외 (Optimistic Update로 처리)
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `webinar_id=eq.${webinarId}`,
        },
        (payload) => {
          console.log('실시간 메시지 이벤트:', payload.eventType, payload)
          
          lastEventAt.current = Date.now() // 이벤트 수신 시간 업데이트
          reconnectTriesRef.current = 0 // 재연결 시도 횟수 리셋
          
          // 이벤트 수신 시 폴백 끄기
          if (fallbackOn) {
            setFallbackOn(false)
          }
          
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any
            if (newMsg && !newMsg.hidden) {
              console.log('새 메시지 수신:', newMsg)
              
              // 초기 로드가 완료되지 않았으면 무시 (초기 로드가 모든 메시지를 가져옴)
              if (initialLoadTimeRef.current === 0) {
                console.log('초기 로드 전, Realtime 메시지 무시')
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
                  
                  const registration = registrationResponse.data
                  const isParticipant = registration?.role === 'attendee'
                  
                  // 관리자 여부 확인
                  let isAdmin = false
                  if (adminCheckResponse.ok) {
                    const adminResult = await adminCheckResponse.json()
                    isAdmin = adminResult.adminUserIds?.includes(newMsg.user_id) || false
                  }
                  
                  const displayName = isAdmin || !isParticipant
                    ? '관리자'
                    : (profile?.display_name || profile?.email || '익명')
                  
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
                  // 현재 메시지가 없으면 무시 (초기 로드 전)
                  if (prev.length === 0) {
                    return prev
                  }
                  
                  // 현재 표시된 메시지 중 가장 최신 메시지 찾기
                  const latestMsg = prev[prev.length - 1]
                  if (latestMsg && latestMsg.created_at) {
                    const latestTime = new Date(latestMsg.created_at).getTime()
                    const newMsgTime = new Date(newMsg.created_at).getTime()
                    
                    // 새 메시지가 현재 표시된 메시지보다 오래된 것이면 무시
                    // (과거 메시지는 초기 로드나 더보기로만 추가)
                    if (newMsgTime <= latestTime) {
                      console.log('과거 메시지 무시 (Realtime):', newMsg.created_at, 'vs', latestMsg.created_at)
                      return prev
                    }
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
                    return updated
                  }
                  
                  // 새 메시지 추가 (중복 방지)
                  if (prev.some(m => m.id === newMsg.id)) return prev
                  
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
                  // 현재 메시지가 없으면 무시
                  if (prev.length === 0) {
                    return prev
                  }
                  
                  // 현재 표시된 메시지 중 가장 최신 메시지 찾기
                  const latestMsg = prev[prev.length - 1]
                  if (latestMsg && latestMsg.created_at) {
                    const latestTime = new Date(latestMsg.created_at).getTime()
                    const newMsgTime = new Date(newMsg.created_at).getTime()
                    
                    // 새 메시지가 현재 표시된 메시지보다 오래된 것이면 무시
                    if (newMsgTime <= latestTime) {
                      console.log('과거 메시지 무시 (Realtime, 프로필 오류):', newMsg.created_at, 'vs', latestMsg.created_at)
                      return prev
                    }
                  }
                  
                  if (prev.some(m => m.id === newMsg.id)) return prev
                  
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
                  
                  // 윈도우 크기 제한 (가장 오래된 것부터 제거)
                  if (updated.length > MAX_MESSAGES_WINDOW) {
                    return updated.slice(-MAX_MESSAGES_WINDOW)
                  }
                  return updated
                })
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            // 업데이트된 메시지 반영 (id 필수 확인)
            const updatedMsg = payload.new as any
            if (!updatedMsg?.id) {
              console.warn('UPDATE 이벤트에 id가 없습니다:', payload)
              return
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMsg.id
                  ? { ...msg, ...updatedMsg, hidden: updatedMsg.hidden }
                  : msg
              ).filter(msg => !msg.hidden)
            )
          } else if (payload.eventType === 'DELETE') {
            // 삭제된 메시지 제거 (id 필수 확인)
            const deletedMsg = payload.old as any
            if (!deletedMsg?.id) {
              console.warn('DELETE 이벤트에 id가 없습니다:', payload)
              return
            }
            setMessages((prev) => prev.filter((msg) => msg.id !== deletedMsg.id))
          }
        }
      )
      .subscribe(async (status, err) => {
        console.log('실시간 구독 상태:', status, err)
        
        if (status === 'SUBSCRIBED') {
          reconnectTriesRef.current = 0
          setFallbackOn(false)
          lastEventAt.current = Date.now()
          console.log('✅ 실시간 구독 성공:', channelName)
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          reconnectTriesRef.current++
          const delay = Math.min(500 * Math.pow(2, reconnectTriesRef.current - 1), 15000)
          
          console.warn(`⚠️ 실시간 구독 실패 (${status}), ${delay}ms 후 재시도...`)
          
          // 3회 실패 시 폴백 활성화
          if (reconnectTriesRef.current >= 3) {
            console.warn('🔴 실시간 구독 3회 실패, 폴백 폴링 활성화')
            setFallbackOn(true)
            return // 재연결 시도 중단
          }
          
          // 토큰 재주입 시도
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              supabase.realtime.setAuth(session.access_token)
            }
          } catch (tokenError) {
            console.warn('토큰 재주입 실패:', tokenError)
          }
          
          // 재연결 시도 (reconnectKey 변경으로 useEffect 재실행)
          setTimeout(() => {
            // 채널 정리
            channel.unsubscribe().then(() => {
              supabase.removeChannel(channel)
            }).catch(() => {
              // 무시 (이미 정리되었을 수 있음)
            })
            
            // reconnectKey 변경으로 useEffect 재실행
            setReconnectKey(prev => prev + 1)
          }, delay)
        }
      })
    
    return () => {
      console.log('실시간 구독 해제:', channelName)
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel)
      }).catch((err) => {
        console.warn('채널 구독 해제 오류:', err)
      })
    }
  }, [webinarId, supabase, currentUser?.id, reconnectKey])
  
  // 헬스체크: 10초 동안 이벤트가 없으면 폴백 활성화
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventAt.current
      if (timeSinceLastEvent > 10000 && !fallbackOn) {
        console.warn('⚠️ 10초 동안 이벤트 없음, 폴백 폴링 활성화')
        setFallbackOn(true)
      }
    }, 5000) // 5초마다 체크
    
    return () => clearInterval(healthCheckInterval)
  }, [fallbackOn])
  
  // 조건부 폴백 폴링 (증분 폴링 + 지터 + 가시성/오프라인 고려)
  useEffect(() => {
    if (!fallbackOn) return
    
    // 가시성 및 온라인 상태 확인
    const isVisible = document.visibilityState === 'visible'
    const isOnline = navigator.onLine
    
    if (!isVisible || !isOnline) {
      console.log('⏸️ 폴백 폴링 일시 정지 (가시성/오프라인)')
      return
    }
    
    console.log('🔄 폴백 폴링 시작')
    
    // 지터가 포함된 폴링 함수
    const pollWithJitter = async () => {
      try {
        const response = await fetch(
          `/api/webinars/${webinarId}/messages?after=${lastMessageIdRef.current}`
        )
        
        if (response.ok) {
          const { messages: fetchedMessages } = await response.json()
          
          if (fetchedMessages && fetchedMessages.length > 0) {
            console.log(`📥 폴백 폴링: ${fetchedMessages.length}개 메시지 수신`)
            
            setMessages((prev) => {
              const existingIds = new Set(prev.map(m => m.id))
              const newMessages = fetchedMessages.filter((m: Message) => !existingIds.has(m.id))
              
              if (newMessages.length === 0) return prev
              
              const merged = [...prev, ...newMessages]
              const sorted = merged.sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              
              // 윈도우 크기 제한 (가장 오래된 것부터 제거)
              let windowed = sorted
              if (sorted.length > MAX_MESSAGES_WINDOW) {
                windowed = sorted.slice(-MAX_MESSAGES_WINDOW)
              }
              
              // 마지막 메시지 ID 업데이트
              lastMessageIdRef.current = Math.max(
                ...windowed.map(m => typeof m.id === 'number' ? m.id : 0),
                lastMessageIdRef.current
              )
              
              return windowed
            })
            
            // 이벤트 수신 시간 업데이트
            lastEventAt.current = Date.now()
          }
        }
      } catch (error) {
        console.error('폴백 폴링 오류:', error)
      }
      
      // 지터 적용: 기본 3초 ± 400ms 랜덤
      const base = 3000
      const jitter = 400 - Math.random() * 800 // -400 ~ +400ms
      const nextDelay = base + jitter
      
      setTimeout(pollWithJitter, nextDelay)
    }
    
    // 초기 폴링 시작
    const timeoutId = setTimeout(pollWithJitter, 0)
    
    // 가시성/온라인 상태 변경 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // 복귀 시 즉시 1회 폴링
        pollWithJitter()
      }
    }
    
    const handleOnline = () => {
      if (document.visibilityState === 'visible') {
        // 온라인 복귀 시 즉시 1회 폴링
        pollWithJitter()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    
    return () => {
      console.log('🛑 폴백 폴링 중지')
      clearTimeout(timeoutId)
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
            display_name: profile?.display_name,
            email: profile?.email,
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
          messages.map((message) => {
            if (renderMessage) {
              return (
                <div key={message.id} onClick={() => onMessageClick?.(message)}>
                  {renderMessage(message)}
                </div>
              )
            }
            
            return (
              <div
                key={message.id}
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


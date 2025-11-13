'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

interface Message {
  id: number | string // 임시 메시지는 문자열 ID 사용
  user_id: string
  content: string
  created_at: string
  hidden?: boolean
  user?: {
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
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [fallbackOn, setFallbackOn] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; display_name?: string; email?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingClientMsgIdRef = useRef<string | null>(null)
  const lastEventAt = useRef<number>(Date.now())
  const lastMessageIdRef = useRef<number>(0)
  const reconnectTriesRef = useRef<number>(0)
  const supabase = createClientSupabase()
  
  // 현재 사용자 정보 로드 (API 사용하여 RLS 우회)
  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          // API를 통해 프로필 정보 조회 (RLS 우회)
          const response = await fetch(`/api/profiles/${user.id}`)
          if (response.ok) {
            const { profile } = await response.json()
            setCurrentUser({
              id: user.id,
              display_name: profile?.display_name,
              email: profile?.email,
            })
            return
          }
        } catch (apiError) {
          console.warn('API를 통한 프로필 조회 실패:', apiError)
        }
        
        // 폴백: 직접 조회 시도
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .eq('id', user.id)
            .single()
          
          setCurrentUser({
            id: user.id,
            display_name: profile?.display_name,
            email: profile?.email,
          })
        } catch (error) {
          console.warn('직접 프로필 조회 실패:', error)
          // 프로필 정보가 없어도 사용자 ID는 설정
          setCurrentUser({
            id: user.id,
          })
        }
      }
    }
    loadCurrentUser()
  }, [supabase])
  
  // 메시지 로드 및 Realtime 구독
  useEffect(() => {
    loadMessages()
    
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
              
              // 프로필 정보를 API로 빠르게 조회
              const fetchProfile = async () => {
                try {
                  const response = await fetch(`/api/profiles/${newMsg.user_id}`)
                  if (response.ok) {
                    const { profile } = await response.json()
                    return profile
                  }
                } catch (apiError) {
                  console.warn('API를 통한 프로필 조회 실패:', apiError)
                }
                
                try {
                  const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('display_name, email')
                    .eq('id', newMsg.user_id)
                    .single()
                  
                  if (!profileError && profile) {
                    return profile
                  }
                } catch (error) {
                  console.warn('직접 프로필 조회 실패:', error)
                }
                
                return null
              }
              
              fetchProfile().then((profile) => {
                setMessages((prev) => {
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
                    const updated = [...prev]
                    updated[optimisticIndex] = {
                      ...newMsg,
                      user: profile || prev[optimisticIndex].user,
                      isOptimistic: false,
                    }
                    return updated
                  }
                  
                  // 새 메시지 추가 (중복 방지)
                  if (prev.some(m => m.id === newMsg.id)) return prev
                  
                  return [...prev, {
                    id: newMsg.id,
                    user_id: newMsg.user_id,
                    content: newMsg.content,
                    created_at: newMsg.created_at,
                    hidden: newMsg.hidden,
                    user: profile,
                    client_msg_id: newMsg.client_msg_id,
                  }].sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  )
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
                  
                  return [...filtered, {
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
      .subscribe((status, err) => {
        console.log('실시간 구독 상태:', status, err)
        
        if (status === 'SUBSCRIBED') {
          reconnectTriesRef.current = 0
          setFallbackOn(false)
          console.log('✅ 실시간 구독 성공:', channelName)
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          reconnectTriesRef.current++
          const delay = Math.min(500 * Math.pow(2, reconnectTriesRef.current - 1), 15000)
          
          console.warn(`⚠️ 실시간 구독 실패 (${status}), ${delay}ms 후 재시도...`)
          
          // 3회 실패 시 폴백 활성화
          if (reconnectTriesRef.current >= 3) {
            console.warn('🔴 실시간 구독 3회 실패, 폴백 폴링 활성화')
            setFallbackOn(true)
          }
          
          // 재연결 시도
          setTimeout(() => {
            channel.unsubscribe().then(() => {
              supabase.removeChannel(channel)
              // 재구독은 useEffect 재실행으로 처리됨
            })
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
  }, [webinarId, supabase, fallbackOn, currentUser?.id])
  
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
              
              // 마지막 메시지 ID 업데이트
              lastMessageIdRef.current = Math.max(
                ...sorted.map(m => typeof m.id === 'number' ? m.id : 0),
                lastMessageIdRef.current
              )
              
              return sorted
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
  
  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const loadMessages = async () => {
    setLoading(true)
    try {
      // API를 통해 메시지 조회 (프로필 정보 포함, RLS 우회)
      const response = await fetch(`/api/webinars/${webinarId}/messages`)
      
      if (!response.ok) {
        throw new Error('메시지 조회 실패')
      }
      
      const { messages } = await response.json()
      const loadedMessages = messages || []
      
      // 마지막 메시지 ID 업데이트 (폴백 폴링용)
      if (loadedMessages.length > 0) {
        lastMessageIdRef.current = Math.max(
          ...loadedMessages.map((m: Message) => typeof m.id === 'number' ? m.id : 0),
          lastMessageIdRef.current
        )
      }
      
      setMessages(loadedMessages)
    } catch (error) {
      console.error('메시지 로드 실패:', error)
      // 폴백: 클라이언트에서 직접 조회 시도
      try {
        const { data, error: fallbackError } = await supabase
          .from('messages')
          .select(`
            id,
            user_id,
            content,
            created_at,
            hidden,
            profiles:user_id (
              display_name,
              email
            )
          `)
          .eq('webinar_id', webinarId)
          .eq('hidden', false)
          .order('created_at', { ascending: false })
          .limit(maxMessages)
        
        if (!fallbackError && data) {
          const formattedMessages = (data || []).map((msg: any) => ({
            id: msg.id,
            user_id: msg.user_id,
            content: msg.content,
            created_at: msg.created_at,
            hidden: msg.hidden,
            user: msg.profiles || null,
          })).reverse()
          
          setMessages(formattedMessages)
        }
      } catch (fallbackError) {
        console.error('폴백 메시지 로드 실패:', fallbackError)
      }
    } finally {
      setLoading(false)
    }
  }
  
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
    
    // Optimistic Update: 즉시 UI에 임시 메시지 추가 (프로필 정보 포함)
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
      setMessages((prev) => prev.map((msg) => {
        if (msg.id === tempId) {
          return {
            ...serverMsg,
            user: userProfile || msg.user,
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
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4 space-y-2 sm:space-y-3">
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
                className={`hover:bg-gray-50 p-1.5 sm:p-2 rounded-lg cursor-pointer transition-colors ${
                  message.isOptimistic ? 'opacity-70' : ''
                }`}
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


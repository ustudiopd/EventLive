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
  const [currentUser, setCurrentUser] = useState<{ id: string; display_name?: string; email?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
  
  // 메시지 로드
  useEffect(() => {
    loadMessages()
    
    // 고유한 채널 이름 생성 (타임스탬프 포함하여 중복 방지)
    const channelName = `webinar-${webinarId}-messages-${Date.now()}`
    
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
          
          if (payload.eventType === 'INSERT') {
            // 새 메시지만 추가 (전체 로드 대신)
            const newMsg = payload.new as any
            if (newMsg && !newMsg.hidden) {
              console.log('새 메시지 수신:', newMsg)
              
              // 프로필 정보를 API로 빠르게 조회
              const fetchProfile = async () => {
                try {
                  // API를 통해 프로필 정보 조회 (가장 빠른 방법)
                  const response = await fetch(`/api/profiles/${newMsg.user_id}`)
                  if (response.ok) {
                    const { profile } = await response.json()
                    return profile
                  }
                } catch (apiError) {
                  console.warn('API를 통한 프로필 조회 실패:', apiError)
                }
                
                // 폴백: 직접 조회
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
              
              // 프로필 정보를 빠르게 조회하고 메시지 추가
              fetchProfile().then((profile) => {
                setMessages((prev) => {
                  // 이미 존재하는 메시지인지 확인 (중복 방지)
                  const exists = prev.some(m => m.id === newMsg.id || (typeof m.id === 'string' && m.id.startsWith('temp-') && m.user_id === newMsg.user_id && m.content === newMsg.content))
                  if (exists) {
                    // Optimistic 메시지가 있으면 실제 메시지로 교체
                    return prev.map((msg) => {
                      if (msg.isOptimistic && msg.user_id === newMsg.user_id && msg.content === newMsg.content) {
                        return {
                          id: newMsg.id,
                          user_id: newMsg.user_id,
                          content: newMsg.content,
                          created_at: newMsg.created_at,
                          hidden: newMsg.hidden,
                          user: profile || msg.user, // 프로필 정보
                          isOptimistic: false,
                        }
                      }
                      return msg
                    }).filter(msg => !msg.isOptimistic || msg.user_id !== newMsg.user_id || msg.content !== newMsg.content)
                  }
                  
                  // Optimistic 메시지 찾기 및 제거
                  const optimisticIndex = prev.findIndex(
                    m => m.isOptimistic && 
                    m.user_id === newMsg.user_id && 
                    m.content === newMsg.content
                  )
                  
                  let filtered = prev
                  if (optimisticIndex !== -1) {
                    // Optimistic 메시지 제거
                    filtered = prev.filter((_, idx) => idx !== optimisticIndex)
                  }
                  
                  // 새 메시지 추가
                  return [...filtered, {
                    id: newMsg.id,
                    user_id: newMsg.user_id,
                    content: newMsg.content,
                    created_at: newMsg.created_at,
                    hidden: newMsg.hidden,
                    user: profile, // 프로필 정보
                  }].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                })
              }).catch((error) => {
                console.error('프로필 조회 오류:', error)
                // 프로필 없이도 메시지 추가 (나중에 프로필 정보 업데이트)
                setMessages((prev) => {
                  const exists = prev.some(m => m.id === newMsg.id)
                  if (exists) return prev
                  
                  // Optimistic 메시지 찾기 및 제거
                  const optimisticIndex = prev.findIndex(
                    m => m.isOptimistic && 
                    m.user_id === newMsg.user_id && 
                    m.content === newMsg.content
                  )
                  
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
                  }].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                })
                
                // 나중에 프로필 정보 업데이트 시도
                setTimeout(() => {
                  fetch(`/api/profiles/${newMsg.user_id}`)
                    .then((res) => res.json())
                    .then(({ profile }) => {
                      if (profile) {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === newMsg.id
                              ? { ...msg, user: profile }
                              : msg
                          )
                        )
                      }
                    })
                    .catch(() => {
                      // 프로필 조회 실패는 무시
                    })
                }, 1000)
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            // 업데이트된 메시지 반영
            const updatedMsg = payload.new as any
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMsg.id
                  ? { ...msg, ...updatedMsg, hidden: updatedMsg.hidden }
                  : msg
              ).filter(msg => !msg.hidden)
            )
          } else if (payload.eventType === 'DELETE') {
            // 삭제된 메시지 제거
            const deletedMsg = payload.old as any
            setMessages((prev) => prev.filter((msg) => msg.id !== deletedMsg.id))
          }
        }
      )
      .subscribe((status, err) => {
        console.log('실시간 구독 상태:', status, err)
        if (status === 'SUBSCRIBED') {
          console.log('✅ 실시간 구독 성공 - 메시지가 실시간으로 업데이트됩니다')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 실시간 구독 오류:', err)
          console.warn('⚠️ Realtime이 활성화되지 않았을 수 있습니다. Supabase Dashboard에서 Realtime을 활성화해주세요.')
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ 실시간 구독 타임아웃')
        } else if (status === 'CLOSED') {
          console.log('🔒 실시간 구독 종료')
        }
      })
    
    return () => {
      console.log('실시간 구독 해제:', channelName)
      // 채널 구독 해제 및 제거
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel)
      }).catch((err) => {
        console.warn('채널 구독 해제 오류:', err)
      })
    }
  }, [webinarId])
  
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
      
      setMessages(messages || [])
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
    
    const messageContent = newMessage.trim()
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const now = new Date().toISOString()
    
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
      } : undefined, // 프로필 정보가 있으면 포함, 없으면 undefined
      isOptimistic: true,
    }
    
    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage('')
    setSending(true)
    
    try {
      // API를 통해 메시지 전송 (서버 사이드에서 agency_id, client_id 자동 설정)
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
      console.error('메시지 전송 실패:', error)
      // 실패한 메시지를 다시 입력창에 복원
      setNewMessage(messageContent)
      alert(error.message || '메시지 전송에 실패했습니다')
    } finally {
      setSending(false)
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


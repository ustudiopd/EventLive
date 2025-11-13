'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

interface Message {
  id: number
  user_id: string
  content: string
  created_at: string
  hidden?: boolean
  user?: {
    display_name?: string
    email?: string
  }
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClientSupabase()
  
  // 메시지 로드
  useEffect(() => {
    loadMessages()
    
    // 실시간 구독
    const channel = supabase
      .channel(`webinar-${webinarId}-messages`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `webinar_id=eq.${webinarId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadMessages()
          } else if (payload.eventType === 'UPDATE') {
            loadMessages()
          } else if (payload.eventType === 'DELETE') {
            loadMessages()
          }
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [webinarId])
  
  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const loadMessages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
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
      
      if (error) throw error
      
      const formattedMessages = (data || []).map((msg: any) => ({
        id: msg.id,
        user_id: msg.user_id,
        content: msg.content,
        created_at: msg.created_at,
        hidden: msg.hidden,
        user: msg.profiles,
      })).reverse()
      
      setMessages(formattedMessages)
    } catch (error) {
      console.error('메시지 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending || !canSend) return
    
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('로그인이 필요합니다')
        return
      }
      
      // API를 통해 메시지 전송 (서버 사이드에서 agency_id, client_id 자동 설정)
      const response = await fetch('/api/messages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webinarId,
          content: newMessage.trim(),
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '메시지 전송 실패')
      }
      
      setNewMessage('')
      onMessageSent?.(result.message)
    } catch (error: any) {
      console.error('메시지 전송 실패:', error)
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">메시지를 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">아직 메시지가 없습니다</div>
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
                className="hover:bg-gray-50 p-2 rounded-lg cursor-pointer transition-colors"
                onClick={() => onMessageClick?.(message)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {message.user?.display_name || message.user?.email || '익명'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 break-words">{message.content}</p>
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
        <form onSubmit={handleSend} className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {sending ? '전송 중...' : '전송'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {newMessage.length}/500
          </p>
        </form>
      )}
    </div>
  )
}


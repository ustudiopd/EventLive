'use client'

import { useState, useEffect } from 'react'
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

interface ChatModerationProps {
  webinarId: string
}

export default function ChatModeration({ webinarId }: ChatModerationProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClientSupabase()
  
  useEffect(() => {
    loadMessages()
    
    // 실시간 구독
    const channel = supabase
      .channel(`webinar-${webinarId}-messages-moderation`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `webinar_id=eq.${webinarId}`,
        },
        () => {
          loadMessages()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [webinarId])
  
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
        .order('created_at', { ascending: false })
        .limit(100)
      
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
  
  const handleHide = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '메시지 숨김 실패')
      }
      
      loadMessages()
    } catch (error: any) {
      console.error('메시지 숨김 실패:', error)
      alert(error.message || '메시지 숨김에 실패했습니다')
    }
  }
  
  const handleShow = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: false }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '메시지 표시 실패')
      }
      
      loadMessages()
    } catch (error: any) {
      console.error('메시지 표시 실패:', error)
      alert(error.message || '메시지 표시에 실패했습니다')
    }
  }
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }
  
  return (
    <div>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">메시지를 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">메시지가 없습니다</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg border-2 flex items-start justify-between ${
                message.hidden
                  ? 'border-red-200 bg-red-50 opacity-60'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800">
                    {message.user?.display_name || message.user?.email || '익명'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.created_at)}
                  </span>
                  {message.hidden && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">숨김</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 break-words">{message.content}</p>
              </div>
              <div className="ml-4 flex gap-2">
                {message.hidden ? (
                  <button
                    onClick={() => handleShow(message.id)}
                    className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                  >
                    표시
                  </button>
                ) : (
                  <button
                    onClick={() => handleHide(message.id)}
                    className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                  >
                    숨김
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}


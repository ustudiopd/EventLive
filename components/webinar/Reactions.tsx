'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

interface Reaction {
  id: number
  user_id: string
  emoji: string
  created_at: string
}

interface ReactionsProps {
  /** 웨비나 ID */
  webinarId: string
  /** 사용 가능한 이모지 목록 */
  emojis?: string[]
  /** 리액션 가능 여부 */
  canReact?: boolean
  /** 커스텀 클래스명 */
  className?: string
  /** 리액션 클릭 콜백 */
  onReactionClick?: (emoji: string) => void
  /** 커스텀 리액션 렌더러 */
  renderReaction?: (emoji: string, count: number, isActive: boolean) => React.ReactNode
}

/**
 * 이모지 리액션 컴포넌트
 * 모듈화되어 재사용 가능하며 커스터마이징 가능
 */
export default function Reactions({
  webinarId,
  emojis = ['👍', '❤️', '🎉', '👏', '🔥', '💯'],
  canReact = true,
  className = '',
  onReactionClick,
  renderReaction,
}: ReactionsProps) {
  const [reactions, setReactions] = useState<Record<string, { count: number; userIds: Set<string> }>>({})
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const supabase = createClientSupabase()
  
  useEffect(() => {
    loadReactions()
    
    // 실시간 구독
    const channel = supabase
      .channel(`webinar-${webinarId}-reactions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `webinar_id=eq.${webinarId}`,
        },
        () => {
          loadReactions()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [webinarId])
  
  const loadReactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('reactions')
        .select('id, user_id, emoji')
        .eq('webinar_id', webinarId)
      
      if (error) throw error
      
      // 이모지별로 그룹화
      const grouped: Record<string, { count: number; userIds: Set<string> }> = {}
      const userReactionsSet = new Set<string>()
      
      data.forEach((reaction) => {
        if (!grouped[reaction.emoji]) {
          grouped[reaction.emoji] = { count: 0, userIds: new Set() }
        }
        grouped[reaction.emoji].count++
        grouped[reaction.emoji].userIds.add(reaction.user_id)
        
        if (user && reaction.user_id === user.id) {
          userReactionsSet.add(reaction.emoji)
        }
      })
      
      setReactions(grouped)
      setUserReactions(userReactionsSet)
    } catch (error) {
      console.error('리액션 로드 실패:', error)
    }
  }
  
  const handleReaction = async (emoji: string) => {
    if (sending || !canReact) return
    
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('로그인이 필요합니다')
        return
      }
      
      const isActive = userReactions.has(emoji)
      
      if (isActive) {
        // 리액션 제거
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('webinar_id', webinarId)
          .eq('user_id', user.id)
          .eq('emoji', emoji)
        
        if (error) throw error
      } else {
        // 리액션 추가
        const { error } = await supabase
          .from('reactions')
          .insert({
            webinar_id: webinarId,
            user_id: user.id,
            emoji,
          })
        
        if (error) throw error
      }
      
      onReactionClick?.(emoji)
    } catch (error: any) {
      console.error('리액션 처리 실패:', error)
    } finally {
      setSending(false)
    }
  }
  
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {emojis.map((emoji) => {
        const reaction = reactions[emoji]
        const count = reaction?.count || 0
        const isActive = userReactions.has(emoji)
        
        if (renderReaction) {
          return (
            <div key={emoji} onClick={() => handleReaction(emoji)}>
              {renderReaction(emoji, count, isActive)}
            </div>
          )
        }
        
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            disabled={!canReact || sending}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
              ${isActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-white hover:border-blue-300'
              }
              ${!canReact ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-2xl">{emoji}</span>
            {count > 0 && (
              <span className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}


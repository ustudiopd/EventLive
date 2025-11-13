'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

interface PresenceUser {
  id: string
  display_name?: string
  email?: string
}

interface PresenceBarProps {
  /** 웨비나 ID */
  webinarId: string
  /** 커스텀 클래스명 */
  className?: string
  /** 참여자 클릭 콜백 */
  onUserClick?: (user: PresenceUser) => void
  /** 커스텀 참여자 렌더러 */
  renderUser?: (user: PresenceUser) => React.ReactNode
  /** 타이핑 표시 여부 */
  showTyping?: boolean
}

/**
 * Presence Bar 컴포넌트
 * 현재 참여자 수와 목록을 표시하는 모듈화된 컴포넌트
 */
export default function PresenceBar({
  webinarId,
  className = '',
  onUserClick,
  renderUser,
  showTyping = false,
}: PresenceBarProps) {
  const [participants, setParticipants] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const supabase = createClientSupabase()
  
  // 중복 제거 헬퍼 함수 (더 강력한 버전)
  const deduplicateUsers = (users: PresenceUser[]): PresenceUser[] => {
    const seen = new Map<string, PresenceUser>()
    
    users.forEach((user) => {
      if (user && user.id) {
        // 같은 ID가 없거나, 있더라도 더 최신 정보로 업데이트
        if (!seen.has(user.id)) {
          seen.set(user.id, user)
        }
      }
    })
    
    return Array.from(seen.values())
  }
  
  useEffect(() => {
    const channel = supabase.channel(`presence:webinar-${webinarId}`, {
      config: {
        presence: {
          key: 'user',
        },
      },
    })
    
    // 현재 사용자 정보 가져오기
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // Presence에 참여
        channel
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState()
            const usersMap = new Map<string, PresenceUser>()
            
            // presence state의 모든 항목을 순회
            Object.keys(state).forEach((key) => {
              const presences = state[key]
              if (Array.isArray(presences)) {
                presences.forEach((presence: any) => {
                  if (presence && presence.user && presence.user.id) {
                    // 같은 사용자 ID가 이미 있으면 덮어쓰기 (최신 presence 유지)
                    usersMap.set(presence.user.id, presence.user)
                  }
                })
              } else if (presences && typeof presences === 'object') {
                const presence = presences as any
                if (presence.user && presence.user.id) {
                  // 배열이 아닌 단일 객체인 경우
                  usersMap.set(presence.user.id, presence.user)
                }
              }
            })
            
            // Map의 값들을 배열로 변환하고 한 번 더 중복 제거
            const uniqueUsers = deduplicateUsers(Array.from(usersMap.values()))
            
            // 디버깅: 중복 확인
            const userIds = uniqueUsers.map(u => u.id)
            const duplicateIds = userIds.filter((id, index) => userIds.indexOf(id) !== index)
            if (duplicateIds.length > 0) {
              console.warn('중복된 사용자 ID 발견:', duplicateIds)
            }
            
            setParticipants(uniqueUsers)
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('User joined:', key, newPresences)
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', key, leftPresences)
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // 프로필 정보 가져오기
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, display_name, email')
                .eq('id', user.id)
                .single()
              
              await channel.track({
                user: {
                  id: user.id,
                  display_name: profile?.display_name,
                  email: profile?.email,
                },
                online_at: new Date().toISOString(),
              })
            }
          })
      }
    })
    
    // 타이핑 이벤트 구독
    if (showTyping) {
      channel.on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload as { userId: string; isTyping: boolean }
        setTypingUsers((prev) => {
          const next = new Set(prev)
          if (isTyping) {
            next.add(userId)
          } else {
            next.delete(userId)
          }
          return next
        })
      })
    }
    
    return () => {
      channel.unsubscribe()
    }
  }, [webinarId, showTyping])
  
  return (
    <div className={`flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">참여자:</span>
        <span className="text-sm font-bold text-blue-600">{participants.length}명</span>
      </div>
      
      {participants.length > 0 && (
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {deduplicateUsers(participants).map((user, index) => {
            // key를 더 고유하게 만들기 위해 index도 추가
            const uniqueKey = `${user.id}-${index}`
            
            if (renderUser) {
              return (
                <div key={uniqueKey} onClick={() => onUserClick?.(user)}>
                  {renderUser(user)}
                </div>
              )
            }
            
            return (
              <div
                key={uniqueKey}
                className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => onUserClick?.(user)}
              >
                <span className="text-xs font-medium text-gray-700">
                  {user.display_name || user.email || '익명'}
                </span>
                {typingUsers.has(user.id) && (
                  <span className="text-xs text-gray-500 animate-pulse">입력 중...</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


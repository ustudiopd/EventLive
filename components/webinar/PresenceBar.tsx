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
  const [currentUser, setCurrentUser] = useState<PresenceUser | null>(null)
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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        // 현재 사용자 프로필 정보 및 관리자 여부 조회
        try {
          const [profileResponse, registrationResponse, adminCheckResponse] = await Promise.all([
            fetch(`/api/profiles/${user.id}`),
            supabase
              .from('registrations')
              .select('role')
              .eq('webinar_id', webinarId)
              .eq('user_id', user.id)
              .maybeSingle(),
            fetch(`/api/webinars/${webinarId}/check-admin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userIds: [user.id] }),
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
            isAdmin = adminResult.adminUserIds?.includes(user.id) || false
          }
          
          const displayName = isAdmin || !isParticipant
            ? '관리자'
            : (profile?.display_name || profile?.email || '익명')
          
          setCurrentUser({
            id: user.id,
            display_name: displayName,
            email: profile?.email,
          })
        } catch (error) {
          console.warn('현재 사용자 프로필 조회 실패:', error)
          // 폴백: 직접 조회
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, email')
              .eq('id', user.id)
              .single()
            
            setCurrentUser({
              id: user.id,
              display_name: profile?.display_name || profile?.email || '익명',
              email: profile?.email,
            })
          } catch (fallbackError) {
            setCurrentUser({
              id: user.id,
              display_name: '익명',
            })
          }
        }
        
        // Presence에 참여
        channel
          .on('presence', { event: 'sync' }, async () => {
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
            let uniqueUsers = deduplicateUsers(Array.from(usersMap.values()))
            
            // 자기 자신 제외
            uniqueUsers = uniqueUsers.filter(u => u.id !== user.id)
            
            // 프로필 정보가 없는 사용자들의 프로필 정보 조회
            const usersWithoutProfile = uniqueUsers.filter(u => !u.display_name && !u.email)
            if (usersWithoutProfile.length > 0) {
              // API를 통해 프로필 정보 조회 (RLS 우회)
              try {
                const response = await fetch(`/api/webinars/${webinarId}/messages`)
                if (response.ok) {
                  const result = await response.json()
                  const messages = result.messages || []
                  // 메시지에서 프로필 정보 추출
                  const profileMap = new Map<string, { display_name?: string; email?: string }>()
                  messages.forEach((msg: any) => {
                    if (msg.user && msg.user_id && !profileMap.has(msg.user_id)) {
                      profileMap.set(msg.user_id, msg.user)
                    }
                  })
                  
                  // 프로필 정보가 없는 사용자들의 프로필 정보 보강
                  uniqueUsers = uniqueUsers.map(user => {
                    if (!user.display_name && !user.email) {
                      const profile = profileMap.get(user.id)
                      if (profile) {
                        return {
                          ...user,
                          display_name: profile.display_name,
                          email: profile.email,
                        }
                      }
                      
                      // API에서 찾지 못하면 직접 조회 시도
                      supabase
                        .from('profiles')
                        .select('display_name, email')
                        .eq('id', user.id)
                        .single()
                        .then(({ data: profile, error }) => {
                          if (!error && profile) {
                            setParticipants((prev) =>
                              prev.map((p) =>
                                p.id === user.id
                                  ? { ...p, display_name: profile.display_name, email: profile.email }
                                  : p
                              )
                            )
                          }
                        })
                    }
                    return user
                  })
                }
              } catch (apiError) {
                console.warn('프로필 정보 조회 실패:', apiError)
              }
              
              // 프로필 정보가 없는 사용자들의 프로필 정보를 개별적으로 조회 (API 사용)
              usersWithoutProfile.forEach((user) => {
                // API를 통해 프로필 정보 조회 (RLS 우회)
                fetch(`/api/profiles/${user.id}`)
                  .then((res) => res.json())
                  .then(({ profile }) => {
                    if (profile) {
                      setParticipants((prev) =>
                        prev.map((p) =>
                          p.id === user.id
                            ? { ...p, display_name: profile.display_name, email: profile.email }
                            : p
                        )
                      )
                    }
                  })
                  .catch(() => {
                    // 프로필 조회 실패는 무시
                  })
              })
            }
            
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
            // 새 사용자가 참여할 때 프로필 정보 조회
            if (newPresences && Array.isArray(newPresences)) {
              newPresences.forEach((presence: any) => {
                if (presence && presence.user && presence.user.id && (!presence.user.display_name && !presence.user.email)) {
                  fetch(`/api/profiles/${presence.user.id}`)
                    .then((res) => res.json())
                    .then(({ profile }) => {
                      if (profile) {
                        setParticipants((prev) =>
                          prev.map((p) =>
                            p.id === presence.user.id
                              ? { ...p, display_name: profile.display_name, email: profile.email }
                              : p
                          )
                        )
                      }
                    })
                    .catch(() => {
                      // 프로필 조회 실패는 무시
                    })
                }
              })
            }
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('User left:', key, leftPresences)
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // 프로필 정보 가져오기 (API 사용하여 RLS 우회)
              try {
                const response = await fetch(`/api/profiles/${user.id}`)
                if (response.ok) {
                  const { profile } = await response.json()
                  await channel.track({
                    user: {
                      id: user.id,
                      display_name: profile?.display_name,
                      email: profile?.email,
                    },
                    online_at: new Date().toISOString(),
                  })
                } else {
                  // API 실패 시 직접 조회 시도
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
              } catch (error) {
                console.error('프로필 정보 조회 실패:', error)
                // 프로필 없이도 presence 참여
                await channel.track({
                  user: {
                    id: user.id,
                  },
                  online_at: new Date().toISOString(),
                })
              }
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
  
  // 자기 자신을 제외한 참여자 목록
  const otherParticipants = participants.filter(p => p.id !== currentUser?.id)
  
  return (
    <div className={`flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
      {/* 접속 중 표시 */}
      {currentUser && (
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="text-gray-600">접속 중:</span>
          <span className="font-semibold text-gray-800">
            {currentUser.display_name || currentUser.email || '익명'}
          </span>
        </div>
      )}
      
      {/* 참여자 목록 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium text-gray-700">참여자:</span>
          <span className="text-xs sm:text-sm font-bold text-blue-600">{otherParticipants.length}명</span>
        </div>
        
        {otherParticipants.length > 0 && (
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            {deduplicateUsers(otherParticipants).map((user, index) => {
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
    </div>
  )
}


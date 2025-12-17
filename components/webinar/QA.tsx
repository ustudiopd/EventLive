'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

interface Question {
  id: number
  user_id: string
  content: string
  status: 'published' | 'answered' | 'hidden' | 'pinned'
  created_at: string
  answered_by?: string
  answered_at?: string
  answer?: string
  user?: {
    display_name?: string
    email?: string
  }
}

interface QAProps {
  /** 웨비나 ID */
  webinarId: string
  /** 질문 등록 가능 여부 */
  canAsk?: boolean
  /** 커스텀 클래스명 */
  className?: string
  /** 질문 등록 콜백 */
  onQuestionAsked?: (question: Question) => void
  /** 질문 클릭 콜백 */
  onQuestionClick?: (question: Question) => void
  /** 커스텀 질문 렌더러 */
  renderQuestion?: (question: Question) => React.ReactNode
  /** 내 질문만 보기 */
  showOnlyMine?: boolean
  /** 관리자 모드 */
  isAdminMode?: boolean
}

/**
 * Q&A 시스템 컴포넌트
 * 모듈화되어 재사용 가능하며 커스터마이징 가능
 */
export default function QA({
  webinarId,
  canAsk = true,
  className = '',
  onQuestionAsked,
  onQuestionClick,
  renderQuestion,
  showOnlyMine = false,
  isAdminMode = false,
}: QAProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [answering, setAnswering] = useState(false)
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set())
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<{ display_name?: string; email?: string } | null>(null)
  const supabase = createClientSupabase()
  const filterRef = useRef<'all' | 'mine'>('all')
  
  // filter 상태 변경 시 ref 업데이트
  useEffect(() => {
    filterRef.current = filter
  }, [filter])
  
  const loadQuestions = useCallback(async (currentFilter?: 'all' | 'mine') => {
    // currentFilter 파라미터를 사용하여 필터 변경으로 인한 재호출 방지
    const activeFilter = currentFilter ?? filterRef.current
    setLoading(true)
    try {
      // "내 질문" 필터 선택 시 로그인 상태 확인
      if (activeFilter === 'mine' && !isAdminMode) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // 로그인하지 않은 경우 필터를 "전체"로 변경하고 종료
          setFilter('all')
          setLoading(false)
          return
        }
      }
      
      // API를 통해 질문 조회 (프로필 정보 포함, RLS 우회)
      // 관리자 모드일 때는 항상 전체 질문 조회
      const params = new URLSearchParams({
        onlyMine: isAdminMode ? 'false' : (activeFilter === 'mine' ? 'true' : (showOnlyMine ? 'true' : 'false')),
        filter: 'all', // 필터는 클라이언트에서 처리하지 않고 서버에서는 항상 'all'
      })
      
      const response = await fetch(`/api/webinars/${webinarId}/questions?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // 401 에러이고 로그인하지 않은 경우에만 필터를 "전체"로 변경
        if (response.status === 401 && activeFilter === 'mine' && !isAdminMode) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            setFilter('all')
            setLoading(false)
            return
          }
        }
        throw new Error(errorData.error || '질문 조회 실패')
      }
      
      const { questions } = await response.json()
      const loadedQuestions = questions || []
      setQuestions(loadedQuestions)
    } catch (error) {
      console.error('질문 로드 실패:', error)
      // 에러 발생 시에도 기존 질문 목록은 유지 (필터 상태는 위에서 처리)
    } finally {
      setLoading(false)
    }
  }, [webinarId, showOnlyMine, filter, isAdminMode, supabase])
  
  // 현재 사용자 ID 및 프로필 정보 로드
  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        
        // 프로필 정보 미리 로드
        try {
          const response = await fetch(`/api/profiles/${user.id}`)
          if (response.ok) {
            const { profile } = await response.json()
            setCurrentUserProfile({
              display_name: profile?.display_name,
              email: profile?.email,
            })
          }
        } catch (error) {
          console.warn('프로필 정보 조회 실패:', error)
        }
      }
    }
    loadCurrentUser()
  }, [supabase])
  
  useEffect(() => {
    loadQuestions(filterRef.current)
    
    // 고정 채널명 사용
    const channelName = `webinar:${webinarId}:questions`
    
    // 기존 채널 확인 및 제거
    const existingChannel = supabase.getChannels().find(
      ch => ch.topic === `realtime:${channelName}`
    )
    if (existingChannel) {
      existingChannel.unsubscribe().then(() => {
        supabase.removeChannel(existingChannel)
      })
    }
    
    const reconnectTimeouts: NodeJS.Timeout[] = []
    let fallbackInterval: NodeJS.Timeout | null = null
    let reconnectTries = 0
    const MAX_RECONNECT_TRIES = 3
    
    // 실시간 구독
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions',
          filter: `webinar_id=eq.${webinarId}`,
        },
        (payload) => {
          console.log('질문 실시간 이벤트:', payload.eventType)
          reconnectTries = 0 // 성공 시 재연결 시도 횟수 리셋
          // 폴백 폴링 중지
          if (fallbackInterval) {
            clearInterval(fallbackInterval)
            fallbackInterval = null
          }
          
          // UPDATE 이벤트에서 답변이 추가된 경우 즉시 업데이트 (자동 펼치기 없음)
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedQuestion = payload.new as any
            
            // Optimistic 업데이트: 질문 목록에서 즉시 업데이트 (전체 새로고침 없이)
            setQuestions((prev) => prev.map((q) => 
              q.id === updatedQuestion.id ? { ...q, ...updatedQuestion } : q
            ))
          } else if (payload.eventType === 'INSERT' && payload.new) {
            // INSERT 이벤트: 새 질문 추가 (프로필 정보는 나중에 loadQuestions에서 처리)
            const newQuestion = payload.new as any
            // 중복 체크 후 추가
            setQuestions((prev) => {
              if (prev.some(q => q.id === newQuestion.id)) {
                return prev
              }
              // 프로필 정보는 나중에 loadQuestions에서 채워질 것
              return [{ ...newQuestion, user: null }, ...prev]
            })
            // 프로필 정보를 위해 나중에 전체 새로고침 (선택적)
            // loadQuestions()
          } else {
            // DELETE 등 다른 이벤트는 전체 새로고침 (현재 필터 유지)
            loadQuestions(filterRef.current)
          }
        }
      )
      .subscribe(async (status, err) => {
        console.log('질문 실시간 구독 상태:', status, err)
        if (status === 'SUBSCRIBED') {
          console.log('✅ 질문 실시간 구독 성공:', channelName)
          reconnectTries = 0
          // 폴백 폴링 중지
          if (fallbackInterval) {
            clearInterval(fallbackInterval)
            fallbackInterval = null
          }
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          console.warn(`⚠️ 질문 실시간 구독 실패 (${status})`)
          
          if (reconnectTries < MAX_RECONNECT_TRIES) {
            reconnectTries++
            const delay = Math.min(1000 * Math.pow(2, reconnectTries - 1), 10000) // 지수 백오프
            console.log(`${delay}ms 후 재연결 시도 (${reconnectTries}/${MAX_RECONNECT_TRIES})...`)
            const timeout = setTimeout(() => {
              // 채널 재구독
              channel.unsubscribe().then(() => {
                channel.subscribe()
              })
            }, delay)
            reconnectTimeouts.push(timeout)
          } else {
            console.warn('질문 실시간 구독 최대 재시도 횟수 초과, 폴백 폴링 활성화')
            // 폴백: 주기적으로 질문 새로고침 (현재 필터 유지)
            if (!fallbackInterval) {
              fallbackInterval = setInterval(() => {
                loadQuestions(filterRef.current)
              }, 5000) // 5초마다 폴링
            }
          }
        }
      })
    
    return () => {
      // 모든 재연결 타임아웃 정리
      reconnectTimeouts.forEach(timeout => clearTimeout(timeout))
      // 폴백 폴링 정리
      if (fallbackInterval) {
        clearInterval(fallbackInterval)
      }
      // 채널 구독 해제
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel)
      }).catch((err) => {
        console.warn('질문 채널 구독 해제 오류:', err)
      })
    }
  }, [webinarId, showOnlyMine, filter, isAdminMode, supabase, loadQuestions])
  
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || sending || !canAsk) return
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('로그인이 필요합니다')
      return
    }
    
    const questionContent = newQuestion.trim()
    const tempId = `temp-${Date.now()}`
    
    // 프로필 정보가 없으면 미리 로드
    let userProfile = currentUserProfile
    if (!userProfile || (!userProfile.display_name && !userProfile.email)) {
      try {
        const response = await fetch(`/api/profiles/${user.id}`)
        if (response.ok) {
          const { profile } = await response.json()
          userProfile = {
            display_name: profile?.display_name,
            email: profile?.email,
          }
          setCurrentUserProfile(userProfile)
        }
      } catch (error) {
        console.warn('프로필 정보 조회 실패:', error)
      }
    }
    
    // 표시명 결정 (프로필 정보 우선, 없으면 이메일, 없으면 '익명')
    const displayName = userProfile?.display_name || userProfile?.email || '익명'
    
    // Optimistic Update: 즉시 UI에 임시 질문 추가 (프로필 정보 포함)
    const optimisticQuestion: Question = {
      id: parseInt(tempId.replace('temp-', '')),
      user_id: user.id,
      content: questionContent,
      status: 'published',
      created_at: new Date().toISOString(),
      user: {
        display_name: displayName,
        email: userProfile?.email,
      },
    }
    
    setQuestions((prev) => [...prev, optimisticQuestion])
    setNewQuestion('')
    setSending(true)
    
    try {
      // API를 통해 질문 등록 (서버 사이드에서 agency_id, client_id 자동 설정)
      const response = await fetch('/api/questions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webinarId,
          content: questionContent,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        // 실패: Optimistic 질문 제거 및 입력 복원
        setQuestions((prev) => prev.filter((q) => q.id !== optimisticQuestion.id))
        setNewQuestion(questionContent)
        throw new Error(result.error || '질문 등록 실패')
      }
      
      // 성공: Optimistic 질문을 실제 질문으로 교체 (프로필 정보 유지)
      const serverQuestion = result.question
      setQuestions((prev) => prev.map((q) => {
        if (q.id === optimisticQuestion.id) {
          return {
            ...serverQuestion,
            user: serverQuestion.user || optimisticQuestion.user, // 서버 응답에 프로필이 없으면 Optimistic 유지
          }
        }
        return q
      }))
      
      onQuestionAsked?.(result.question)
    } catch (error: any) {
      console.error('질문 등록 실패:', error)
      alert(error.message || '질문 등록에 실패했습니다')
    } finally {
      setSending(false)
    }
  }
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }
  
  const handleQuestionClick = (question: Question) => {
    if (isAdminMode) {
      setSelectedQuestion(question)
      setAnswerText('')
    } else {
      onQuestionClick?.(question)
    }
  }
  
  const handleAnswer = async () => {
    if (!selectedQuestion || !answerText.trim() || answering) return
    
    setAnswering(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('로그인이 필요합니다')
        return
      }
      
      // 답변 API 호출
      const response = await fetch(`/api/questions/${selectedQuestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'answered',
          answeredBy: user.id,
          answer: answerText.trim(),
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '답변 등록 실패')
      }
      
      // 질문 목록 새로고침
      await loadQuestions(filterRef.current)
      
      // 답변 완료 후 모달 닫기
      setSelectedQuestion(null)
      setAnswerText('')
    } catch (error: any) {
      console.error('답변 등록 실패:', error)
      alert(error.message || '답변 등록에 실패했습니다')
      // 에러 발생 시에도 answering 상태 해제
      setAnswering(false)
      return
    } finally {
      setAnswering(false)
    }
  }
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 필터 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              filter === 'mine' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            내 질문
          </button>
        </div>
      </div>
      
      {/* 질문 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && questions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            질문을 불러오는 중<span className="inline-flex">
              <span className="animate-loading-dot" style={{ animationDelay: '0s' }}>.</span>
              <span className="animate-loading-dot" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="animate-loading-dot" style={{ animationDelay: '0.4s' }}>.</span>
            </span>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">아직 질문이 없습니다</div>
        ) : (
          questions.map((question) => {
            if (renderQuestion) {
              return (
                <div key={question.id} onClick={() => onQuestionClick?.(question)}>
                  {renderQuestion(question)}
                </div>
              )
            }
            
            const isAnswerExpanded = expandedAnswers.has(question.id)
            
            return (
              <div
                key={question.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  question.status === 'pinned' 
                    ? 'border-yellow-400 bg-yellow-50' 
                    : question.status === 'answered'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                } ${isAdminMode && question.status !== 'answered' ? 'hover:border-green-400' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {question.user?.display_name || question.user?.email || '익명'}
                    </span>
                    {question.status === 'pinned' && (
                      <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded">고정</span>
                    )}
                    {question.status === 'answered' && (
                      <span className="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded">답변됨</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {formatTime(question.created_at)}
                    </span>
                    {/* 관리자 모드: 핀 버튼 */}
                    {isAdminMode && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            const { data: { user } } = await supabase.auth.getUser()
                            if (!user) return
                            
                            const newStatus = question.status === 'pinned' ? 'published' : 'pinned'
                            const response = await fetch(`/api/questions/${question.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                status: newStatus,
                              }),
                            })
                            
                            const result = await response.json()
                            
                            if (!response.ok || result.error) {
                              throw new Error(result.error || '상태 변경 실패')
                            }
                            
                            // 질문 목록 새로고침
                            await loadQuestions(filterRef.current)
                          } catch (error: any) {
                            console.error('핀 상태 변경 실패:', error)
                            alert(error.message || '핀 상태 변경에 실패했습니다')
                          }
                        }}
                        className={`p-1 rounded transition-colors ${
                          question.status === 'pinned'
                            ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100'
                            : 'text-gray-400 hover:text-yellow-600 hover:bg-gray-100'
                        }`}
                        title={question.status === 'pinned' ? '고정 해제' : '고정'}
                      >
                        <svg 
                          className="w-3.5 h-3.5" 
                          fill={question.status === 'pinned' ? 'currentColor' : 'none'} 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" 
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-2">{question.content}</p>
                
                {/* 답변 표시 */}
                {question.status === 'answered' && question.answer && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-green-700">답변</span>
                        {question.answered_at && (
                          <span className="text-xs text-gray-500">
                            답변 시간: {formatTime(question.answered_at)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedAnswers((prev) => {
                            const next = new Set(prev)
                            if (next.has(question.id)) {
                              next.delete(question.id)
                            } else {
                              next.add(question.id)
                            }
                            return next
                          })
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        {isAnswerExpanded ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            접기
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            답변 보기
                          </>
                        )}
                      </button>
                    </div>
                    {isAnswerExpanded && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{question.answer}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 액션 버튼들 */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {/* 관리자 모드: 답변하기 버튼 */}
                  {isAdminMode && question.status !== 'answered' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuestionClick(question)
                      }}
                      className="text-xs text-green-600 hover:text-green-800 font-medium"
                    >
                      답변하기
                    </button>
                  )}
                  
                  {/* 관리자 모드: 질문 삭제 버튼 */}
                  {isAdminMode && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('이 질문을 삭제하시겠습니까?')) return
                        
                        try {
                          const response = await fetch(`/api/questions/${question.id}`, {
                            method: 'DELETE',
                          })
                          
                          if (!response.ok) {
                            const result = await response.json()
                            throw new Error(result.error || '질문 삭제 실패')
                          }
                          
                          // 질문 목록 새로고침
                          await loadQuestions()
                        } catch (error: any) {
                          console.error('질문 삭제 실패:', error)
                          alert(error.message || '질문 삭제에 실패했습니다')
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      삭제
                    </button>
                  )}
                  
                  {/* 참여자 모드: 자신의 질문 수정/삭제 */}
                  {!isAdminMode && currentUserId && question.user_id === currentUserId && question.status !== 'answered' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingQuestion(question)
                          setEditContent(question.content)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        수정
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm('이 질문을 삭제하시겠습니까?')) return
                          
                          try {
                            const response = await fetch(`/api/questions/${question.id}`, {
                              method: 'DELETE',
                            })
                            
                            if (!response.ok) {
                              const result = await response.json()
                              throw new Error(result.error || '질문 삭제 실패')
                            }
                            
                            // 질문 목록 새로고침
                            await loadQuestions(filterRef.current)
                          } catch (error: any) {
                            console.error('질문 삭제 실패:', error)
                            alert(error.message || '질문 삭제에 실패했습니다')
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      
      {/* 질문 입력 */}
      {canAsk && (
        <form onSubmit={handleAsk} className="border-t border-gray-200 p-4">
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="질문을 입력하세요..."
            className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
            rows={3}
            maxLength={1000}
            disabled={sending}
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {newQuestion.length}/1000
            </p>
            <button
              type="submit"
              disabled={!newQuestion.trim() || sending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {sending ? '등록 중...' : '질문 등록'}
            </button>
          </div>
        </form>
      )}
      
      {/* 질문 수정 모달 */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">질문 수정</h3>
                <button
                  onClick={() => {
                    setEditingQuestion(null)
                    setEditContent('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  질문 내용
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="질문을 입력하세요..."
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                  rows={4}
                  maxLength={1000}
                  disabled={editing}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingQuestion(null)
                      setEditContent('')
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    disabled={editing}
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      if (!editContent.trim() || editing) return
                      
                      setEditing(true)
                      try {
                        const response = await fetch(`/api/questions/${editingQuestion.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            content: editContent.trim(),
                          }),
                        })
                        
                        const result = await response.json()
                        
                        if (!response.ok || result.error) {
                          throw new Error(result.error || '질문 수정 실패')
                        }
                        
                        // 질문 목록 새로고침
                        await loadQuestions()
                        setEditingQuestion(null)
                        setEditContent('')
                      } catch (error: any) {
                        console.error('질문 수정 실패:', error)
                        alert(error.message || '질문 수정에 실패했습니다')
                      } finally {
                        setEditing(false)
                      }
                    }}
                    disabled={!editContent.trim() || editing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {editing ? '수정 중...' : '수정 완료'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 관리자 모드: 질문 답변 모달 */}
      {isAdminMode && selectedQuestion && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // 답변 중이 아닐 때만 배경 클릭으로 닫기
            if (!answering && e.target === e.currentTarget) {
              setSelectedQuestion(null)
              setAnswerText('')
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">질문 답변</h3>
                <button
                  onClick={() => {
                    if (!answering) {
                      setSelectedQuestion(null)
                      setAnswerText('')
                    }
                  }}
                  disabled={answering}
                  className={`text-gray-400 hover:text-gray-600 ${answering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 질문 내용 */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {selectedQuestion.user?.display_name || selectedQuestion.user?.email || '익명'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(selectedQuestion.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{selectedQuestion.content}</p>
              </div>
              
              {/* 답변 입력 */}
              {selectedQuestion.status !== 'answered' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    답변 작성
                  </label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="답변을 입력하세요..."
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                    rows={4}
                    maxLength={1000}
                    disabled={answering}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        if (!answering) {
                          setSelectedQuestion(null)
                          setAnswerText('')
                        }
                      }}
                      className={`px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors ${answering ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={answering}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAnswer}
                      disabled={!answerText.trim() || answering}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {answering ? '답변 중...' : '답변 등록'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-800 font-medium mb-2">이미 답변된 질문입니다</div>
                  {selectedQuestion.answered_at && (
                    <div className="text-xs text-green-600 mb-2">
                      답변 시간: {formatTime(selectedQuestion.answered_at)}
                    </div>
                  )}
                  {selectedQuestion.answer && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedQuestion.answer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


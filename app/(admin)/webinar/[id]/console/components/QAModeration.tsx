'use client'

import { useState, useEffect } from 'react'
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

interface QAModerationProps {
  webinarId: string
}

export default function QAModeration({ webinarId }: QAModerationProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'published' | 'answered' | 'pinned'>('all')
  const [answeringQuestionId, setAnsweringQuestionId] = useState<number | null>(null)
  const [answerText, setAnswerText] = useState<Record<number, string>>({})
  const [answering, setAnswering] = useState(false)
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set())
  const supabase = createClientSupabase()
  
  useEffect(() => {
    loadQuestions()
    
    // 실시간 구독
    const channel = supabase
      .channel(`webinar-${webinarId}-questions-moderation`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions',
          filter: `webinar_id=eq.${webinarId}`,
        },
        () => {
          loadQuestions()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [webinarId, filter])
  
  const loadQuestions = async () => {
    setLoading(true)
    try {
      // API를 통해 질문 조회 (프로필 정보 포함, RLS 우회)
      const params = new URLSearchParams({
        onlyMine: 'false', // 운영 콘솔에서는 전체 질문 조회
        filter: filter,
      })
      
      const response = await fetch(`/api/webinars/${webinarId}/questions?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: 질문 조회 실패`)
      }
      
      const result = await response.json()
      const loadedQuestions = result.questions || []
      
      setQuestions(loadedQuestions)
      
      // 답변이 있는 질문은 기본적으로 펼쳐진 상태로 설정
      const answeredQuestionIds = loadedQuestions
        .filter((q: Question) => q.status === 'answered' && q.answer)
        .map((q: Question) => q.id)
      
      if (answeredQuestionIds.length > 0) {
        setExpandedAnswers((prev) => {
          const next = new Set(prev)
          answeredQuestionIds.forEach((id: string) => next.add(Number(id)))
          return next
        })
      }
    } catch (error: any) {
      console.error('질문 로드 실패:', error)
      // 사용자에게 에러 메시지 표시
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }
  
  const handleStatusChange = async (questionId: number, newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          answeredBy: newStatus === 'answered' ? user.id : undefined,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '상태 변경 실패')
      }
      
      loadQuestions()
    } catch (error: any) {
      console.error('상태 변경 실패:', error)
      alert(error.message || '상태 변경에 실패했습니다')
    }
  }
  
  const handleDelete = async (questionId: number) => {
    if (!confirm('이 질문을 숨기시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '삭제 실패')
      }
      
      loadQuestions()
    } catch (error: any) {
      console.error('삭제 실패:', error)
      alert(error.message || '삭제에 실패했습니다')
    }
  }

  const handleAnswer = async (questionId: number) => {
    const answer = answerText[questionId]?.trim()
    if (!answer || answering) return
    
    setAnswering(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('로그인이 필요합니다')
        return
      }
      
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'answered',
          answeredBy: user.id,
          answer: answer,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '답변 등록 실패')
      }
      
      // 답변 완료 후 상태 초기화
      setAnsweringQuestionId(null)
      setAnswerText((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
      
      // 질문 목록 새로고침
      await loadQuestions()
    } catch (error: any) {
      console.error('답변 등록 실패:', error)
      alert(error.message || '답변 등록에 실패했습니다')
    } finally {
      setAnswering(false)
    }
  }

  const toggleAnswerExpanded = (questionId: number) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }
  
  return (
    <div>
      {/* 필터 */}
      <div className="mb-4 flex gap-2 flex-wrap">
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
          onClick={() => setFilter('published')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === 'published' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          미답변
        </button>
        <button
          onClick={() => setFilter('answered')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === 'answered' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          답변됨
        </button>
        <button
          onClick={() => setFilter('pinned')}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === 'pinned' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          고정됨
        </button>
      </div>
      
      {/* 질문 목록 */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {loading && questions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">질문을 불러오는 중...</div>
        ) : questions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">질문이 없습니다</div>
        ) : (
          questions.map((question) => (
            <div
              key={question.id}
              className={`p-4 rounded-lg border-2 transition-colors ${
                question.status === 'pinned' 
                  ? 'border-yellow-400 bg-yellow-50' 
                  : question.status === 'answered'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{question.user?.display_name || '익명'}</span>
                    {question.status === 'pinned' && (
                      <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded">고정</span>
                    )}
                    {question.status === 'answered' && (
                      <span className="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded">답변됨</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(question.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{question.content}</p>
                  
                  {/* 답변 표시 */}
                  {question.answer && answeringQuestionId !== question.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-green-700">답변</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setAnsweringQuestionId(question.id)
                              setAnswerText((prev) => ({ ...prev, [question.id]: question.answer || '' }))
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => toggleAnswerExpanded(question.id)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            {expandedAnswers.has(question.id) ? '접기' : '펼치기'}
                          </button>
                        </div>
                      </div>
                      {expandedAnswers.has(question.id) && (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{question.answer}</p>
                      )}
                    </div>
                  )}
                  
                  {/* 답변 입력/수정 UI */}
                  {answeringQuestionId === question.id ? (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <textarea
                        value={answerText[question.id] || ''}
                        onChange={(e) => setAnswerText((prev) => ({ ...prev, [question.id]: e.target.value }))}
                        placeholder="답변을 입력하세요..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleAnswer(question.id)}
                          disabled={answering || !answerText[question.id]?.trim()}
                          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {answering ? '등록 중...' : '답변 등록'}
                        </button>
                        <button
                          onClick={() => {
                            setAnsweringQuestionId(null)
                            setAnswerText((prev) => {
                              const next = { ...prev }
                              delete next[question.id]
                              return next
                            })
                          }}
                          disabled={answering}
                          className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : !question.answer && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setAnsweringQuestionId(question.id)
                          setExpandedAnswers((prev) => {
                            const next = new Set(prev)
                            next.add(question.id)
                            return next
                          })
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                      >
                        답변하기
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {question.status !== 'pinned' && (
                    <button
                      onClick={() => handleStatusChange(question.id, 'pinned')}
                      className="text-xs px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
                    >
                      고정
                    </button>
                  )}
                  {question.status === 'pinned' && (
                    <button
                      onClick={() => handleStatusChange(question.id, 'published')}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    >
                      고정 해제
                    </button>
                  )}
                  {question.status !== 'answered' && (
                    <button
                      onClick={() => handleStatusChange(question.id, 'answered')}
                      className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                    >
                      답변 완료
                    </button>
                  )}
                  {question.status === 'answered' && (
                    <button
                      onClick={() => handleStatusChange(question.id, 'published')}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    >
                      답변 취소
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(question.id)}
                    className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                  >
                    숨김
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}





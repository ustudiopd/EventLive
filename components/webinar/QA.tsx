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
}: QAProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<'all' | 'published' | 'answered' | 'pinned'>('all')
  const supabase = createClientSupabase()
  
  useEffect(() => {
    loadQuestions()
    
    // 실시간 구독
    const channel = supabase
      .channel(`webinar-${webinarId}-questions`)
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
  }, [webinarId, showOnlyMine])
  
  const loadQuestions = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      let query = supabase
        .from('questions')
        .select(`
          id,
          user_id,
          content,
          status,
          created_at,
          answered_by,
          answered_at,
          profiles:user_id (
            display_name,
            email
          )
        `)
        .eq('webinar_id', webinarId)
      
      if (showOnlyMine && user) {
        query = query.eq('user_id', user.id)
      }
      
      if (filter === 'published') {
        query = query.eq('status', 'published')
      } else if (filter === 'answered') {
        query = query.eq('status', 'answered')
      } else if (filter === 'pinned') {
        query = query.eq('status', 'pinned')
      } else {
        query = query.neq('status', 'hidden')
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const formattedQuestions = (data || []).map((q: any) => ({
        id: q.id,
        user_id: q.user_id,
        content: q.content,
        status: q.status,
        created_at: q.created_at,
        answered_by: q.answered_by,
        answered_at: q.answered_at,
        user: q.profiles,
      }))
      
      // 고정된 질문을 맨 위로
      const sorted = formattedQuestions.sort((a, b) => {
        if (a.status === 'pinned' && b.status !== 'pinned') return -1
        if (a.status !== 'pinned' && b.status === 'pinned') return 1
        return 0
      })
      
      setQuestions(sorted)
    } catch (error) {
      console.error('질문 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || sending || !canAsk) return
    
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('로그인이 필요합니다')
        return
      }
      
      // API를 통해 질문 등록 (서버 사이드에서 agency_id, client_id 자동 설정)
      const response = await fetch('/api/questions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webinarId,
          content: newQuestion.trim(),
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '질문 등록 실패')
      }
      
      setNewQuestion('')
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
      </div>
      
      {/* 질문 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && questions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">질문을 불러오는 중...</div>
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
            
            return (
              <div
                key={question.id}
                className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                  question.status === 'pinned' 
                    ? 'border-yellow-400 bg-yellow-50' 
                    : question.status === 'answered'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
                onClick={() => onQuestionClick?.(question)}
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
                  <span className="text-xs text-gray-500">
                    {formatTime(question.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{question.content}</p>
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
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
    </div>
  )
}


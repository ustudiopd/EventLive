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

interface QAModerationProps {
  webinarId: string
}

export default function QAModeration({ webinarId }: QAModerationProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'published' | 'answered' | 'pinned'>('all')
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


'use client'

import { useState, useEffect } from 'react'

interface ParticipantsTabProps {
  campaignId: string
  entries: any[]
}

export default function ParticipantsTab({ campaignId, entries }: ParticipantsTabProps) {
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [localEntries, setLocalEntries] = useState<any[]>(entries)
  const [updatingPrize, setUpdatingPrize] = useState<string | null>(null)
  const [refreshingEntries, setRefreshingEntries] = useState(false)
  
  // entries가 변경되면 localEntries도 업데이트
  useEffect(() => {
    setLocalEntries(entries)
  }, [entries])
  
  const refreshEntries = async () => {
    setRefreshingEntries(true)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/entries`)
      const result = await response.json()
      
      if (result.success && result.entries) {
        setLocalEntries(result.entries)
      }
    } catch (error) {
      console.error('참여자 목록 새로고침 오류:', error)
    } finally {
      setRefreshingEntries(false)
    }
  }
  
  const handleEntryClick = (entry: any) => {
    setSelectedEntry(entry)
  }
  
  const closeModal = () => {
    setSelectedEntry(null)
  }

  const updatePrize = async (entryId: string, prizeLabel: string | null, e: React.MouseEvent) => {
    e.stopPropagation() // 테이블 행 클릭 이벤트 방지
    
    // Optimistic update: UI를 먼저 업데이트
    setLocalEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, prize_label: prizeLabel } : entry
      )
    )
    
    setUpdatingPrize(entryId)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/entries/${entryId}/prize`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prize_label: prizeLabel }),
      })

      const result = await response.json()

      if (!result.success) {
        // 실패 시 원래대로 되돌리기
        setLocalEntries(entries)
        alert('경품 기록 업데이트에 실패했습니다: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('경품 기록 업데이트 오류:', error)
      // 실패 시 원래대로 되돌리기
      setLocalEntries(entries)
      alert('경품 기록 업데이트 중 오류가 발생했습니다.')
    } finally {
      setUpdatingPrize(null)
    }
  }
  
  // entries에 포함된 answers를 questions 형식으로 변환
  const getAnswersForEntry = (entry: any) => {
    if (!entry.answers || entry.answers.length === 0) {
      return []
    }
    
    return entry.answers.map((a: any) => ({
      id: a.questionId,
      order_no: a.orderNo,
      body: a.questionBody,
      type: a.questionType,
      answer: {
        text: a.answer !== '답변 없음' && a.questionType === 'text' ? a.answer : null,
        choices: a.answer !== '답변 없음' && (a.questionType === 'single' || a.questionType === 'multiple') 
          ? a.answer.split(', ').map((text: string) => ({ text }))
          : null,
      },
    }))
  }
  
  return (
    <>
      <div>
        {/* 헤더 및 새로고침 버튼 */}
        <div className="flex items-center justify-between mb-4">
          <div></div>
          <button
            onClick={refreshEntries}
            disabled={refreshingEntries}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className={`w-5 h-5 ${refreshingEntries ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshingEntries ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        {localEntries && localEntries.length > 0 ? (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">완료번호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">확인코드</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">완료일시</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">스캔일시</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">경품</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {localEntries.map((entry: any) => (
                  <tr 
                    key={entry.id} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.survey_no}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.code6}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.name || '-'}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.company || '-'}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.phone_norm || '-'}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.completed_at ? new Date(entry.completed_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                      onClick={() => handleEntryClick(entry)}
                    >
                      {entry.verified_at ? new Date(entry.verified_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`prize-${entry.id}`}
                            checked={entry.prize_label === '우산'}
                            onClick={(e) => updatePrize(entry.id, '우산', e)}
                            disabled={updatingPrize === entry.id}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            readOnly
                          />
                          <span className="text-sm text-gray-700">우산</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`prize-${entry.id}`}
                            checked={entry.prize_label === '워시백'}
                            onClick={(e) => updatePrize(entry.id, '워시백', e)}
                            disabled={updatingPrize === entry.id}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            readOnly
                          />
                          <span className="text-sm text-gray-700">워시백</span>
                        </label>
                        <div className="flex items-center gap-2 w-20 justify-end">
                          {updatingPrize === entry.id ? (
                            <span className="text-xs text-gray-500">저장 중...</span>
                          ) : entry.prize_label ? (
                            <button
                              onClick={(e) => updatePrize(entry.id, null, e)}
                              disabled={updatingPrize === entry.id}
                              className="text-gray-400 hover:text-red-600 disabled:text-gray-300 transition-colors"
                              title="경품 초기화"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-lg">아직 참여자가 없습니다</p>
          </div>
        )}
      </div>
      
      {/* 설문 답변 모달 */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                설문 답변 상세
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* 참여자 정보 */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-2">참여자 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">이름:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{selectedEntry.name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">회사명:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{selectedEntry.company || '-'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">전화번호:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{selectedEntry.phone_norm || '-'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">완료번호:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">{selectedEntry.survey_no}</span>
                  </div>
                </div>
              </div>
              
              {/* 설문 답변 */}
              {(() => {
                const questions = getAnswersForEntry(selectedEntry)
                
                if (questions.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <p>답변 데이터가 없습니다.</p>
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-6">
                    {questions.map((q: any, index: number) => (
                      <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="text-sm font-medium text-gray-500">문항 {q.order_no}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {q.type === 'single' ? '단일 선택' : q.type === 'multiple' ? '다중 선택' : '텍스트'}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 mb-3">{q.body}</h4>
                        
                        {q.answer && (q.answer.text || (q.answer.choices && q.answer.choices.length > 0)) ? (
                          <div className="mt-3">
                            {q.type === 'text' ? (
                              <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                                {q.answer.text || '답변 없음'}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {q.answer.choices && q.answer.choices.length > 0 ? (
                                  q.answer.choices.map((choice: any, idx: number) => (
                                    <div key={idx} className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-gray-700">
                                      {typeof choice === 'string' ? choice : choice.text || choice.id}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-gray-500">답변 없음</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 mt-3">답변 없음</div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}


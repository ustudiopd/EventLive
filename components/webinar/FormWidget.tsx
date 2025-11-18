'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'

interface FormQuestion {
  id: string
  form_id: string
  order_no: number
  type: 'single' | 'multiple' | 'text'
  body: string
  options?: Array<{ id: string; text: string }> | string[]
  points?: number
  answer_key?: any
}

interface Form {
  id: string
  webinar_id: string
  kind: 'survey' | 'quiz'
  title: string
  description?: string
  status: 'draft' | 'open' | 'closed'
  time_limit_sec?: number
  max_attempts?: number
  questions?: FormQuestion[]
}

interface FormWidgetProps {
  webinarId: string
  formId: string
  onSubmitted?: () => void
  className?: string
}

/**
 * 설문/퀴즈 응답 위젯 컴포넌트
 * 참여자가 설문 또는 퀴즈에 응답할 수 있는 UI 제공
 */
export default function FormWidget({
  webinarId,
  formId,
  onSubmitted,
  className = '',
}: FormWidgetProps) {
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submissionResult, setSubmissionResult] = useState<any>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({}) // 제출한 답안 저장
  const supabase = createClientSupabase()

  // 폼 로드
  useEffect(() => {
    const loadForm = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/webinars/${webinarId}/forms/${formId}`)
        const result = await response.json()

        if (!response.ok || result.error) {
          throw new Error(result.error || '폼을 불러올 수 없습니다')
        }

        setForm(result.form)
        
        // 퀴즈이고 시간 제한이 있으면 타이머 시작
        if (result.form.kind === 'quiz' && result.form.time_limit_sec) {
          setStartTime(new Date())
          setTimeRemaining(result.form.time_limit_sec)
        }

        // 이미 제출했는지 확인 (API에서 전달된 값 사용)
        if (result.form.isSubmitted) {
          setSubmitted(true)
          
          // 퀴즈이고 이미 제출한 경우 정답 정보 표시
          if (result.form.kind === 'quiz' && result.submissionResult) {
            setSubmissionResult(result.submissionResult)
            
            // 사용자 답안 설정
            const answersMap: Record<string, any> = {}
            result.submissionResult.questionResults?.forEach((qr: any) => {
              if (qr.userAnswer) {
                if (qr.userAnswer.choiceIds && qr.userAnswer.choiceIds.length > 0) {
                  // 단일/다중 선택
                  const question = result.form.questions?.find((q: any) => q.id === qr.questionId)
                  if (question?.type === 'single') {
                    answersMap[qr.questionId] = qr.userAnswer.choiceIds[0]
                  } else {
                    answersMap[qr.questionId] = qr.userAnswer.choiceIds
                  }
                } else if (qr.userAnswer.textAnswer) {
                  // 텍스트 답변
                  answersMap[qr.questionId] = qr.userAnswer.textAnswer
                }
              }
            })
            setUserAnswers(answersMap)
          } else if (result.form.kind === 'survey' && result.userAnswers) {
            // 설문이고 이미 제출한 경우 답안 표시
            setUserAnswers(result.userAnswers)
            setShowSuccess(false) // 설문은 답안 확인 화면 표시
          }
        }
      } catch (err: any) {
        setError(err.message || '폼을 불러오는 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    loadForm()
  }, [webinarId, formId, supabase])

  // 타이머
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  // 시간 초과 시 자동 제출
  useEffect(() => {
    if (timeRemaining === 0 && !submitted && !submitting) {
      handleSubmit()
    }
  }, [timeRemaining])

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = async () => {
    if (!form) return

    // 필수 답변 확인
    const requiredQuestions = form.questions?.filter((q) => {
      // 설문은 모든 문항이 필수, 퀴즈는 선택 사항
      return form.kind === 'survey'
    })

    const missingAnswers = requiredQuestions?.filter(
      (q) => answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === ''
    )

    if (missingAnswers && missingAnswers.length > 0) {
      setError('모든 문항에 답변해주세요')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      // 답변 배열 생성 (API가 기대하는 형식으로 변환)
      const answerArray = Object.entries(answers).map(([questionId, value]) => {
        const question = form.questions?.find((q) => q.id === questionId)
        if (!question) {
          return null
        }

        // 단일 선택: choiceIds 배열로 변환
        if (question.type === 'single' && typeof value === 'string') {
          return {
            questionId: questionId,
            choiceIds: [value],
            textAnswer: null,
          }
        }

        // 다중 선택: 이미 배열
        if (question.type === 'multiple' && Array.isArray(value)) {
          return {
            questionId: questionId,
            choiceIds: value,
            textAnswer: null,
          }
        }

        // 텍스트: textAnswer로 변환
        if (question.type === 'text' && typeof value === 'string') {
          return {
            questionId: questionId,
            choiceIds: null,
            textAnswer: value,
          }
        }

        return null
      }).filter((a) => a !== null)

      const response = await fetch(`/api/webinars/${webinarId}/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answerArray,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || '제출에 실패했습니다')
      }

      setSubmitted(true)
      setSubmissionResult(result)
      
      // 사용자 답안 저장 (정답 표시용)
      if (form.kind === 'quiz' && result.questionResults) {
        const answersMap: Record<string, any> = {}
        result.questionResults.forEach((qr: any) => {
          if (qr.userAnswer) {
            if (qr.userAnswer.choiceIds && qr.userAnswer.choiceIds.length > 0) {
              const question = form.questions?.find((q: any) => q.id === qr.questionId)
              if (question?.type === 'single') {
                answersMap[qr.questionId] = qr.userAnswer.choiceIds[0]
              } else {
                answersMap[qr.questionId] = qr.userAnswer.choiceIds
              }
            } else if (qr.userAnswer.textAnswer) {
              answersMap[qr.questionId] = qr.userAnswer.textAnswer
            }
          }
        })
        setUserAnswers(answersMap)
        // 퀴즈는 제출 완료 후 바로 정답 표시 (showSuccess는 false로 설정)
        setShowSuccess(false)
      } else {
        // 설문의 경우 제출 완료 메시지 표시
        setShowSuccess(true)
        // 2초 후 성공 메시지 숨기고 위젯 제거
        setTimeout(() => {
          setShowSuccess(false)
          if (onSubmitted) {
            onSubmitted()
          }
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || '제출 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">폼을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!form) {
    return null
  }

  if (form.status !== 'open') {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-gray-600">
            {form.status === 'draft' ? '아직 시작되지 않은 폼입니다' : '마감된 폼입니다'}
          </p>
        </div>
      </div>
    )
  }

  // 설문 제출 완료 화면 (showSuccess가 true일 때만 표시)
  if (submitted && showSuccess && form.kind === 'survey') {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h3 className="text-xl font-semibold mb-2">제출 완료</h3>
          <p className="text-gray-600 mt-4">감사합니다!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 sm:p-6 ${className}`}>
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{form.title}</h3>
          {form.kind === 'quiz' && timeRemaining !== null && !submitted && (
            <div
              className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
                timeRemaining < 60
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
          )}
          {submitted && form.kind === 'quiz' && submissionResult && (
            <div className="ml-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
              <div className="text-sm font-medium">
                점수: {submissionResult.totalScore} / {submissionResult.totalPoints || form.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0}
              </div>
              {submissionResult.attemptNo && (
                <div className="text-xs text-gray-600 mt-1">
                  시도 횟수: {submissionResult.attemptNo} / {form.max_attempts || '무제한'}
                </div>
              )}
            </div>
          )}
        </div>
        {form.description && (
          <p className="text-sm text-gray-600 mt-2">{form.description}</p>
        )}
        {form.kind === 'quiz' && form.max_attempts && !submitted && (
          <p className="text-xs text-gray-500 mt-2">
            최대 시도 횟수: {form.max_attempts}회
          </p>
        )}
        {submitted && form.kind === 'quiz' && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">✓ 이미 제출하셨습니다. 정답을 확인하세요.</p>
          </div>
        )}
        {submitted && form.kind === 'survey' && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">✓ 이미 설문에 참여하셨습니다. 아래에서 제출한 내용을 확인하실 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* 문항 목록 */}
      <div className="space-y-6 mb-6">
        {form.questions?.map((question, index) => (
          <div key={question.id} className="border-b border-gray-200 pb-6 last:border-0">
            <div className="mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm sm:text-base font-medium text-gray-900">
                  {index + 1}. {question.body}
                  {form.kind === 'survey' && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                  {form.kind === 'quiz' && question.points && (
                    <span className="text-xs text-gray-500 ml-2">({question.points}점)</span>
                  )}
                </label>
                {submitted && form.kind === 'quiz' && submissionResult?.questionResults && (
                  (() => {
                    const result = submissionResult.questionResults.find((r: any) => r.questionId === question.id)
                    const isCorrect = result?.isCorrect
                    if (isCorrect !== null) {
                      return (
                        <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {isCorrect ? '✓ 정답' : '✗ 오답'} ({result?.pointsAwarded || 0}점)
                        </span>
                      )
                    }
                    return null
                  })()
                )}
              </div>
            </div>

            {/* 단일 선택 */}
            {question.type === 'single' && question.options && question.options.length > 0 && (
              <div className="space-y-2 mt-3">
                {question.options.map((option, optIndex) => {
                  // options가 객체 배열인 경우 { id, text } 형태
                  const optionId = typeof option === 'object' ? option.id : String(optIndex)
                  const optionText = typeof option === 'object' ? option.text : option
                  const optionValue = typeof option === 'object' ? option.id : option
                  
                  // 제출 후 정답 표시 (퀴즈) 또는 답안 표시 (설문)
                  const isSubmittedQuiz = submitted && form.kind === 'quiz'
                  const isSubmittedSurvey = submitted && form.kind === 'survey'
                  const result = submissionResult?.questionResults?.find((r: any) => r.questionId === question.id)
                  const isUserAnswer = (isSubmittedQuiz && userAnswers[question.id] === optionValue) || 
                                      (isSubmittedSurvey && userAnswers[question.id] === optionValue)
                  const isCorrectAnswer = result?.correctAnswer?.choiceIds?.includes(optionId)
                  const isWrongAnswer = isUserAnswer && !isCorrectAnswer
                  
                  return (
                    <label
                      key={optionId}
                      className={`flex items-center p-3 rounded-lg border-2 ${
                        isSubmittedQuiz || isSubmittedSurvey
                          ? isSubmittedQuiz && isCorrectAnswer
                            ? 'border-green-500 bg-green-50 cursor-default'
                            : isSubmittedQuiz && isWrongAnswer
                            ? 'border-red-500 bg-red-50 cursor-default'
                            : isSubmittedSurvey && isUserAnswer
                            ? 'border-blue-500 bg-blue-50 cursor-default'
                            : 'border-gray-200 cursor-default'
                          : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={optionValue}
                        checked={answers[question.id] === optionValue || isUserAnswer}
                        onChange={(e) => !(isSubmittedQuiz || isSubmittedSurvey) && handleAnswerChange(question.id, e.target.value)}
                        disabled={isSubmittedQuiz || isSubmittedSurvey}
                        className="mr-3"
                      />
                      <span className="text-sm flex-1">{optionText}</span>
                      {isSubmittedQuiz && (
                        <div className="flex items-center gap-2 ml-2">
                          {isUserAnswer && <span className="text-xs font-medium">내 답안</span>}
                          {isCorrectAnswer && <span className="text-xs font-medium text-green-600">정답</span>}
                        </div>
                      )}
                      {isSubmittedSurvey && isUserAnswer && (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs font-medium text-blue-600">내 답안</span>
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {/* 다중 선택 */}
            {question.type === 'multiple' && question.options && question.options.length > 0 && (
              <div className="space-y-2 mt-3">
                {question.options.map((option, optIndex) => {
                  // options가 객체 배열인 경우 { id, text } 형태
                  const optionId = typeof option === 'object' ? option.id : String(optIndex)
                  const optionText = typeof option === 'object' ? option.text : option
                  const optionValue = typeof option === 'object' ? option.id : option
                  
                  // 제출 후 정답 표시 (퀴즈) 또는 답안 표시 (설문)
                  const isSubmittedQuiz = submitted && form.kind === 'quiz'
                  const isSubmittedSurvey = submitted && form.kind === 'survey'
                  const result = submissionResult?.questionResults?.find((r: any) => r.questionId === question.id)
                  const userAnswerArray = (isSubmittedQuiz || isSubmittedSurvey) ? (userAnswers[question.id] || []) : (answers[question.id] || [])
                  const isUserAnswer = Array.isArray(userAnswerArray) && userAnswerArray.includes(optionValue)
                  const isCorrectAnswer = result?.correctAnswer?.choiceIds?.includes(optionId)
                  const isWrongAnswer = isUserAnswer && !isCorrectAnswer
                  
                  return (
                    <label
                      key={optionId}
                      className={`flex items-center p-3 rounded-lg border-2 ${
                        isSubmittedQuiz || isSubmittedSurvey
                          ? isSubmittedQuiz && isCorrectAnswer
                            ? 'border-green-500 bg-green-50 cursor-default'
                            : isSubmittedQuiz && isWrongAnswer
                            ? 'border-red-500 bg-red-50 cursor-default'
                            : isSubmittedSurvey && isUserAnswer
                            ? 'border-blue-500 bg-blue-50 cursor-default'
                            : 'border-gray-200 cursor-default'
                          : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isUserAnswer}
                        onChange={(e) => {
                          if (!(isSubmittedQuiz || isSubmittedSurvey)) {
                            const current = answers[question.id] || []
                            if (e.target.checked) {
                              handleAnswerChange(question.id, [...current, optionValue])
                            } else {
                              handleAnswerChange(
                                question.id,
                                current.filter((v: string) => v !== optionValue)
                              )
                            }
                          }
                        }}
                        disabled={isSubmittedQuiz || isSubmittedSurvey}
                        className="mr-3"
                      />
                      <span className="text-sm flex-1">{optionText}</span>
                      {isSubmittedQuiz && (
                        <div className="flex items-center gap-2 ml-2">
                          {isUserAnswer && <span className="text-xs font-medium">내 답안</span>}
                          {isCorrectAnswer && <span className="text-xs font-medium text-green-600">정답</span>}
                        </div>
                      )}
                      {isSubmittedSurvey && isUserAnswer && (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs font-medium text-blue-600">내 답안</span>
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {/* 텍스트 입력 */}
            {question.type === 'text' && (
              <div className="mt-3">
                <textarea
                  value={answers[question.id] || (submitted ? (userAnswers[question.id] || '') : '')}
                  onChange={(e) => !submitted && handleAnswerChange(question.id, e.target.value)}
                  disabled={submitted}
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    submitted && form.kind === 'quiz'
                      ? submissionResult?.questionResults?.find((r: any) => r.questionId === question.id)?.isCorrect
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : submitted && form.kind === 'survey'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300'
                  }`}
                  rows={4}
                  placeholder="답변을 입력하세요"
                />
                {submitted && form.kind === 'quiz' && (
                  <div className="mt-2">
                    {submissionResult?.questionResults?.find((r: any) => r.questionId === question.id)?.correctAnswer?.text && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-sm font-medium text-green-600 mb-1">정답:</div>
                        <div className="text-sm">{submissionResult.questionResults.find((r: any) => r.questionId === question.id).correctAnswer.text}</div>
                      </div>
                    )}
                  </div>
                )}
                {submitted && form.kind === 'survey' && userAnswers[question.id] && (
                  <div className="mt-2">
                    <div className="text-xs text-blue-600 font-medium">내 답안</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      {!submitted && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || timeRemaining === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      )}
    </div>
  )
}


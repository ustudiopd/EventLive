'use client'

import { useState, useEffect } from 'react'

interface FormQuestion {
  id: string
  form_id: string
  order_no: number
  type: 'single' | 'multiple' | 'text'
  body: string
  options?: Array<{ id: string; text: string }> | string[]
}

interface Form {
  id: string
  title: string
  description?: string
  questions?: FormQuestion[]
  config?: {
    basicFields?: {
      company?: { enabled: boolean; required: boolean; label: string }
      name?: { enabled: boolean; required: boolean; label: string }
      phone?: { enabled: boolean; required: boolean; label: string }
    }
    consentFields?: Array<{
      id: string
      enabled: boolean
      required: boolean
      title: string
      content: string
    }>
    headerImage?: {
      url?: string
      enabled: boolean
    }
    introTexts?: {
      participationTitle?: string
      participationStep1?: string
      participationStep2?: string
      participationStep3?: string
      requiredNotice?: string
      bottomNotice?: string
    }
  }
}

interface SurveyFormProps {
  campaignId: string
  formId: string | null
  onSubmitted: (result: { survey_no: number; code6: string }) => void
  publicPath?: string
  previewMode?: boolean
  previewFormData?: any
  editMode?: boolean
  introTexts?: {
    participationTitle?: string
    participationStep1?: string
    participationStep2?: string
    participationStep3?: string
    requiredNotice?: string
    bottomNotice?: string
  }
  onIntroTextsChange?: (texts: {
    participationTitle: string
    participationStep1: string
    participationStep2: string
    participationStep3: string
    requiredNotice: string
    bottomNotice: string
  }) => void
  onQuestionClick?: (questionId: string) => void
  onQuestionTextChange?: (questionId: string, text: string) => void
}

export default function SurveyForm({ 
  campaignId, 
  formId, 
  onSubmitted, 
  publicPath,
  previewMode = false, 
  previewFormData,
  editMode = false,
  introTexts,
  onIntroTextsChange,
  onQuestionClick,
  onQuestionTextChange,
}: SurveyFormProps) {
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 기본 필드
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [phone1, setPhone1] = useState('010')
  const [phone2, setPhone2] = useState('')
  const [phone3, setPhone3] = useState('')
  
  // 폼 답변
  const [answers, setAnswers] = useState<Record<string, any>>({})
  
  // 개인정보 동의 상태
  const [openSection, setOpenSection] = useState<number | null>(null)
  const [consent1, setConsent1] = useState(false)
  const [consent2, setConsent2] = useState(false)
  const [consent3, setConsent3] = useState(false)
  
  // 헤더 이미지 URL (Supabase Storage 또는 로컬 파일)
  const headerImageUrl = 'https://yqsayphssjznthrxpgfb.supabase.co/storage/v1/object/public/webinar-thumbnails/hpe-booth-header.jpg'
  
  // 소개 텍스트 (config에서 가져오거나 기본값 사용)
  const defaultIntroTexts = {
    participationTitle: '참여 방법',
    participationStep1: '부스 스태프로부터 메시지 카드를 받는다. HPE Networking에 바라는 점, 기대하는 변화, 또는 응원의 메시지를 자유롭게 작성한다.',
    participationStep2: '모든 설문 문항에 응답한다. (문항 단 3개!)',
    participationStep3: '설문 완료 화면을 부스 스태프에게 보여주고 사은품을 받는다. (이때에 메시지 카드도 같이 제출해 주세요!)',
    requiredNotice: '* 모든 사항은 필수 입력칸입니다.',
    bottomNotice: '',
  }
  
  const currentIntroTexts = introTexts || form?.config?.introTexts || defaultIntroTexts
  
  // 인라인 편집 상태
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editingQuestionText, setEditingQuestionText] = useState('')
  
  const handleStartEdit = (field: string, currentValue: string) => {
    if (!editMode || !onIntroTextsChange) return
    setEditingField(field)
    setEditValue(currentValue)
  }
  
  const handleSaveEdit = () => {
    if (!editingField || !onIntroTextsChange) return
    onIntroTextsChange({
      participationTitle: currentIntroTexts.participationTitle || defaultIntroTexts.participationTitle,
      participationStep1: currentIntroTexts.participationStep1 || defaultIntroTexts.participationStep1,
      participationStep2: currentIntroTexts.participationStep2 || defaultIntroTexts.participationStep2,
      participationStep3: currentIntroTexts.participationStep3 || defaultIntroTexts.participationStep3,
      requiredNotice: currentIntroTexts.requiredNotice || defaultIntroTexts.requiredNotice,
      bottomNotice: currentIntroTexts.bottomNotice || defaultIntroTexts.bottomNotice,
      [editingField]: editValue,
    })
    setEditingField(null)
    setEditValue('')
  }
  
  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }
  
  // 문항 텍스트 편집 시작
  const handleStartQuestionEdit = (questionId: string, currentText: string, e?: React.MouseEvent) => {
    if (!editMode) return
    // Ctrl/Cmd 키를 누른 상태에서 클릭하면 스크롤만, 아니면 편집
    if (e && (e.ctrlKey || e.metaKey)) {
      if (onQuestionClick) {
        onQuestionClick(questionId)
      }
      return
    }
    if (onQuestionTextChange) {
      setEditingQuestionId(questionId)
      setEditingQuestionText(currentText)
    } else if (onQuestionClick) {
      onQuestionClick(questionId)
    }
  }
  
  // 문항 텍스트 편집 저장
  const handleSaveQuestionEdit = () => {
    if (!editingQuestionId || !onQuestionTextChange) return
    onQuestionTextChange(editingQuestionId, editingQuestionText)
    setEditingQuestionId(null)
    setEditingQuestionText('')
  }
  
  // 문항 텍스트 편집 취소
  const handleCancelQuestionEdit = () => {
    setEditingQuestionId(null)
    setEditingQuestionText('')
  }
  
  // 문항 클릭 핸들러 (더블클릭으로도 편집 가능)
  const handleQuestionClick = (questionId: string, currentText: string, e: React.MouseEvent) => {
    if (!editMode) return
    if (e.detail === 2) {
      // 더블클릭: 편집 모드
      handleStartQuestionEdit(questionId, currentText)
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + 클릭: 스크롤
      if (onQuestionClick) {
        onQuestionClick(questionId)
      }
    } else {
      // 일반 클릭: 편집 모드 (onQuestionTextChange가 있는 경우)
      if (onQuestionTextChange) {
        handleStartQuestionEdit(questionId, currentText)
      } else if (onQuestionClick) {
        onQuestionClick(questionId)
      }
    }
  }
  
  // 폼 로드
  useEffect(() => {
    // 미리보기 모드인 경우 previewFormData 사용
    if (previewMode && previewFormData) {
      setForm(previewFormData)
      setLoading(false)
      return
    }
    
    if (!formId) {
      // 폼이 없을 때 기본 문항 4개 표시
      setForm({
        id: 'default',
        title: '설문조사',
        description: '이벤트 참여 설문조사입니다.',
        questions: [
          {
            id: 'q1',
            form_id: 'default',
            order_no: 1,
            type: 'single',
            body: '현재 데이터센터 네트워크 프로젝트 계획이 있으시다면 언제입니까?',
            options: [
              { id: '1', text: '1주일 이내' },
              { id: '2', text: '1개월 이내' },
              { id: '3', text: '1개월 - 3개월' },
              { id: '4', text: '3개월 - 6개월' },
              { id: '5', text: '6개월 - 12개월' },
              { id: '6', text: '1년 이후' },
              { id: '7', text: '계획없음' },
            ],
          },
          {
            id: 'q2',
            form_id: 'default',
            order_no: 2,
            type: 'single',
            body: '데이터센터 외 네트워크 프로젝트 계획이 있으시다면 어떤 것입니까?',
            options: [
              { id: '1', text: '유무선 캠퍼스 & 브랜치 네트워크' },
              { id: '2', text: '엔터프라이즈 라우팅 (SD-WAN 포함)' },
              { id: '3', text: '네트워크 보안' },
              { id: '4', text: '해당 없음' },
            ],
          },
          {
            id: 'q3',
            form_id: 'default',
            order_no: 3,
            type: 'single',
            body: 'HPE의 데이터센터 네트워크 솔루션에 대해 보다 더 자세한 내용을 들어 보실 의향이 있으십니까?',
            options: [
              { id: '1', text: 'HPE 네트워크 전문가의 방문 요청' },
              { id: '2', text: 'HPE 네트워크 전문가의 온라인 미팅 요청' },
              { id: '3', text: 'HPE 네트워크 전문가의 전화 상담 요청' },
              { id: '4', text: '관심 없음' },
            ],
          },
          {
            id: 'q4',
            form_id: 'default',
            order_no: 4,
            type: 'text',
            body: '부스 스태프로부터 받으신 메시지 카드 번호를 입력해 주세요.',
          },
        ],
      })
      setLoading(false)
      return
    }
    
    const loadForm = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/event-survey/campaigns/${campaignId}/forms/${formId}`)
        const result = await response.json()
        
        if (!response.ok || result.error) {
          throw new Error(result.error || '폼을 불러올 수 없습니다')
        }
        
        // config 필드 확인 및 디버깅
        console.log('[SurveyForm] 폼 로드 결과:', {
          formId: result.form?.id,
          hasConfig: !!result.form?.config,
          config: result.form?.config,
          consentFields: result.form?.config?.consentFields,
          enabledConsentFields: result.form?.config?.consentFields?.filter((c: any) => c.enabled)?.length || 0,
        })
        
        setForm(result.form)
      } catch (err: any) {
        console.error('[SurveyForm] 폼 로드 오류:', err)
        setError(err.message || '폼을 불러오는 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }
    
    loadForm()
  }, [campaignId, formId])
  
  const handlePhoneChange = (part: 'phone1' | 'phone2' | 'phone3', value: string) => {
    // 숫자만 입력 허용
    const numericValue = value.replace(/[^0-9]/g, '')
    if (part === 'phone2' || part === 'phone3') {
      if (numericValue.length <= 4) {
        if (part === 'phone2') setPhone2(numericValue)
        else setPhone3(numericValue)
      }
    } else {
      setPhone1(numericValue)
    }
  }
  
  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 미리보기 모드에서는 제출 차단
    if (previewMode) {
      alert('미리보기 모드에서는 제출할 수 없습니다.')
      return
    }
    
    const config = form?.config
    const basicFields = config?.basicFields || {}
    
    // 기본 필드 검증
    if (basicFields.company?.enabled !== false && basicFields.company?.required !== false && !company.trim()) {
      setError(`${basicFields.company?.label || '회사명'}은 필수 항목입니다.`)
      return
    }
    if (basicFields.name?.enabled !== false && basicFields.name?.required !== false && !name.trim()) {
      setError(`${basicFields.name?.label || '이름'}은 필수 항목입니다.`)
      return
    }
    if (basicFields.phone?.enabled !== false && basicFields.phone?.required !== false && (!phone2 || !phone3)) {
      setError(`${basicFields.phone?.label || '휴대전화번호'}를 모두 입력해주세요.`)
      return
    }
    
    // 개인정보 동의 확인
    const consentFields = config?.consentFields || []
    const requiredConsents = consentFields.filter(c => c.enabled && c.required)
    if (requiredConsents.length > 0) {
      const consentMap: Record<string, boolean> = {
        consent1,
        consent2,
        consent3,
      }
      const missingConsents = requiredConsents.filter(c => !consentMap[c.id])
      if (missingConsents.length > 0) {
        setError('모든 필수 개인정보 수집동의에 체크해주세요.')
        return
      }
    }
    
    // 전화번호 조합
    const phone = `${phone1}-${phone2}-${phone3}`
    
    setSubmitting(true)
    setError(null)
    
    try {
      // 답변 배열 구성
      const answerArray = form?.questions?.map(q => {
        const answer = answers[q.id]
        if (!answer) return null
        
        if (q.type === 'single') {
          return {
            questionId: q.id,
            choiceIds: [answer],
          }
        } else if (q.type === 'multiple') {
          return {
            questionId: q.id,
            choiceIds: Array.isArray(answer) ? answer : [answer],
          }
        } else {
          return {
            questionId: q.id,
            textAnswer: answer,
          }
        }
      }).filter(a => a !== null) || []
      
      // 개인정보 동의 데이터 구성
      const consentFields = config?.consentFields || []
      const consentData: Record<string, any> = {
        consented_at: new Date().toISOString(),
      }
      consentFields.forEach((consent) => {
        if (consent.id === 'consent1') consentData.consent1 = consent1
        else if (consent.id === 'consent2') consentData.consent2 = consent2
        else if (consent.id === 'consent3') consentData.consent3 = consent3
      })
      
      const response = await fetch(`/api/public/event-survey/${campaignId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim(),
          phone: phone,
          answers: answerArray,
          consentData,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '제출에 실패했습니다')
      }
      
      if (result.alreadySubmitted) {
        setError('이미 참여하셨습니다.')
        return
      }
      
      // 성공 시 완료 페이지로 이동
      onSubmitted({
        survey_no: result.survey_no,
        code6: result.code6,
      })
    } catch (err: any) {
      setError(err.message || '제출 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900">
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-lg text-gray-600">폼을 불러오는 중...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 pb-20">
      {/* 상단 배너 */}
      <div className="w-full bg-[#f8f9fa]">
        <div className="max-w-[640px] mx-auto">
          <div className="relative w-full overflow-hidden flex justify-center">
            <img
              src={headerImageUrl}
              alt="이벤트 헤더"
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>

      <div className="max-w-[640px] mx-auto px-4 sm:px-5 py-6 sm:py-10">
        {/* 참여 확인하기 버튼 */}
        {publicPath && !previewMode && (
          <div className="mb-4 flex justify-between items-center">
            <div></div>
            <div className="flex flex-col items-end gap-1">
              <a
                href={`/event${publicPath}/survey?lookup=true`}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                참여 확인하기
              </a>
              <p className="text-xs text-[#00B388]">*모든 사항은 필수 입력칸입니다.</p>
            </div>
          </div>
        )}
        {/* 설문 영역 (회색 배경 박스) */}
        <div className="bg-gray-50 rounded-lg shadow-md p-5 sm:p-6 md:p-8">

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 입력 폼 시작 */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 기본 정보 */}
            <div className="space-y-6">
              {(!form?.config || form.config.basicFields?.company?.enabled !== false) && (
                <div>
                  <label className="block text-base font-bold mb-2">
                    {form?.config?.basicFields?.company?.label || '회사명'}
                    {(form?.config?.basicFields?.company?.required !== false) && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full border-b-2 border-gray-200 py-2 focus:border-[#00B388] outline-none transition-colors bg-white text-gray-900"
                    required={form?.config?.basicFields?.company?.required !== false}
                  />
                </div>
              )}
              {(!form?.config || form.config.basicFields?.name?.enabled !== false) && (
                <div>
                  <label className="block text-base font-bold mb-2">
                    {form?.config?.basicFields?.name?.label || '성함'}
                    {(form?.config?.basicFields?.name?.required !== false) && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border-b-2 border-gray-200 py-2 focus:border-[#00B388] outline-none transition-colors bg-white text-gray-900"
                    required={form?.config?.basicFields?.name?.required !== false}
                  />
                </div>
              )}
              {(!form?.config || form.config.basicFields?.phone?.enabled !== false) && (
                <div>
                  <label className="block text-base font-bold mb-2">
                    {form?.config?.basicFields?.phone?.label || '휴대폰 번호'}
                    {(form?.config?.basicFields?.phone?.required !== false) && <span className="text-red-500"> *</span>}
                  </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={phone1}
                    onChange={(e) => handlePhoneChange('phone1', e.target.value)}
                    readOnly
                    className="w-1/3 border-b-2 border-gray-200 py-2 text-center bg-gray-50 outline-none text-gray-900"
                  />
                  <input
                    type="text"
                    value={phone2}
                    onChange={(e) => handlePhoneChange('phone2', e.target.value)}
                    maxLength={4}
                    className="w-1/3 border-b-2 border-gray-200 py-2 text-center focus:border-[#00B388] outline-none bg-white text-gray-900"
                    required={form?.config?.basicFields?.phone?.required !== false}
                  />
                  <input
                    type="text"
                    value={phone3}
                    onChange={(e) => handlePhoneChange('phone3', e.target.value)}
                    maxLength={4}
                    className="w-1/3 border-b-2 border-gray-200 py-2 text-center focus:border-[#00B388] outline-none bg-white text-gray-900"
                    required={form?.config?.basicFields?.phone?.required !== false}
                  />
                </div>
              </div>
              )}
            </div>

            {/* 폼 문항 */}
            {form && form.questions && form.questions.length > 0 && (
              <div className="space-y-6 pt-10">
                
                {form.questions.map((question, index) => (
                  <div key={question.id} className="space-y-2">
                    {editMode && editingQuestionId === question.id ? (
                      <div className="flex items-start gap-2">
                        <span className="text-base font-bold leading-tight pt-2">{index + 1}.</span>
                        <textarea
                          value={editingQuestionText}
                          onChange={(e) => setEditingQuestionText(e.target.value)}
                          onBlur={handleSaveQuestionEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              handleCancelQuestionEdit()
                            }
                          }}
                          className="flex-1 text-base font-bold leading-tight border-2 border-blue-400 rounded px-2 py-1 bg-blue-50"
                          rows={2}
                          autoFocus
                        />
                        {question.type === 'single' && <span className="text-red-500 ml-1 pt-2">*</span>}
                      </div>
                    ) : (
                      <h4 
                        className={`text-base font-bold leading-tight ${editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1 transition-colors' : ''}`}
                        onClick={(e) => handleQuestionClick(question.id, question.body, e)}
                        title={editMode ? (onQuestionTextChange ? '클릭: 편집 | Ctrl+클릭: 폼 관리로 이동' : 'Ctrl+클릭: 폼 관리로 이동') : ''}
                      >
                        {index + 1}. {question.body}
                        {(question.type === 'single' || question.type === 'multiple') && <span className="text-red-500 ml-1">*</span>}
                      </h4>
                    )}
                    
                    {question.type === 'text' && (
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="w-full border-2 border-gray-200 p-3 rounded focus:border-[#00B388] outline-none bg-white text-gray-900"
                        required
                      />
                    )}
                    
                    {question.type === 'single' && question.options && Array.isArray(question.options) && question.options.length > 0 && (
                      <div className="grid grid-cols-1 gap-1.5">
                        {question.options.map((option: any) => {
                          const optionId = typeof option === 'string' ? option : option.id
                          const optionText = typeof option === 'string' ? option : option.text
                          return (
                            <label
                              key={optionId}
                              className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 rounded"
                            >
                              <input
                                type="radio"
                                name={question.id}
                                value={optionId}
                                checked={answers[question.id] === optionId}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="w-5 h-5 accent-[#00B388]"
                                required
                              />
                              <span className="text-sm">{optionText}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                    
                    {question.type === 'multiple' && question.options && Array.isArray(question.options) && question.options.length > 0 && (
                      <div className="grid grid-cols-1 gap-1.5">
                        {question.options.map((option: any) => {
                          const optionId = typeof option === 'string' ? option : option.id
                          const optionText = typeof option === 'string' ? option : option.text
                          const currentAnswers = answers[question.id] || []
                          const isChecked = Array.isArray(currentAnswers) 
                            ? currentAnswers.includes(optionId)
                            : currentAnswers === optionId
                          
                          return (
                            <label
                              key={optionId}
                              className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = answers[question.id] || []
                                  const currentArray = Array.isArray(current) ? current : current ? [current] : []
                                  if (e.target.checked) {
                                    handleAnswerChange(question.id, [...currentArray, optionId])
                                  } else {
                                    handleAnswerChange(question.id, currentArray.filter((id: string) => id !== optionId))
                                  }
                                }}
                                className="w-5 h-5 accent-[#00B388]"
                              />
                              <span className="text-sm">{optionText}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* 개인정보 수집동의 (아코디언) */}
            {(() => {
              // 기본값 정의 (미리보기와 동일)
              const defaultConsentFields = [
                {
                  id: 'consent1',
                  enabled: true,
                  required: true,
                  title: '개인정보 공유 동의',
                  content: 'HPE (은)가 귀하의 개인정보를 수집ㆍ이용하는 목적은 다음과 같습니다 제품과 서비스에 대해 귀하와의 연락, 고객 서비스 증진, 제품 및 서비스에 대한 정보 제공 및 판매, 새로운 서비스와 혜택에 대한 업데이트, 개별 프로모션 제안, 제품 및 서비스에 대한 시장 조사\n\n1. 수집하려는 개인정보의 항목: 이름 이메일 회사명 회사번호 휴대전화번호 직급 주소 우편번호\n\n2. 개인정보의 보유 및 이용 기간: 처리 목적 달성시까지\n\n3. 개인정보를 공유받는 자의 개인정보 보유 및 이용 기간: 개인정보 수집 및 이용 목적 달성 시까지 보관합니다.\n\n4. 동의를 거부할 권리 및 동의 거부에 따른 불이익: 귀하는 위2항의 선택정보 개인정보의 수집ㆍ이용에 대한 동의를 거부할 수 있으며, 동의를 거부한 경우에는 HPE (은)는 귀하에게 그와 관련된 정보나 혜택은 제공하지 않게 됩니다.\n\n5. 수수 금지 관련 정책: 귀하의 회사는 수수 금지와 관련된 정책 및 권리를 가질 수 있으며, 귀하는 이를 준수할 책임이 있습니다. HPE는 이에 대한 책임이 없음을 확인합니다. 귀하는 이 외 모든 HPE 이벤트 약관을 읽고 동의하셨습니다.',
                },
                {
                  id: 'consent2',
                  enabled: true,
                  required: true,
                  title: '개인정보 취급위탁 동의',
                  content: 'HPE (은)는 다음과 같은 마케팅과 커뮤니케이션 등의 목적으로 HPE (은)(을)를 보조하는 서비스 제공자와 공급자에게 개인정보 취급을 위탁할 수 있습니다.\n\n1. 수탁자: (주)언택트온\n\n2. 위탁하는 업무의 내용: 세미나/이벤트 등 마케팅 프로모션 참석 및 등록 확인, 세미나/이벤트 설문지 키인 작업 및 통계 분석, 기프트 제공',
                },
                {
                  id: 'consent3',
                  enabled: true,
                  required: true,
                  title: '전화, 이메일, SMS 수신 동의',
                  content: 'HPE (은)는 제품 및 서비스, 프로모션 또는 시장조사 등의 유용한 정보를 온·오프라인을 통해 안내 드리고자 합니다. 기프트 제공 또는 기프티콘 발송을 위하여 전화 연락 또는 SMS 발송을 드릴 수 있습니다.',
                },
              ]
              
              // consentFields가 없거나 비어있으면 기본값 사용
              const consentFields = (form?.config?.consentFields && form.config.consentFields.length > 0)
                ? form.config.consentFields 
                : defaultConsentFields
              
              const enabledConsentFields = consentFields.filter((c: any) => {
                // enabled가 명시적으로 false가 아닌 경우 모두 표시
                const isEnabled = c.enabled !== false && c.enabled !== undefined
                return isEnabled
              })
              
              // 디버깅 로그 (자세한 정보)
              console.log('[SurveyForm] 개인정보 동의 렌더링 체크:', {
                hasForm: !!form,
                hasConfig: !!form?.config,
                config: form?.config,
                formConfigConsentFields: form?.config?.consentFields,
                consentFields: consentFields,
                consentFieldsLength: consentFields.length,
                enabledConsentFields: enabledConsentFields,
                enabledCount: enabledConsentFields.length,
                enabledDetails: consentFields.map((c: any) => ({
                  id: c.id,
                  enabled: c.enabled,
                  title: c.title,
                })),
              })
              
              if (enabledConsentFields.length === 0) {
                console.log('[SurveyForm] 개인정보 동의 항목이 없어서 렌더링하지 않음')
                return null
              }
              
              console.log('[SurveyForm] 개인정보 동의 섹션 렌더링:', enabledConsentFields.length, '개 항목')
              
              return (
                <div className="space-y-4 pt-10">
                  <h3 className="text-xl font-bold mb-4 text-gray-800">개인정보 수집동의</h3>
                  {enabledConsentFields.map((consent: any, index: number) => {
                  const consentId = consent.id
                  const consentState = consentId === 'consent1' ? consent1 : consentId === 'consent2' ? consent2 : consent3
                  const setConsentState = consentId === 'consent1' ? setConsent1 : consentId === 'consent2' ? setConsent2 : setConsent3
                  
                  return (
                    <div key={consent.id} className="border border-gray-200 rounded overflow-hidden">
                      <div
                        className="bg-gray-600 text-white p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700 transition-colors"
                        onClick={() =>
                          setOpenSection(openSection === index + 1 ? null : index + 1)
                        }
                      >
                        <span className="font-bold text-base">{consent.title}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={consentState}
                              onChange={(e) => setConsentState(e.target.checked)}
                              className="w-5 h-5 accent-[#00B388]"
                              required={consent.required}
                            />
                            <span className="text-xs">동의</span>
                          </label>
                          <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                            <span className="text-xs">
                              {openSection === index + 1 ? '−' : '+'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {openSection === index + 1 && (
                        <div className="p-4 text-xs text-gray-600 bg-gray-50 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line">
                          {consent.content}
                        </div>
                      )}
                    </div>
                  )
                  })}
                </div>
              )
            })()}

            {/* 제출 버튼 */}
            <div className="pt-10">
              <button
                type="submit"
                disabled={submitting || previewMode}
                className="w-full bg-[#00B388] text-white py-4 rounded-md text-xl font-bold shadow-lg hover:bg-[#008f6d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '제출 중...' : previewMode ? '미리보기 모드에서는 제출할 수 없습니다' : '제출하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

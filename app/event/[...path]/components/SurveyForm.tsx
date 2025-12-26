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
    bottomNotice: '설문 완료 화면을 부스 스태프에게 보여주시면 사은품으로 \'3단 자동 양우산\'을 드립니다. (메시지 카드 제출 필수)',
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
        
        setForm(result.form)
      } catch (err: any) {
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
      <div className="text-center py-12">
        <div className="text-5xl mb-4">⏳</div>
        <p className="text-lg text-gray-600">폼을 불러오는 중...</p>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 pb-20">
      {/* 상단 배너 */}
      <div className="w-full bg-[#f8f9fa]">
        <div className="max-w-screen-xl mx-auto">
          <div className="relative w-full overflow-hidden flex justify-center">
            <img
              src={headerImageUrl}
              alt="이벤트 헤더"
              className="w-full h-auto max-w-[600px]"
              style={{ maxHeight: '300px' }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-[640px] mx-auto px-5 py-10">
        {/* 설문 영역 (회색 배경 박스) */}
        <div className="bg-gray-50 rounded-lg shadow-md p-6 md:p-8">
          {/* 참여 방법 안내 */}
          <section className="mb-12">
            {editMode && editingField === 'participationTitle' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveEdit()
                  } else if (e.key === 'Escape') {
                    handleCancelEdit()
                  }
                }}
                className="text-[#00B388] text-xl font-bold mb-6 w-full border-2 border-blue-400 rounded px-2 py-1 bg-blue-50"
                autoFocus
              />
            ) : (
              <h2 
                className={`text-[#00B388] text-xl font-bold mb-6 ${editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1' : ''}`}
                onClick={() => editMode && handleStartEdit('participationTitle', currentIntroTexts.participationTitle || defaultIntroTexts.participationTitle)}
              >
                {currentIntroTexts.participationTitle}
              </h2>
            )}
            <div className="space-y-4 text-base font-medium leading-relaxed">
              {editMode && editingField === 'participationStep1' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                  className="w-full border-2 border-blue-400 rounded px-2 py-1 bg-blue-50"
                  rows={2}
                  autoFocus
                />
              ) : (
                <p 
                  className={editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1' : ''}
                  onClick={() => editMode && handleStartEdit('participationStep1', currentIntroTexts.participationStep1 || defaultIntroTexts.participationStep1)}
                >
                  <strong>하나.</strong> {currentIntroTexts.participationStep1}
                </p>
              )}
              {editMode && editingField === 'participationStep2' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                  className="w-full border-2 border-blue-400 rounded px-2 py-1 bg-blue-50"
                  rows={2}
                  autoFocus
                />
              ) : (
                <p 
                  className={editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1' : ''}
                  onClick={() => editMode && handleStartEdit('participationStep2', currentIntroTexts.participationStep2 || defaultIntroTexts.participationStep2)}
                >
                  <strong>둘.</strong> {currentIntroTexts.participationStep2}
                </p>
              )}
              {editMode && editingField === 'participationStep3' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                  className="w-full border-2 border-blue-400 rounded px-2 py-1 bg-blue-50"
                  rows={2}
                  autoFocus
                />
              ) : (
                <p 
                  className={editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1' : ''}
                  onClick={() => editMode && handleStartEdit('participationStep3', currentIntroTexts.participationStep3 || defaultIntroTexts.participationStep3)}
                >
                  <strong>셋.</strong> {currentIntroTexts.participationStep3}
                </p>
              )}
            </div>
            {editMode && editingField === 'requiredNotice' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveEdit()
                  } else if (e.key === 'Escape') {
                    handleCancelEdit()
                  }
                }}
                className="text-[#00B388] text-right mt-6 text-xs font-bold w-full border-2 border-blue-400 rounded px-2 py-1 bg-blue-50"
                autoFocus
              />
            ) : (
              <p 
                className={`text-[#00B388] text-right mt-6 text-xs font-bold ${editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1' : ''}`}
                onClick={() => editMode && handleStartEdit('requiredNotice', currentIntroTexts.requiredNotice || defaultIntroTexts.requiredNotice)}
              >
                {currentIntroTexts.requiredNotice}
              </p>
            )}
          </section>

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
                    {(form?.config?.basicFields?.company?.required !== false) && ' *'}
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
                    {form?.config?.basicFields?.name?.label || '이름'}
                    {(form?.config?.basicFields?.name?.required !== false) && ' *'}
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
                    {form?.config?.basicFields?.phone?.label || '휴대전화번호'}
                    {(form?.config?.basicFields?.phone?.required !== false) && ' *'}
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
                <h3 className="text-lg font-semibold text-gray-900">{form.title}</h3>
                {form.description && (
                  <p className="text-gray-600 text-sm">{form.description}</p>
                )}
                
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
                        {question.type === 'single' && <span className="text-red-500 ml-1">*</span>}
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
                    
                    {question.type === 'single' && question.options && (
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
                    
                    {question.type === 'multiple' && question.options && (
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
            {form?.config?.consentFields && form.config.consentFields.filter(c => c.enabled).length > 0 && (
              <div className="space-y-4 pt-10">
                <h3 className="text-xl font-bold mb-4 text-gray-800">개인정보 수집동의</h3>
                {form.config.consentFields.filter(c => c.enabled).map((consent, index) => {
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
            )}

            {/* 제출 버튼 */}
            <div className="pt-10">
              <button
                type="submit"
                disabled={submitting || previewMode}
                className="w-full bg-[#00B388] text-white py-4 rounded-md text-xl font-bold shadow-lg hover:bg-[#008f6d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '제출 중...' : previewMode ? '미리보기 모드에서는 제출할 수 없습니다' : '제출하기'}
              </button>
              {editMode && editingField === 'bottomNotice' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                  className="mt-6 w-full border-2 border-blue-400 rounded px-2 py-1 bg-blue-50 text-center text-gray-800 font-bold leading-tight"
                  rows={2}
                  autoFocus
                />
              ) : (
                <p 
                  className={`mt-6 text-center text-gray-800 font-bold leading-tight ${editMode ? 'hover:bg-gray-100 cursor-pointer rounded px-2 py-1' : ''}`}
                  onClick={() => editMode && handleStartEdit('bottomNotice', currentIntroTexts.bottomNotice || defaultIntroTexts.bottomNotice)}
                >
                  {currentIntroTexts.bottomNotice}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

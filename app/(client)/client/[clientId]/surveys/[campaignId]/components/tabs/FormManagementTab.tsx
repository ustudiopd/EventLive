'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// SurveyForm을 동적으로 임포트 (SSR 비활성화)
const SurveyFormPreview = dynamic(
  () => import('@/app/event/[...path]/components/SurveyForm'),
  { ssr: false }
)

interface FormManagementTabProps {
  campaignId: string
  formId: string | null
  publicPath?: string
  onFormUpdate: (campaign: any) => void
}

interface FormQuestion {
  id: string
  order_no: number
  type: 'single' | 'multiple' | 'text'
  body: string
  options?: any
}

interface Form {
  id: string
  title: string
  description?: string
  questions: FormQuestion[]
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

export default function FormManagementTab({ campaignId, formId, publicPath, onFormUpdate }: FormManagementTabProps) {
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [questions, setQuestions] = useState<FormQuestion[]>([])
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [previewEditMode, setPreviewEditMode] = useState(false)
  const questionRefsRef = useRef<Record<string, HTMLDivElement | null>>({})
  
  // 문항 클릭 핸들러 (미리보기에서 문항 클릭 시 해당 문항으로 스크롤)
  const handleQuestionClick = (questionId: string) => {
    // 미리보기 닫고 편집 모드로 전환
    setShowPreview(false)
    setPreviewEditMode(false)
    
    // 해당 문항으로 스크롤
    setTimeout(() => {
      const questionElement = questionRefsRef.current[questionId]
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 하이라이트 효과
        questionElement.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2', 'transition-all')
        setTimeout(() => {
          questionElement.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2')
        }, 2000)
        // 해당 문항 편집 모드로 열기
        setEditingQuestionId(questionId)
      }
    }, 100)
  }
  
  // 문항 텍스트 변경 핸들러 (미리보기에서 문항 텍스트 수정)
  const handleQuestionTextChange = (questionId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return { ...q, body: text }
      }
      return q
    }))
  }
  
  // 소개 텍스트 설정
  const [introTexts, setIntroTexts] = useState({
    participationTitle: '참여 방법',
    participationStep1: '부스 스태프로부터 메시지 카드를 받는다. HPE Networking에 바라는 점, 기대하는 변화, 또는 응원의 메시지를 자유롭게 작성한다.',
    participationStep2: '모든 설문 문항에 응답한다. (문항 단 3개!)',
    participationStep3: '설문 완료 화면을 부스 스태프에게 보여주고 사은품을 받는다. (이때에 메시지 카드도 같이 제출해 주세요!)',
    requiredNotice: '* 모든 사항은 필수 입력칸입니다.',
    bottomNotice: '설문 완료 화면을 부스 스태프에게 보여주시면 사은품으로 \'3단 자동 양우산\'을 드립니다. (메시지 카드 제출 필수)',
  })
  
  // 기본 필드 설정
  const [basicFields, setBasicFields] = useState({
    company: { enabled: true, required: true, label: '회사명' },
    name: { enabled: true, required: true, label: '이름' },
    phone: { enabled: true, required: true, label: '휴대전화번호' },
  })
  
  // 개인정보 동의 설정
  const [consentFields, setConsentFields] = useState([
    {
      id: 'consent1',
      enabled: true,
      required: true,
      title: '개인정보 공유 동의',
      content: 'HPE (은)가 귀하의 개인정보를 수집ㆍ이용하는 목적은 다음과 같습니다 제품과 서비스에 대해 귀하와의 연락, 고객 서비스 증진, 제품 및 서비스에 대한 정보 제공 및 판매, 새로운 서비스와 혜택에 대한 업데이트, 개별 프로모션 제안, 제품 및 서비스에 대한 시장 조사\n\n수집하려는 개인정보의 항목: 이름 회사명 휴대전화번호\n\n개인정보의 보유 및 이용 기간: 처리 목적 달성시까지\n\n개인정보를 공유받는 자의 개인정보 보유 및 이용 기간: 개인정보 수집 및 이용 목적 달성 시까지 보관합니다.\n\n동의를 거부할 권리 및 동의 거부에 따른 불이익: 귀하는 위2항의 선택정보 개인정보의 수집ㆍ이용에 대한 동의를 거부할 수 있으며, 동의를 거부한 경우에는 HPE (은)는 귀하에게 그와 관련된 정보나 혜택은 제공하지 않게 됩니다.\n\n촬영 동의\n본인은 HPE Discover More AI Seoul 2026 행사 중 촬영되는 사진·영상이 HPE 홍보 목적으로 활용될 수 있음에 동의합니다. (활용기간: 목적 달성 시)\n\n기념품 수령 정책 동의\n본인은 소속 기관의 기념품·금품 수령 관련 규정을 이해하며, 이를 준수하는 책임이 본인에게 있음을 확인합니다. HPE는 이에 대한 책임이 없음을 확인합니다.',
    },
    {
      id: 'consent2',
      enabled: true,
      required: true,
      title: '개인정보 취급위탁 동의',
      content: 'HPE (은)는 다음과 같은 마케팅과 커뮤니케이션 등의 목적으로 HPE (은)(을)를 보조하는 서비스 제공자와 공급자에게 개인정보 취급을 위탁할 수 있습니다.\n\n수탁자: ㈜언택트온\n\n위탁하는 업무의 내용: 세미나/이벤트 등 마케팅 프로모션 참석 및 등록 확인, 세미나/이벤트 설문지 키인 작업 및 통계 분석, 기프트 제공',
    },
    {
      id: 'consent3',
      enabled: true,
      required: true,
      title: '전화, 이메일, SMS 수신 동의',
      content: 'HPE (은)는 제품 및 서비스, 프로모션 또는 시장조사 등의 유용한 정보를 온·오프라인을 통해 안내 드리고자 합니다.\n\n기프트 제공 또는 기프티콘 발송을 위하여 전화 연락 또는 SMS 발송을 드릴 수 있습니다.',
    },
  ])
  
  useEffect(() => {
    if (formId) {
      loadForm()
    } else {
      setForm(null)
    }
  }, [formId, campaignId])
  
  const loadForm = async () => {
    if (!formId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/forms/${formId}`)
      const data = await response.json()
      
      if (!response.ok || data.error) {
        throw new Error(data.error || '폼을 불러올 수 없습니다')
      }
      
      setForm(data.form)
      setFormTitle(data.form.title)
      setFormDescription(data.form.description || '')
      setQuestions(data.form.questions || [])
      
      // config 로드
      if (data.form.config) {
        if (data.form.config.basicFields) {
          setBasicFields({
            company: data.form.config.basicFields.company || { enabled: true, required: true, label: '회사명' },
            name: data.form.config.basicFields.name || { enabled: true, required: true, label: '이름' },
            phone: data.form.config.basicFields.phone || { enabled: true, required: true, label: '휴대전화번호' },
          })
        }
        if (data.form.config.consentFields) {
          setConsentFields(data.form.config.consentFields)
        }
        // 소개 텍스트 로드
        if (data.form.config.introTexts) {
          setIntroTexts({
            participationTitle: data.form.config.introTexts.participationTitle || introTexts.participationTitle,
            participationStep1: data.form.config.introTexts.participationStep1 || introTexts.participationStep1,
            participationStep2: data.form.config.introTexts.participationStep2 || introTexts.participationStep2,
            participationStep3: data.form.config.introTexts.participationStep3 || introTexts.participationStep3,
            requiredNotice: data.form.config.introTexts.requiredNotice || introTexts.requiredNotice,
            bottomNotice: data.form.config.introTexts.bottomNotice || introTexts.bottomNotice,
          })
        }
      }
    } catch (error: any) {
      console.error('폼 로드 오류:', error)
      alert(error.message || '폼을 불러오는 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  const handleEdit = () => {
    setEditing(true)
  }
  
  const handleCancel = () => {
    if (form) {
      setFormTitle(form.title)
      setFormDescription(form.description || '')
      setQuestions(form.questions || [])
      if (form.config) {
        if (form.config.basicFields) {
          setBasicFields({
            company: form.config.basicFields.company || { enabled: true, required: true, label: '회사명' },
            name: form.config.basicFields.name || { enabled: true, required: true, label: '이름' },
            phone: form.config.basicFields.phone || { enabled: true, required: true, label: '휴대전화번호' },
          })
        }
        if (form.config.consentFields) {
          setConsentFields(form.config.consentFields)
        }
        if (form.config.introTexts) {
          setIntroTexts({
            participationTitle: form.config.introTexts.participationTitle || introTexts.participationTitle,
            participationStep1: form.config.introTexts.participationStep1 || introTexts.participationStep1,
            participationStep2: form.config.introTexts.participationStep2 || introTexts.participationStep2,
            participationStep3: form.config.introTexts.participationStep3 || introTexts.participationStep3,
            requiredNotice: form.config.introTexts.requiredNotice || introTexts.requiredNotice,
            bottomNotice: form.config.introTexts.bottomNotice || introTexts.bottomNotice,
          })
        }
      }
    }
    setEditing(false)
    setEditingQuestionId(null)
    setPreviewEditMode(false)
  }
  
  const handleSave = async () => {
    if (!formId) return
    
    if (!formTitle.trim()) {
      alert('폼 제목을 입력해주세요')
      return
    }
    
    // 문항 검증
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.body.trim()) {
        alert(`문항 ${i + 1}의 내용을 입력해주세요.`)
        return
      }
      if ((q.type === 'single' || q.type === 'multiple') && (!q.options || q.options.length < 2)) {
        alert(`문항 ${i + 1}은(는) 최소 2개의 선택지가 필요합니다.`)
        return
      }
    }
    
    setSaving(true)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          questions: questions.map((q, index) => {
            // options 정규화 (객체 형태로 통일)
            let normalizedOptions: any[] | undefined = undefined
            if (q.type === 'single' || q.type === 'multiple') {
              if (q.options && Array.isArray(q.options)) {
                normalizedOptions = q.options.map((opt: any) => {
                  if (typeof opt === 'string') {
                    return { id: `opt-${Date.now()}-${Math.random()}`, text: opt }
                  }
                  return opt
                }).filter((opt: any) => opt.text && opt.text.trim() !== '')
              }
              // 최소 2개 선택지 확인
              if (!normalizedOptions || normalizedOptions.length < 2) {
                throw new Error(`문항 "${q.body || `문항 ${index + 1}`}"은(는) 최소 2개의 선택지가 필요합니다.`)
              }
            }
            
            return {
              type: q.type,
              body: q.body.trim(),
              options: normalizedOptions,
            }
          }),
          config: {
            basicFields,
            consentFields,
            introTexts,
          },
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '폼 수정 실패')
      }
      
      setForm(result.form)
      setEditing(false)
      setEditingQuestionId(null)
      alert('폼이 성공적으로 수정되었습니다')
      
      // 캠페인 정보 새로고침
      const campaignResponse = await fetch(`/api/event-survey/campaigns/${campaignId}`)
      const campaignData = await campaignResponse.json()
      if (campaignData.success) {
        onFormUpdate(campaignData.campaign)
      }
    } catch (error: any) {
      console.error('폼 저장 오류:', error)
      alert(error.message || '폼 저장에 실패했습니다')
      setSaving(false)
      return
    } finally {
      setSaving(false)
    }
  }
  
  // 문항 추가
  const handleAddQuestion = () => {
    const newQuestion: FormQuestion = {
      id: `temp-${Date.now()}`,
      order_no: questions.length + 1,
      type: 'single',
      body: '',
      options: [{ id: '1', text: '' }, { id: '2', text: '' }],
    }
    setQuestions([...questions, newQuestion])
    setEditingQuestionId(newQuestion.id)
  }

  // 문항 수정
  const handleUpdateQuestion = (questionId: string, updates: Partial<FormQuestion>) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return { ...q, ...updates }
      }
      return q
    }))
  }

  // 문항 삭제
  const handleRemoveQuestion = (questionId: string) => {
    if (!confirm('이 문항을 삭제하시겠습니까?')) return
    
    const newQuestions = questions.filter(q => q.id !== questionId)
    // order_no 재정렬
    const reorderedQuestions = newQuestions.map((q, index) => ({
      ...q,
      order_no: index + 1,
    }))
    setQuestions(reorderedQuestions)
    if (editingQuestionId === questionId) {
      setEditingQuestionId(null)
    }
  }

  // 선택지 추가
  const handleAddOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const currentOptions = q.options || []
        const newOptionId = `opt-${Date.now()}`
        return {
          ...q,
          options: [...currentOptions, { id: newOptionId, text: '' }],
        }
      }
      return q
    }))
  }

  // 선택지 수정
  const handleUpdateOption = (questionId: string, optionId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        return {
          ...q,
          options: q.options.map((opt: any) => {
            const optId = typeof opt === 'string' ? opt : opt.id
            if (optId === optionId) {
              return typeof opt === 'string' ? text : { ...opt, text }
            }
            return opt
          }),
        }
      }
      return q
    }))
  }

  // 선택지 삭제
  const handleRemoveOption = (questionId: string, optionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        const newOptions = q.options.filter((opt: any) => {
          const optId = typeof opt === 'string' ? opt : opt.id
          return optId !== optionId
        })
        // 최소 2개 유지
        if (newOptions.length < 2) {
          return q
        }
        return {
          ...q,
          options: newOptions,
        }
      }
      return q
    }))
  }

  const handleCreateSampleForm = async () => {
    if (!confirm('샘플 폼을 생성하시겠습니까?')) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/create-sample-form`, {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '샘플 폼 생성 실패')
      }
      
      alert('샘플 폼이 생성되었습니다')
      
      // 캠페인 정보 새로고침
      const campaignResponse = await fetch(`/api/event-survey/campaigns/${campaignId}`)
      const campaignData = await campaignResponse.json()
      if (campaignData.success) {
        onFormUpdate(campaignData.campaign)
        if (campaignData.campaign.form_id) {
          // 폼 ID가 업데이트되었으므로 폼 다시 로드
          setTimeout(() => {
            window.location.reload()
          }, 500)
        }
      }
    } catch (error: any) {
      console.error('샘플 폼 생성 오류:', error)
      alert(error.message || '샘플 폼 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>
  }
  
  if (!formId) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-lg mb-4">연결된 폼이 없습니다</p>
        <button
          onClick={handleCreateSampleForm}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          샘플 폼 생성하기
        </button>
      </div>
    )
  }
  
  if (!form) {
    return <div className="text-center py-8">폼을 불러올 수 없습니다</div>
  }
  
  // 미리보기용 폼 데이터 구성
  const previewFormData = editing ? {
    id: formId || 'preview',
    title: formTitle,
    description: formDescription,
    questions: questions,
    config: {
      basicFields,
      consentFields,
      introTexts,
    },
  } : form

  return (
    <div>
      {showPreview ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">설문 페이지 미리보기</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setPreviewEditMode(!previewEditMode)}
                className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                  previewEditMode
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {previewEditMode ? '편집 모드 OFF' : '편집 모드 ON'}
              </button>
              {publicPath && (
                <a
                  href={`/event${publicPath}/survey`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  새 탭에서 열기
                </a>
              )}
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                미리보기 닫기
              </button>
            </div>
          </div>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {formId && previewFormData ? (
              <SurveyFormPreview
                campaignId={campaignId}
                formId={formId}
                previewMode={true}
                previewFormData={previewFormData}
                editMode={previewEditMode}
                introTexts={introTexts}
                onIntroTextsChange={setIntroTexts}
                onQuestionClick={handleQuestionClick}
                onQuestionTextChange={handleQuestionTextChange}
                onSubmitted={() => {
                  alert('미리보기 모드에서는 제출할 수 없습니다.')
                }}
              />
            ) : (
              <div className="p-8 text-center text-gray-500">
                폼이 연결되지 않았습니다. 먼저 폼을 생성해주세요.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {!editing && (
            <div className="flex justify-end gap-3 mb-6">
              {formId && (
                <button
                  onClick={() => setShowPreview(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  미리보기
                </button>
              )}
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                수정하기
              </button>
            </div>
          )}
          
          {editing && (
            <div className="flex justify-end gap-3 mb-6">
              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                미리보기
              </button>
            </div>
          )}
      
      {editing ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">폼 제목 *</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          {/* 기본 필드 설정 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">기본 필드 설정</h3>
            <div className="space-y-4">
              {(['company', 'name', 'phone'] as const).map((field) => (
                <div key={field} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      {basicFields[field].label}
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={basicFields[field].enabled}
                          onChange={(e) =>
                            setBasicFields((prev) => ({
                              ...prev,
                              [field]: { ...prev[field], enabled: e.target.checked },
                            }))
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm">사용</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={basicFields[field].required}
                          onChange={(e) =>
                            setBasicFields((prev) => ({
                              ...prev,
                              [field]: { ...prev[field], required: e.target.checked },
                            }))
                          }
                          disabled={!basicFields[field].enabled}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">필수</span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={basicFields[field].label}
                    onChange={(e) =>
                      setBasicFields((prev) => ({
                        ...prev,
                        [field]: { ...prev[field], label: e.target.value },
                      }))
                    }
                    disabled={!basicFields[field].enabled}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                    placeholder="필드 라벨"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">문항</label>
              <button
                onClick={() => handleAddQuestion()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                + 문항 추가
              </button>
            </div>
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  문항이 없습니다. &quot;문항 추가&quot; 버튼을 클릭하여 문항을 추가하세요.
                </div>
              ) : (
                questions.map((question, index) => (
                  <div 
                    key={question.id} 
                    ref={(el) => {
                      if (el) {
                        questionRefsRef.current[question.id] = el
                      } else {
                        delete questionRefsRef.current[question.id]
                      }
                    }}
                    className="border border-gray-300 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">문항 {index + 1}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingQuestionId(editingQuestionId === question.id ? null : question.id)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {editingQuestionId === question.id ? '닫기' : '수정'}
                        </button>
                        <button
                          onClick={() => handleRemoveQuestion(question.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    
                    {editingQuestionId === question.id ? (
                      <div className="space-y-4">
                        {/* 문항 유형 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
                          <select
                            value={question.type}
                            onChange={(e) => {
                              const newType = e.target.value as 'single' | 'multiple' | 'text'
                              handleUpdateQuestion(question.id, {
                                type: newType,
                                options: (newType === 'single' || newType === 'multiple') 
                                  ? (question.options && question.options.length > 0 
                                      ? question.options 
                                      : [{ id: '1', text: '' }, { id: '2', text: '' }])
                                  : undefined,
                              })
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="single">단일 선택</option>
                            <option value="multiple">다중 선택</option>
                            <option value="text">텍스트</option>
                          </select>
                        </div>
                        
                        {/* 문항 내용 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            문항 내용 <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={question.body}
                            onChange={(e) => handleUpdateQuestion(question.id, { body: e.target.value })}
                            placeholder="문항 내용을 입력하세요"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        
                        {/* 선택지 (단일/다중 선택인 경우) */}
                        {(question.type === 'single' || question.type === 'multiple') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              선택지 <span className="text-red-500">*</span> (최소 2개)
                            </label>
                            <div className="space-y-2">
                              {question.options?.map((option: any) => {
                                const optionId = typeof option === 'string' ? option : option.id
                                const optionText = typeof option === 'string' ? option : option.text
                                return (
                                  <div key={optionId} className="flex gap-2">
                                    <input
                                      type="text"
                                      value={optionText}
                                      onChange={(e) => handleUpdateOption(question.id, optionId, e.target.value)}
                                      placeholder="선택지 내용"
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <button
                                      onClick={() => handleRemoveOption(question.id, optionId)}
                                      disabled={question.options && question.options.length <= 2}
                                      className="px-3 py-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                )
                              })}
                              <button
                                onClick={() => handleAddOption(question.id)}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                + 선택지 추가
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium mb-2">
                          {question.body || '(문항 내용 없음)'}
                        </div>
                        <div className="text-sm text-gray-500">
                          유형: {question.type === 'single' ? '단일 선택' : question.type === 'multiple' ? '다중 선택' : '텍스트'}
                        </div>
                        {question.options && (
                          <div className="mt-2 text-sm text-gray-600">
                            선택지: {Array.isArray(question.options) 
                              ? question.options.map((opt: any) => typeof opt === 'string' ? opt : opt.text).join(', ')
                              : '없음'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* 개인정보 동의 설정 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">개인정보 동의 설정</h3>
            <div className="space-y-4">
              {consentFields.map((consent, index) => (
                <div key={consent.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      {consent.title}
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent.enabled}
                          onChange={(e) =>
                            setConsentFields((prev) =>
                              prev.map((c) =>
                                c.id === consent.id ? { ...c, enabled: e.target.checked } : c
                              )
                            )
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm">사용</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent.required}
                          onChange={(e) =>
                            setConsentFields((prev) =>
                              prev.map((c) =>
                                c.id === consent.id ? { ...c, required: e.target.checked } : c
                              )
                            )
                          }
                          disabled={!consent.enabled}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">필수</span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={consent.title}
                    onChange={(e) =>
                      setConsentFields((prev) =>
                        prev.map((c) =>
                          c.id === consent.id ? { ...c, title: e.target.value } : c
                        )
                      )
                    }
                    disabled={!consent.enabled}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2 disabled:bg-gray-100"
                    placeholder="동의 항목 제목"
                  />
                  <textarea
                    value={consent.content}
                    onChange={(e) =>
                      setConsentFields((prev) =>
                        prev.map((c) =>
                          c.id === consent.id ? { ...c, content: e.target.value } : c
                        )
                      )
                    }
                    disabled={!consent.enabled}
                    rows={4}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                    placeholder="동의 내용"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">{form.title}</h3>
            {form.description && (
              <p className="text-gray-600 mb-4">{form.description}</p>
            )}
          </div>
          
          <div>
            <h4 className="font-medium mb-3">문항 목록</h4>
            <div className="space-y-4">
              {form.questions && form.questions.length > 0 ? (
                form.questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-medium mb-2">
                      {index + 1}. {question.body}
                    </div>
                    <div className="text-sm text-gray-500">
                      유형: {question.type === 'single' ? '단일 선택' : question.type === 'multiple' ? '다중 선택' : '텍스트'}
                    </div>
                    {question.options && (
                      <div className="mt-2 text-sm text-gray-600">
                        선택지: {Array.isArray(question.options) 
                          ? question.options.map((opt: any) => typeof opt === 'string' ? opt : opt.text).join(', ')
                          : '없음'}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500">문항이 없습니다</p>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}


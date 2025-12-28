'use client'

import { useState } from 'react'

export default function SurveyTestPage() {
  // 헤더 이미지 URL (Supabase Storage)
  const headerImageUrl = 'https://yqsayphssjznthrxpgfb.supabase.co/storage/v1/object/public/webinar-thumbnails/hpe-booth-header.jpg'

  const [openSection, setOpenSection] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    phone1: '010',
    phone2: '',
    phone3: '',
    q1: '',
    q2: '',
    q3: '',
    consent1: false,
    consent2: false,
    consent3: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePhoneChange = (part: 'phone1' | 'phone2' | 'phone3', value: string) => {
    // 숫자만 입력 허용
    const numericValue = value.replace(/[^0-9]/g, '')
    if (part === 'phone2' || part === 'phone3') {
      if (numericValue.length <= 4) {
        setFormData(prev => ({ ...prev, [part]: numericValue }))
      }
    } else {
      setFormData(prev => ({ ...prev, [part]: numericValue }))
    }
  }

  const validateForm = () => {
    if (!formData.company.trim()) {
      setError('회사명을 입력해주세요.')
      return false
    }
    if (!formData.name.trim()) {
      setError('이름을 입력해주세요.')
      return false
    }
    if (!formData.phone2 || !formData.phone3) {
      setError('휴대전화번호를 모두 입력해주세요.')
      return false
    }
    if (!formData.q1) {
      setError('질문 1에 답변해주세요.')
      return false
    }
    if (!formData.q2) {
      setError('질문 2에 답변해주세요.')
      return false
    }
    if (!formData.q3) {
      setError('질문 3에 답변해주세요.')
      return false
    }
    if (!formData.consent1 || !formData.consent2 || !formData.consent3) {
      setError('모든 개인정보 수집동의에 체크해주세요.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      // 테스트용: 로컬 스토리지에 저장
      const submissionData = {
        ...formData,
        phone: `${formData.phone1}-${formData.phone2}-${formData.phone3}`,
        submittedAt: new Date().toISOString(),
      }

      // 로컬 스토리지에 저장
      const existingSubmissions = JSON.parse(
        localStorage.getItem('survey_submissions') || '[]'
      )
      existingSubmissions.push(submissionData)
      localStorage.setItem('survey_submissions', JSON.stringify(existingSubmissions))

      // 성공 메시지 표시
      setSubmitted(true)
      
      // 3초 후 초기화 (선택사항)
      setTimeout(() => {
        // setSubmitted(false)
        // setFormData({
        //   company: '',
        //   name: '',
        //   phone1: '010',
        //   phone2: '',
        //   phone3: '',
        //   q1: '',
        //   q2: '',
        //   q3: '',
        //   consent1: false,
        //   consent2: false,
        //   consent3: false,
        // })
      }, 3000)
    } catch (err: any) {
      setError(err.message || '제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900 flex items-center justify-center">
        <div className="max-w-[640px] mx-auto px-5 text-center">
          <div className="bg-[#00B388] text-white p-8 rounded-lg shadow-lg">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-3xl font-bold mb-4">설문 제출 완료!</h2>
            <p className="text-lg mb-6">
              설문 완료 화면을 부스 스태프에게 보여주시면<br />
              경품 이벤트에 참여하실 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => {
              setSubmitted(false)
              setFormData({
                company: '',
                name: '',
                phone1: '010',
                phone2: '',
                phone3: '',
                q1: '',
                q2: '',
                q3: '',
                consent1: false,
                consent2: false,
                consent3: false,
              })
            }}
            className="mt-6 text-[#00B388] font-bold hover:underline"
          >
            다시 제출하기
          </button>
        </div>
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
              alt="HPE 부스 이벤트"
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
            <h2 className="text-[#00B388] text-xl font-bold mb-6">참여 방법</h2>
            <div className="space-y-4 text-base font-medium leading-relaxed">
              <p>
                <strong>하나.</strong> 부스 스태프로부터 메시지 카드를 받는다. HPE Networking에 바라는 점, 기대하는 변화, 또는 응원의 메시지를 자유롭게 작성한다.
              </p>
              <p>
                <strong>둘.</strong> 모든 설문 문항에 응답한다. (문항 단 3개!)
              </p>
              <p>
                <strong>셋.</strong> 설문 완료 화면을 부스 스태프에게 보여주고 사은품을 받는다. (이때에 메시지 카드도 같이 제출해 주세요!)
              </p>
            </div>
            <p className="text-[#00B388] text-right mt-6 text-xs font-bold">
              * 모든 사항은 필수 입력칸입니다.
            </p>
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
              <div>
                <label className="block text-base font-bold mb-2">회사명 *</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                className="w-full border-b-2 border-gray-200 py-2 focus:border-[#00B388] outline-none transition-colors bg-white text-gray-900"
                required
              />
            </div>
              <div>
                <label className="block text-base font-bold mb-2">이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full border-b-2 border-gray-200 py-2 focus:border-[#00B388] outline-none transition-colors bg-white text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-bold mb-2">휴대전화번호 *</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={formData.phone1}
                    onChange={(e) => handlePhoneChange('phone1', e.target.value)}
                    readOnly
                    className="w-1/3 border-b-2 border-gray-200 py-2 text-center bg-gray-50 outline-none text-gray-900"
                  />
                  <input
                    type="text"
                    value={formData.phone2}
                    onChange={(e) => handlePhoneChange('phone2', e.target.value)}
                    maxLength={4}
                    className="w-1/3 border-b-2 border-gray-200 py-2 text-center focus:border-[#00B388] outline-none bg-white text-gray-900"
                    required
                  />
                  <input
                    type="text"
                    value={formData.phone3}
                    onChange={(e) => handlePhoneChange('phone3', e.target.value)}
                    maxLength={4}
                    className="w-1/3 border-b-2 border-gray-200 py-2 text-center focus:border-[#00B388] outline-none bg-white text-gray-900"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 설문 문항 */}
            <div className="space-y-6 pt-10">
              {/* Q1 */}
              <div className="space-y-2">
                <h4 className="text-base font-bold leading-tight">
                  1. 현재 데이터센터 네트워크 프로젝트 계획이 있으시다면 언제입니까? *
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    '1주일 이내',
                    '1개월 이내',
                    '1개월 - 3개월',
                    '3개월 - 6개월',
                    '6개월 - 12개월',
                    '1년 이후',
                    '계획없음',
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 rounded"
                    >
                      <input
                        type="radio"
                        name="q1"
                        value={option}
                        checked={formData.q1 === option}
                        onChange={(e) => handleInputChange('q1', e.target.value)}
                        className="w-5 h-5 accent-[#00B388]"
                        required
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q2 */}
              <div className="space-y-2">
                <h4 className="text-base font-bold leading-tight">
                  2. 데이터센터 외 네트워크 프로젝트 계획이 있으시다면 어떤 것입니까? *
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    '유무선 캠퍼스 & 브랜치 네트워크',
                    '엔터프라이즈 라우팅 (SD-WAN 포함)',
                    '네트워크 보안',
                    '해당 없음',
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 rounded"
                    >
                      <input
                        type="radio"
                        name="q2"
                        value={option}
                        checked={formData.q2 === option}
                        onChange={(e) => handleInputChange('q2', e.target.value)}
                        className="w-5 h-5 accent-[#00B388]"
                        required
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Q3 */}
              <div className="space-y-2">
                <h4 className="text-base font-bold leading-tight">
                  3. HPE의 데이터센터 네트워크 솔루션에 대해 보다 더 자세한 내용을 들어 보실 의향이 있으십니까? *
                </h4>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    'HPE 네트워크 전문가의 방문 요청',
                    'HPE 네트워크 전문가의 온라인 미팅 요청',
                    'HPE 네트워크 전문가의 전화 상담 요청',
                    '관심 없음',
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-1 rounded"
                    >
                      <input
                        type="radio"
                        name="q3"
                        value={option}
                        checked={formData.q3 === option}
                        onChange={(e) => handleInputChange('q3', e.target.value)}
                        className="w-5 h-5 accent-[#00B388]"
                        required
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 개인정보 수집동의 (아코디언) */}
            <div className="space-y-4 pt-10">
              <h3 className="text-lg font-bold mb-4 text-gray-800">개인정보 수집동의</h3>
            {[
              {
                id: 1,
                title: '개인정보 공유 동의',
                content:
                  'HPE (은)가 귀하의 개인정보를 수집ㆍ이용하는 목적은 다음과 같습니다 제품과 서비스에 대해 귀하와의 연락, 고객 서비스 증진, 제품 및 서비스에 대한 정보 제공 및 판매, 새로운 서비스와 혜택에 대한 업데이트, 개별 프로모션 제안, 제품 및 서비스에 대한 시장 조사\n\n수집하려는 개인정보의 항목: 이름 회사명 휴대전화번호\n\n개인정보의 보유 및 이용 기간: 처리 목적 달성시까지\n\n개인정보를 공유받는 자의 개인정보 보유 및 이용 기간: 개인정보 수집 및 이용 목적 달성 시까지 보관합니다.\n\n동의를 거부할 권리 및 동의 거부에 따른 불이익: 귀하는 위2항의 선택정보 개인정보의 수집ㆍ이용에 대한 동의를 거부할 수 있으며, 동의를 거부한 경우에는 HPE (은)는 귀하에게 그와 관련된 정보나 혜택은 제공하지 않게 됩니다.\n\n촬영 동의\n본인은 HPE Discover More AI Seoul 2026 행사 중 촬영되는 사진·영상이 HPE 홍보 목적으로 활용될 수 있음에 동의합니다. (활용기간: 목적 달성 시)\n\n기념품 수령 정책 동의\n본인은 소속 기관의 기념품·금품 수령 관련 규정을 이해하며, 이를 준수하는 책임이 본인에게 있음을 확인합니다. HPE는 이에 대한 책임이 없음을 확인합니다.',
              },
              {
                id: 2,
                title: '개인정보 취급위탁 동의',
                content:
                  'HPE (은)는 다음과 같은 마케팅과 커뮤니케이션 등의 목적으로 HPE (은)(을)를 보조하는 서비스 제공자와 공급자에게 개인정보 취급을 위탁할 수 있습니다.\n\n수탁자: ㈜언택트온\n\n위탁하는 업무의 내용: 세미나/이벤트 등 마케팅 프로모션 참석 및 등록 확인, 세미나/이벤트 설문지 키인 작업 및 통계 분석, 기프트 제공',
              },
              {
                id: 3,
                title: '전화, 이메일, SMS 수신 동의',
                content:
                  'HPE (은)는 제품 및 서비스, 프로모션 또는 시장조사 등의 유용한 정보를 온·오프라인을 통해 안내 드리고자 합니다.\n\n기프트 제공 또는 기프티콘 발송을 위하여 전화 연락 또는 SMS 발송을 드릴 수 있습니다.',
              },
              ].map((section) => (
                <div key={section.id} className="border border-gray-200 rounded overflow-hidden">
                  <div
                    className="bg-gray-600 text-white p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700 transition-colors"
                    onClick={() =>
                      setOpenSection(openSection === section.id ? null : section.id)
                    }
                  >
                    <span className="font-bold text-base">{section.title}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            section.id === 1
                              ? formData.consent1
                              : section.id === 2
                              ? formData.consent2
                              : formData.consent3
                          }
                          onChange={(e) => {
                            if (section.id === 1) {
                              handleInputChange('consent1', e.target.checked)
                            } else if (section.id === 2) {
                              handleInputChange('consent2', e.target.checked)
                            } else {
                              handleInputChange('consent3', e.target.checked)
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 accent-[#00B388]"
                          required
                        />
                        <span className="text-xs">동의</span>
                      </label>
                      <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-xs">
                          {openSection === section.id ? '−' : '+'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {openSection === section.id && (
                    <div className="p-4 text-xs text-gray-600 bg-gray-50 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line">
                      {section.content}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 제출 버튼 */}
            <div className="pt-10">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#00B388] text-white py-4 rounded-md text-lg font-bold shadow-lg hover:bg-[#008f6d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
              <p className="mt-6 text-center text-gray-800 font-bold leading-tight text-sm">
                설문 완료 화면을 부스 스태프에게 보여주시면 경품 이벤트에 참여하실 수 있습니다.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}





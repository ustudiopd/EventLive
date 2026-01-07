'use client'

import { useState, useEffect } from 'react'

interface AnalysisGuidelineTabProps {
  campaignId: string
}

interface Guideline {
  id: string
  status: 'draft' | 'published' | 'archived'
  version_int: number
  title: string | null
  description: string | null
  form_fingerprint: string
  created_at: string
  updated_at: string
  published_at: string | null
}

export default function AnalysisGuidelineTab({ campaignId }: AnalysisGuidelineTabProps) {
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0) // 초시계 카운터 (초 단위)
  const [selectedGuideline, setSelectedGuideline] = useState<Guideline | null>(null)
  const [guidelineDetail, setGuidelineDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    loadGuidelines()
  }, [campaignId])

  // 초시계 카운터 (generating이 true일 때만 작동)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (generating) {
      setElapsedTime(0) // 시작 시 0으로 초기화
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000) // 1초마다 증가
    } else {
      if (interval) {
        clearInterval(interval)
      }
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [generating])

  // 초를 분:초 형식으로 변환
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const loadGuidelines = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/analysis-guidelines`)
      const result = await response.json()

      if (result.success && result.guidelines) {
        setGuidelines(result.guidelines)
      }
    } catch (error) {
      console.error('Guideline 목록 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateGuideline = async () => {
    if (!confirm('새로운 분석 지침을 생성하시겠습니까?')) {
      return
    }

    setGenerating(true)
    try {
      const response = await fetch(
        `/api/event-survey/campaigns/${campaignId}/analysis-guidelines/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'fresh' }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || '지침 생성 실패'
        const errorDetails = result.details ? `\n\n${result.details}` : ''
        
        // NO_FORM 에러는 더 친절한 메시지 표시
        if (result.code === 'NO_FORM') {
          alert(`${errorMessage}${errorDetails}\n\n"폼" 탭으로 이동하여 폼을 먼저 생성해주세요.`)
          return
        }
        
        const errorCode = result.code ? `\n\n에러 코드: ${result.code}` : ''
        throw new Error(`${errorMessage}${errorDetails}${errorCode}`)
      }

      alert('분석 지침이 성공적으로 생성되었습니다!')
      await loadGuidelines()
      
      // 생성된 지침 선택
      if (result.guideline) {
        await handleSelectGuideline(result.guideline.id)
      }
    } catch (error: any) {
      console.error('지침 생성 오류:', error)
      alert(`지침 생성 실패: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectGuideline = async (guidelineId: string) => {
    setLoadingDetail(true)
    setSelectedGuideline(guidelines.find((g) => g.id === guidelineId) || null)
    
    try {
      const response = await fetch(
        `/api/event-survey/campaigns/${campaignId}/analysis-guidelines/${guidelineId}`
      )
      const result = await response.json()

      if (result.success && result.guideline) {
        setGuidelineDetail(result.guideline)
      }
    } catch (error) {
      console.error('Guideline 상세 로드 오류:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handlePublish = async (guidelineId: string) => {
    if (!confirm('이 지침을 Published 상태로 변경하시겠습니까? 기존 Published 지침은 Archived 됩니다.')) {
      return
    }

    try {
      const response = await fetch(
        `/api/event-survey/campaigns/${campaignId}/analysis-guidelines/${guidelineId}/publish`,
        {
          method: 'POST',
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Publish 실패')
      }

      alert('지침이 성공적으로 Published 되었습니다!')
      await loadGuidelines()
      
      // 업데이트된 지침 다시 선택
      if (selectedGuideline?.id === guidelineId) {
        await handleSelectGuideline(guidelineId)
      }
    } catch (error: any) {
      console.error('Publish 오류:', error)
      alert(`Publish 실패: ${error.message}`)
    }
  }

  const publishedGuideline = guidelines.find((g) => g.status === 'published')
  const draftGuidelines = guidelines.filter((g) => g.status === 'draft')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">분석 지침 관리</h2>
          <p className="text-sm text-gray-600 mt-1">
            AI 분석 보고서 생성을 위한 구조화된 지침을 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          {generating && (
            <div className="text-sm text-gray-600 font-mono">
              ⏱️ {formatTime(elapsedTime)}
            </div>
          )}
          <button
            onClick={handleGenerateGuideline}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? '생성 중...' : '새 지침 생성'}
          </button>
        </div>
      </div>

      {/* Published Guideline */}
      {publishedGuideline && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded">
                  PUBLISHED
                </span>
                <h3 className="text-lg font-semibold text-gray-900">
                  {publishedGuideline.title || 'Untitled Guideline'}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                버전 {publishedGuideline.version_int} ·{' '}
                {publishedGuideline.published_at
                  ? new Date(publishedGuideline.published_at).toLocaleString('ko-KR')
                  : 'N/A'}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/event-survey/campaigns/${campaignId}/analysis-guidelines/${publishedGuideline.id}/download.md`}
                download
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm inline-flex items-center gap-1"
              >
                <span>📥</span>
                <span>다운로드</span>
              </a>
              <button
                onClick={() => handleSelectGuideline(publishedGuideline.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                상세 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Guidelines */}
      {draftGuidelines.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Draft 지침</h3>
          <div className="space-y-3">
            {draftGuidelines.map((guideline) => (
              <div
                key={guideline.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded">
                        DRAFT
                      </span>
                      <h4 className="text-md font-semibold text-gray-900">
                        {guideline.title || 'Untitled Guideline'}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      버전 {guideline.version_int} ·{' '}
                      {new Date(guideline.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/api/event-survey/campaigns/${campaignId}/analysis-guidelines/${guideline.id}/download.md`}
                      download
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm inline-flex items-center gap-1"
                    >
                      <span>📥</span>
                      <span>다운로드</span>
                    </a>
                    <button
                      onClick={() => handleSelectGuideline(guideline.id)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      상세 보기
                    </button>
                    <button
                      onClick={() => handlePublish(guideline.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Publish
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guideline 상세 */}
      {selectedGuideline && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              {selectedGuideline.title || 'Guideline 상세'}
            </h3>
            <button
              onClick={() => {
                setSelectedGuideline(null)
                setGuidelineDetail(null)
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {loadingDetail ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : guidelineDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-700">상태:</span>
                  <span
                    className={`ml-2 px-2 py-1 text-xs font-semibold rounded ${
                      guidelineDetail.status === 'published'
                        ? 'bg-green-600 text-white'
                        : guidelineDetail.status === 'draft'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-500 text-white'
                    }`}
                  >
                    {guidelineDetail.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">버전:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {guidelineDetail.version_int}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">생성일:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {new Date(guidelineDetail.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                {guidelineDetail.published_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Published:</span>
                    <span className="ml-2 text-sm text-gray-900">
                      {new Date(guidelineDetail.published_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                )}
              </div>

              {guidelineDetail.description && (
                <div>
                  <span className="text-sm font-medium text-gray-700">설명:</span>
                  <p className="mt-1 text-sm text-gray-900">{guidelineDetail.description}</p>
                </div>
              )}

              {guidelineDetail.guideline_pack && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Guideline Pack 구조</h4>
                  <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs text-gray-700">
                      {JSON.stringify(guidelineDetail.guideline_pack, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <a
                  href={`/api/event-survey/campaigns/${campaignId}/analysis-guidelines/${guidelineDetail.id}/download.md`}
                  download
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                >
                  <span>📥</span>
                  <span>다운로드 (MD)</span>
                </a>
                {guidelineDetail.status === 'draft' && (
                  <button
                    onClick={() => handlePublish(guidelineDetail.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Publish
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">상세 정보를 불러올 수 없습니다</div>
          )}
        </div>
      )}

      {!loading && guidelines.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">아직 생성된 분석 지침이 없습니다</p>
          <div className="flex flex-col items-center gap-3">
            {generating && (
              <div className="text-sm text-gray-600 font-mono">
                ⏱️ {formatTime(elapsedTime)}
              </div>
            )}
            <button
              onClick={handleGenerateGuideline}
              disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? '생성 중...' : '첫 지침 생성하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

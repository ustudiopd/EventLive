'use client'

import { useState, useEffect } from 'react'

interface WebinarEditModalProps {
  webinar: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function WebinarEditModal({
  webinar,
  isOpen,
  onClose,
  onSuccess
}: WebinarEditModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    startTime: '',
    endTime: '',
    maxParticipants: '',
    isPublic: false,
    accessPolicy: 'auth' as 'auth' | 'guest_allowed' | 'invite_only' | 'email_auth',
    allowedEmails: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (webinar && isOpen) {
      // UTC 시간을 로컬 시간으로 변환하여 datetime-local 형식으로 표시
      const formatDateTime = (dateString: string | null) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        // 로컬 시간대로 변환
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
      }

      // 허용된 이메일 목록 로드
      const loadAllowedEmails = async () => {
        if (webinar.access_policy === 'email_auth') {
          try {
            const response = await fetch(`/api/webinars/${webinar.id}/allowed-emails`)
            if (response.ok) {
              const { emails } = await response.json()
              return emails || []
            }
          } catch (error) {
            console.error('허용된 이메일 로드 오류:', error)
          }
        }
        return []
      }
      
      const initializeFormData = async () => {
        const emails = await loadAllowedEmails()
      setFormData({
        title: webinar.title || '',
        description: webinar.description || '',
        youtubeUrl: webinar.youtube_url || '',
        startTime: formatDateTime(webinar.start_time),
        endTime: formatDateTime(webinar.end_time),
        maxParticipants: webinar.max_participants ? String(webinar.max_participants) : '',
        isPublic: webinar.is_public || false,
        accessPolicy: webinar.access_policy || 'auth',
          allowedEmails: emails,
      })
      }
      
      initializeFormData()
    }
  }, [webinar, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // datetime-local 입력값을 UTC ISO 문자열로 변환
      const convertToUTC = (localDateTime: string) => {
        if (!localDateTime) return null
        // datetime-local 형식 (YYYY-MM-DDTHH:mm)을 Date 객체로 변환
        // 이때 브라우저는 로컬 시간대로 해석함
        const localDate = new Date(localDateTime)
        // UTC ISO 문자열로 변환
        return localDate.toISOString()
      }

      const requestBody = {
        title: formData.title,
        description: formData.description || null,
        youtubeUrl: formData.youtubeUrl,
        startTime: convertToUTC(formData.startTime),
        endTime: convertToUTC(formData.endTime),
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
        isPublic: formData.isPublic,
        accessPolicy: formData.accessPolicy,
        allowedEmails: formData.accessPolicy === 'email_auth' ? formData.allowedEmails : undefined,
      }

      const response = await fetch(`/api/webinars/${webinar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `서버 오류 (${response.status})`)
      }

      if (result.error) {
        throw new Error(result.error)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('웨비나 수정 오류:', err)
      setError(err.message || '웨비나 수정 중 오류가 발생했습니다')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              웨비나 수정
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                웨비나 제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="웨비나 제목을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="웨비나에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL *
              </label>
              <input
                type="url"
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작 시간
                </label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종료 시간
                </label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최대 참여자 수
              </label>
              <input
                type="number"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="제한 없음"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                접근 정책
              </label>
              <select
                value={formData.accessPolicy}
                onChange={(e) => setFormData({ ...formData, accessPolicy: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="auth">인증 필요 (로그인 필수)</option>
                <option value="email_auth">인증필요 (이메일)</option>
                <option value="guest_allowed">게스트 허용</option>
                <option value="invite_only">초대 전용</option>
              </select>
              {formData.accessPolicy === 'email_auth' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      등록된 이메일 목록 (한 줄에 하나씩)
                    </label>
                    <textarea
                      value={formData.allowedEmails.join('\n')}
                      onChange={(e) => {
                        const emails = e.target.value.split('\n').map(email => email.trim()).filter(email => email)
                        setFormData({ ...formData, allowedEmails: emails })
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                      rows={6}
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      등록된 이메일 주소만 이 웨비나에 입장할 수 있습니다.
                    </p>
                  </div>
                  
                  {/* 등록된 이메일별 접속 링크 */}
                  {formData.allowedEmails.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        등록된 이메일별 접속 링크
                      </label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {formData.allowedEmails.map((email, index) => {
                          const accessLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://must.ai.kr'}/webinar/${webinar.id}?email=${encodeURIComponent(email)}`
                          return (
                            <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-600 mb-1">{email}</div>
                                <div className="text-xs text-blue-600 break-all">{accessLink}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(accessLink)
                                  alert('접속 링크가 클립보드에 복사되었습니다.')
                                }}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                              >
                                복사
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPublic"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                공개 웨비나 (검색 가능)
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                {loading ? '수정 중...' : '수정하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


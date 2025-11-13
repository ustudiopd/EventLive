'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function NewWebinarPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params?.clientId as string
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    startTime: '',
    endTime: '',
    maxParticipants: '',
    isPublic: false,
    accessPolicy: 'auth' as 'auth' | 'guest_allowed' | 'invite_only',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    if (!clientId) {
      setError('클라이언트 ID가 없습니다.')
      setLoading(false)
      return
    }
    
    try {
      const requestBody = {
        clientId,
        title: formData.title,
        description: formData.description || null,
        youtubeUrl: formData.youtubeUrl,
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
        isPublic: formData.isPublic,
        accessPolicy: formData.accessPolicy,
      }
      
      console.log('웨비나 생성 요청:', requestBody)
      
      const response = await fetch('/api/webinars/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      console.log('응답 상태:', response.status, response.statusText)
      
      let result
      try {
        result = await response.json()
        console.log('응답 데이터:', result)
      } catch (jsonError) {
        console.error('JSON 파싱 오류:', jsonError)
        throw new Error('서버 응답을 파싱할 수 없습니다.')
      }
      
      if (!response.ok) {
        throw new Error(result.error || `서버 오류 (${response.status})`)
      }
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      // 성공 시 웨비나 목록 페이지로 이동
      alert('웨비나가 성공적으로 생성되었습니다!')
      router.push(`/client/${clientId}/webinars`)
      router.refresh()
    } catch (err: any) {
      console.error('웨비나 생성 오류:', err)
      const errorMessage = err.message || '웨비나 생성 중 오류가 발생했습니다'
      setError(errorMessage)
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            href={`/client/${clientId}/dashboard`}
            className="text-blue-600 hover:text-blue-700 hover:underline mb-4 inline-block"
          >
            ← 대시보드로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            웨비나 생성
          </h1>
          <p className="text-gray-600">새로운 웨비나를 생성하세요</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                웨비나 제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="웨비나에 대한 설명을 입력하세요"
                rows={4}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                YouTube 라이브 스트림 또는 동영상 URL을 입력하세요
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작 시간
                </label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="auth">인증 필요 (로그인 필수)</option>
                <option value="guest_allowed">게스트 허용</option>
                <option value="invite_only">초대 전용</option>
              </select>
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
              <Link
                href={`/client/${clientId}/dashboard`}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                {loading ? '생성 중...' : '웨비나 생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


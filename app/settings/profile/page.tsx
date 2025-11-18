'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const supabase = createClientSupabase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [profile, setProfile] = useState<{
    id: string
    display_name: string | null
    email: string | null
  } | null>(null)
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 프로필 정보 조회
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('프로필 조회 오류:', profileError)
        setError('프로필 정보를 불러올 수 없습니다')
        return
      }

      const profile = profileData as { id: string; display_name: string | null; email: string | null } | null
      setProfile(profile)
      setDisplayName(profile?.display_name || '')
    } catch (err: any) {
      console.error('프로필 로드 오류:', err)
      setError('프로필 정보를 불러오는 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '프로필 업데이트 실패')
      }

      setSuccess(true)
      setProfile(result.profile)
      
      // 2초 후 성공 메시지 숨김
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      console.error('프로필 업데이트 오류:', err)
      setError(err.message || '프로필 업데이트 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            계정 설정
          </h1>
          <p className="text-gray-600">프로필 정보를 수정하세요</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
              프로필이 성공적으로 업데이트되었습니다!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-gray-500">
                이메일은 변경할 수 없습니다
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름 (닉네임) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="이름 또는 닉네임을 입력하세요"
                required
                maxLength={100}
                disabled={saving}
              />
              <p className="mt-1 text-sm text-gray-500">
                채팅 및 대시보드에 표시될 이름입니다
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {saving ? '저장 중...' : '저장하기'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


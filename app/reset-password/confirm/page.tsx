'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordConfirmPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClientSupabase()
  
  useEffect(() => {
    // URL에서 토큰 확인
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')
    
    if (accessToken && type === 'recovery') {
      setIsValidToken(true)
    } else {
      setIsValidToken(false)
    }
  }, [])
  
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // 입력 검증
    if (!password || !confirmPassword) {
      setError('비밀번호를 모두 입력해주세요')
      return
    }
    
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      return
    }
    
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    
    setLoading(true)
    
    try {
      // URL에서 토큰 추출
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      
      if (!accessToken) {
        throw new Error('유효하지 않은 재설정 링크입니다')
      }
      
      // 세션 설정 (토큰으로)
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      })
      
      if (sessionError) {
        throw new Error(sessionError.message || '세션 설정에 실패했습니다')
      }
      
      // 비밀번호 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })
      
      if (updateError) {
        throw new Error(updateError.message || '비밀번호 변경에 실패했습니다')
      }
      
      setSuccess(true)
      
      // 2초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  if (isValidToken === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
          <div className="text-center">
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (isValidToken === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-red-600">유효하지 않은 링크</h1>
            <p className="text-gray-600">비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다</p>
          </div>
          <div className="space-y-4">
            <Link
              href="/reset-password"
              className="block w-full text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              비밀번호 재설정 다시 요청하기
            </Link>
            <Link
              href="/login"
              className="block w-full text-center text-gray-600 hover:text-gray-700 hover:underline transition-colors"
            >
              로그인 페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-green-600">비밀번호 변경 완료</h1>
            <p className="text-gray-600">비밀번호가 성공적으로 변경되었습니다</p>
            <p className="text-sm text-gray-500 mt-2">로그인 페이지로 이동합니다...</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            새 비밀번호 설정
          </h1>
          <p className="text-gray-600">새로운 비밀번호를 입력해주세요</p>
        </div>
        
        <form onSubmit={handleResetPassword} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">새 비밀번호 <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="최소 6자 이상"
              required
              disabled={loading}
              minLength={6}
            />
            <p className="mt-1 text-xs text-gray-500">비밀번호는 최소 6자 이상이어야 합니다</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인 <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="비밀번호를 다시 입력하세요"
              required
              disabled={loading}
              minLength={6}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-700 hover:underline transition-colors">
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}




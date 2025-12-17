'use client'

import { useState } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClientSupabase()
  
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    
    if (!email || !email.trim()) {
      setError('이메일을 입력해주세요')
      return
    }
    
    setLoading(true)
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const redirectTo = `${baseUrl}/reset-password/confirm`
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      
      if (resetError) {
        throw new Error(resetError.message)
      }
      
      setSuccess(true)
      setEmail('')
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정 요청 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            비밀번호 재설정
          </h1>
          <p className="text-gray-600">이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다</p>
        </div>
        
        {success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                <strong>이메일을 확인해주세요</strong><br />
                비밀번호 재설정 링크를 <strong>{email}</strong>로 발송했습니다.<br />
                이메일의 링크를 클릭하여 새 비밀번호를 설정하세요.
              </p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              로그인 페이지로 이동
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="your@email.com"
                required
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? '전송 중...' : '비밀번호 재설정 링크 보내기'}
            </button>
          </form>
        )}
        
        <div className="mt-6 text-center space-y-2">
          <Link href="/login" className="block text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            로그인 페이지로 돌아가기
          </Link>
          <Link href="/signup" className="block text-sm text-gray-600 hover:text-gray-700 hover:underline transition-colors">
            계정이 없으신가요? 회원가입
          </Link>
        </div>
      </div>
    </div>
  )
}




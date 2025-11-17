'use client'

import { useState } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientSupabase()
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // "admin"을 이메일로 사용하는 경우 처리
    // Supabase Auth는 이메일 형식을 요구하므로, "admin"을 "admin@eventlive.ai"로 변환
    const loginEmail = email === 'admin' ? 'admin@eventlive.ai' : email
    
    const { error, data } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })
    
    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }
    
    // 사용자 역할에 따라 적절한 대시보드로 리다이렉트
    if (data.user) {
      // 세션이 완전히 설정될 때까지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500))
      
      try {
        // API를 통해 대시보드 경로 가져오기 (서버 사이드에서 RLS 정책 적용)
        const response = await fetch('/api/auth/dashboard')
        const { dashboard } = await response.json()
        
        if (dashboard) {
          router.push(dashboard)
          router.refresh()
          return
        }
      } catch (err) {
        console.error('대시보드 리다이렉트 오류:', err)
      }
    }
    
    // 대시보드가 없으면 홈으로 (홈페이지에서 다시 확인)
    router.push('/')
    router.refresh()
    setLoading(false)
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            로그인
          </h1>
          <p className="text-gray-600">EventLive.ai에 오신 것을 환영합니다</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="admin 또는 your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/signup" className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            계정이 없으신가요? 회원가입
          </a>
        </div>
      </div>
    </div>
  )
}


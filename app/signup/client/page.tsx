'use client'

import { useState, Suspense } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ClientSignupForm() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('token')
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    clientName: '',
    displayName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClientSupabase()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    if (!inviteToken) {
      setError('에이전시 초대 링크가 필요합니다')
      setLoading(false)
      return
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      setLoading(false)
      return
    }
    
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      setLoading(false)
      return
    }
    
    try {
      // 1. 사용자 계정 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            display_name: formData.displayName,
            role: 'client',
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      })
      
      if (authError) throw authError
      if (!authData.user) throw new Error('사용자 생성 실패')
      
      // 2. 프로필 생성/업데이트 (트리거로 자동 생성되지만 확인 필요)
      // 프로필이 생성될 때까지 최대 5초 대기
      let profileExists = false
      for (let i = 0; i < 50; i++) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authData.user.id)
          .maybeSingle()
        
        if (existingProfile) {
          profileExists = true
          break
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (!profileExists) {
        throw new Error('프로필 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      
      // 프로필 업데이트
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: formData.displayName,
          email: formData.email,
        })
        .eq('id', authData.user.id)
      
      if (profileError) {
        console.warn('프로필 업데이트 실패:', profileError)
        // 프로필 업데이트 실패해도 계속 진행 (이미 생성되어 있을 수 있음)
      }
      
      // 3. 클라이언트 생성 (초대 토큰 사용)
      // 이메일 확인 여부와 관계없이 진행 (DB에는 이미 등록되어 있음)
      const response = await fetch('/api/clients/create-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.clientName,
          userId: authData.user.id,
          inviteToken: inviteToken,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '클라이언트 생성 실패')
      }
      
      // 성공 시 안내 메시지
      if (authData.session) {
        // 이메일 확인이 필요 없는 경우 (설정에 따라)
        alert('회원가입이 완료되었습니다!')
        router.push('/')
        router.refresh()
      } else {
        // 이메일 확인이 필요한 경우
        alert('회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화해주세요.')
        router.push('/login')
      }
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            클라이언트 회원가입
          </h1>
          <p className="text-gray-600">클라이언트 계정을 생성하세요</p>
        </div>
        
        {!inviteToken && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 rounded-lg">
            ⚠️ 에이전시로부터 초대 링크가 필요합니다.
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">클라이언트명 *</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="클라이언트 이름을 입력하세요"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름 *</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="이름을 입력하세요"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일 *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인 *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !inviteToken}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link href="/signup" className="text-sm text-green-600 hover:text-green-700 hover:underline transition-colors">
            ← 역할 선택으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ClientSignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <ClientSignupForm />
    </Suspense>
  )
}


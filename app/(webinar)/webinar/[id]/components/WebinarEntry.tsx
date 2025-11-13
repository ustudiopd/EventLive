'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'

interface Webinar {
  id: string
  title: string
  description?: string
  youtube_url: string
  start_time?: string
  end_time?: string
  access_policy: string
  clients?: {
    id: string
    name: string
    logo_url?: string
  }
}

interface WebinarEntryProps {
  webinar: Webinar
}

export default function WebinarEntry({ webinar }: WebinarEntryProps) {
  const router = useRouter()
  const supabase = createClientSupabase()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmailVerification, setShowEmailVerification] = useState(false)
  
  useEffect(() => {
    // URL에서 이메일 인증 확인 파라미터 체크
    const urlParams = new URLSearchParams(window.location.search)
    const type = urlParams.get('type')
    const token = urlParams.get('token')
    
    // 이메일 인증 완료 후 리다이렉트된 경우
    if (type === 'signup' && token) {
      // 세션 확인 및 자동 로그인
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // 프로필이 생성될 때까지 대기
          const checkProfile = async () => {
            for (let i = 0; i < 50; i++) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .maybeSingle()
              
              if (profile) {
                window.location.href = `/webinar/${webinar.id}/live`
                return
              }
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            // 프로필이 없어도 진행 (트리거가 생성할 것)
            window.location.href = `/webinar/${webinar.id}/live`
          }
          checkProfile()
        }
      })
    } else if (urlParams.get('verified') === 'true') {
      // 이메일 인증 완료 안내 모달 표시 후 라이브 페이지로 이동
      setShowEmailVerification(true)
      
      // 세션 확인 및 자동 이동
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setTimeout(() => {
            window.location.href = `/webinar/${webinar.id}/live`
          }, 2000) // 2초 후 자동 이동
        }
      })
    }
    
    // 이미 로그인한 사용자도 입장 페이지에 머물도록 (자동 리다이렉트 제거)
    // 사용자가 직접 로그인 버튼을 눌러야 라이브 페이지로 이동
  }, [webinar.id, router, supabase])
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const { error: loginError, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (loginError) {
        setError(loginError.message)
        setLoading(false)
        return
      }
      
      // 로그인 성공 시 웨비나 라이브 페이지로 이동 (대시보드가 아닌)
      if (data.user) {
        // 세션이 완전히 설정될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 1000))
        // 웨비나 라이브 페이지로 직접 이동 (완전한 페이지 리다이렉트)
        window.location.href = `/webinar/${webinar.id}/live`
      }
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다')
      setLoading(false)
    }
  }
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      return
    }
    
    setLoading(true)
    
    try {
      const { error: signupError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            role: 'participant',
          },
          emailRedirectTo: `${window.location.origin}/webinar/${webinar.id}?verified=true`
        }
      })
      
      if (signupError) {
        setError(signupError.message)
        setLoading(false)
        return
      }
      
      if (data.user) {
        // 프로필 생성 확인 및 업데이트 (트리거로 자동 생성되지만 확인 필요)
        let profileExists = false
        for (let i = 0; i < 50; i++) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle()
          
          if (existingProfile) {
            profileExists = true
            break
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        if (profileExists) {
          // 프로필 업데이트 (display_name, email)
          await supabase
            .from('profiles')
            .update({
              display_name: displayName,
              email: email,
            })
            .eq('id', data.user.id)
        }
        
        // 이메일 인증 안내 모달 표시
        setShowEmailVerification(true)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다')
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 웨비나 정보 카드 */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            {webinar.clients?.logo_url && (
              <img 
                src={webinar.clients.logo_url} 
                alt={webinar.clients.name}
                className="h-16 w-auto mx-auto mb-4"
              />
            )}
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {webinar.title}
            </h1>
            {webinar.description && (
              <p className="text-gray-600 mt-2">{webinar.description}</p>
            )}
            {webinar.start_time && (
              <p className="text-sm text-gray-500 mt-2">
                {new Date(webinar.start_time).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
        </div>
        
        {/* 로그인/회원가입 폼 */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                mode === 'login'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setError('')
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                mode === 'signup'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              회원가입
            </button>
          </div>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="your@email.com"
                  required
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? '로그인 중...' : '웨비나 입장하기'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="이름을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="•••••••• (최소 6자)"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? '가입 중...' : '회원가입하고 입장하기'}
              </button>
            </form>
          )}
        </div>
      </div>
      
      {/* 이메일 인증 확인 안내 모달 */}
      {showEmailVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">이메일 인증이 필요합니다</h2>
              <p className="text-gray-600 mb-6">
                회원가입이 완료되었습니다!<br />
                <strong>{email}</strong>로 전송된 인증 이메일을 확인해주세요.<br />
                이메일 인증을 완료한 후 웨비나에 입장할 수 있습니다.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowEmailVerification(false)
                    setMode('login')
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                >
                  확인
                </button>
                <button
                  onClick={() => {
                    setShowEmailVerification(false)
                  }}
                  className="w-full text-gray-600 py-2 hover:text-gray-800 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


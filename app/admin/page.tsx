'use client'

import { useState } from 'react'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClientSupabase()
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // "admin"을 이메일로 사용하는 경우 처리
      const loginEmail = email === 'admin' ? 'admin@eventlive.ai' : email
      
      const { error: loginError, data } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })
      
      if (loginError) {
        setError(loginError.message)
        setLoading(false)
        return
      }
      
      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 500))
        
        try {
          const response = await fetch('/api/auth/dashboard')
          const result = await response.json()
          
          if (result.dashboard) {
            router.push(result.dashboard)
            router.refresh()
            return
          }
          
          // 대시보드가 없으면 에러 메시지 표시
          if (result.error) {
            setError(result.error)
          } else {
            setError('접근 권한이 없습니다. 관리자에게 문의하세요.')
          }
        } catch (err) {
          console.error('대시보드 리다이렉트 오류:', err)
          setError('대시보드 접근 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        }
      } else {
        setError('로그인에 실패했습니다.')
      }
      
      setLoading(false)
      return
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다')
    } finally {
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
      // 회원가입은 역할 선택 페이지로 이동
      router.push('/signup')
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다')
      setLoading(false)
    }
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center mb-20">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EventLive.ai
          </h1>
        </div>
        
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 왼쪽: EventLive.ai 소개 */}
            <div className="flex flex-col justify-center">
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">플랫폼 소개</h2>
                <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                  Enterprise급 웨비나 플랫폼으로, 실시간 상호작용과 멀티테넌시를 지원하는 
                  B2B2C 솔루션입니다.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎥</div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">실시간 웨비나</h3>
                      <p className="text-sm text-gray-600">
                        YouTube 연동을 통한 고품질 라이브 스트리밍과 실시간 채팅, Q&A 기능
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💬</div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">실시간 상호작용</h3>
                      <p className="text-sm text-gray-600">
                        참여자와의 실시간 채팅, 질문 답변, 참여자 현황 확인 등 다양한 상호작용 기능
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🏢</div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">멀티테넌시</h3>
                      <p className="text-sm text-gray-600">
                        Super Admin → Agency → Client → Participant 계층 구조로 
                        완전한 데이터 격리와 권한 관리
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎨</div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">브랜딩</h3>
                      <p className="text-sm text-gray-600">
                        각 클라이언트별 커스텀 브랜딩과 도메인 설정 지원
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <Link 
                    href="/" 
                    className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium"
                  >
                    ← 메인 페이지로 돌아가기
                  </Link>
                </div>
              </div>
            </div>
            
            {/* 오른쪽: 로그인/회원가입 폼 */}
            <div className="flex flex-col justify-center">
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
                  <div className="font-semibold mb-1">오류</div>
                  <div>{error}</div>
                  {error.includes('권한') && (
                    <div className="mt-2 text-sm text-red-600">
                      💡 관리자 권한이 설정되지 않았거나 JWT 토큰이 만료되었을 수 있습니다. 
                      관리자에게 문의하거나 재로그인을 시도해주세요.
                    </div>
                  )}
                </div>
              )}
              
              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="admin 또는 your@email.com"
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
                    {loading ? '로그인 중...' : '로그인'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-700 mb-6">
                    관리자 계정을 생성하려면 역할을 선택해주세요
                  </p>
                  <div className="space-y-4">
                    <button
                      onClick={() => router.push('/signup/agency')}
                      className="w-full p-4 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 transition-all duration-200 text-left shadow-md hover:shadow-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">🏢</div>
                        <div>
                          <div className="font-semibold text-lg text-gray-800">에이전시</div>
                          <div className="text-sm text-gray-600">여러 클라이언트를 관리하고 웨비나 서비스를 제공합니다</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => router.push('/signup/client')}
                      className="w-full p-4 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 transition-all duration-200 text-left shadow-md hover:shadow-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">👥</div>
                        <div>
                          <div className="font-semibold text-lg text-gray-800">클라이언트</div>
                          <div className="text-sm text-gray-600">웨비나를 생성하고 운영합니다 (에이전시 초대 필요)</div>
                        </div>
                      </div>
                    </button>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      💡 참여자(개인회원)는 웨비나 페이지에서 가입할 수 있습니다
                    </p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}


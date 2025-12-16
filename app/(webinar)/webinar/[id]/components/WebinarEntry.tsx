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
  const [mode, setMode] = useState<'login' | 'signup' | 'guest' | 'email_auth' | 'register'>(
    webinar.access_policy === 'guest_allowed' ? 'guest' : 
    webinar.access_policy === 'email_auth' ? 'email_auth' : 'login'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmailVerification, setShowEmailVerification] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  
  useEffect(() => {
    // URL에서 이메일 인증 확인 파라미터 체크
    const urlParams = new URLSearchParams(window.location.search)
    const type = urlParams.get('type')
    const token = urlParams.get('token')
    
    // 이메일 인증 완료 후 리다이렉트된 경우
    if ((type === 'signup' || type === 'email_auth') && token) {
      // 세션 확인 및 자동 로그인
      supabase.auth.getSession().then(async ({ data: { session } }) => {
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
                // 웨비나 등록 확인 및 등록
                const { data: registration } = await supabase
                  .from('registrations')
                  .select('webinar_id, user_id')
                  .eq('webinar_id', webinar.id)
                  .eq('user_id', session.user.id)
                  .maybeSingle()
                
                if (!registration) {
                  try {
                    await fetch(`/api/webinars/${webinar.id}/register`, {
                      method: 'POST',
                    })
                  } catch (error) {
                    console.error('웨비나 등록 오류:', error)
                  }
                }
                
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
    } else if (urlParams.get('verified') === 'true' || (type === 'email_auth' && urlParams.get('verified') === 'true')) {
      // 이메일 인증 완료 안내 모달 표시 후 라이브 페이지로 이동
      setShowEmailVerification(true)
      
      // 세션 확인 및 자동 이동
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          // 웨비나 등록 확인 및 등록
          const { data: registration } = await supabase
            .from('registrations')
            .select('webinar_id, user_id')
            .eq('webinar_id', webinar.id)
            .eq('user_id', session.user.id)
            .maybeSingle()
          
          if (!registration) {
            try {
              await fetch(`/api/webinars/${webinar.id}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nickname: nickname.trim() || null,
                }),
              })
            } catch (error) {
              console.error('웨비나 등록 오류:', error)
            }
          }
          
          setTimeout(() => {
            window.location.href = `/webinar/${webinar.id}/live`
          }, 2000) // 2초 후 자동 이동
        }
      })
    }
    
    // 이미 로그인한 사용자가 이 웨비나에 등록되어 있는지 확인
    const checkExistingSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: registration } = await supabase
          .from('registrations')
          .select('webinar_id, user_id')
          .eq('webinar_id', webinar.id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        // 등록되어 있으면 자동으로 라이브 페이지로 이동하지 않음
        // 사용자가 직접 입장 버튼을 눌러야 함 (게스트 모드 선택 가능)
      }
    }
    
    checkExistingSession()
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
      
      // 로그인 성공 시 해당 웨비나에 등록되어 있는지 확인
      if (data.user) {
        // 세션이 완전히 설정될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 웨비나 등록 확인
        const { data: registration } = await supabase
          .from('registrations')
          .select('webinar_id, user_id')
          .eq('webinar_id', webinar.id)
          .eq('user_id', data.user.id)
          .maybeSingle()
        
        // 등록되어 있지 않으면 등록 API 호출
        if (!registration) {
          try {
            const registerResponse = await fetch(`/api/webinars/${webinar.id}/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nickname: nickname.trim() || null,
              }),
            })
            
            if (!registerResponse.ok) {
              console.warn('웨비나 자동 등록 실패:', registerResponse.status)
            }
          } catch (registerError) {
            console.error('웨비나 등록 요청 오류:', registerError)
          }
        }
        
        // 웨비나 라이브 페이지로 직접 이동 (완전한 페이지 리다이렉트)
        window.location.href = `/webinar/${webinar.id}/live`
      }
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다')
      setLoading(false)
    }
  }
  
  const handleGuestEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!nickname || !nickname.trim()) {
      setError('닉네임을 입력해주세요')
      return
    }
    
    setLoading(true)
    
    try {
      // 기존 세션이 있으면 먼저 로그아웃 (웨비나별 독립 세션을 위해)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        // 기존 사용자가 이 웨비나에 등록되어 있는지 확인
        const { data: existingRegistration } = await supabase
          .from('registrations')
          .select('webinar_id, user_id')
          .eq('webinar_id', webinar.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()
        
        // 등록되어 있지 않으면 기존 세션 로그아웃 (새 게스트 계정 생성)
        if (!existingRegistration) {
          await supabase.auth.signOut()
        } else {
          // 이미 등록되어 있으면 바로 입장
          window.location.href = `/webinar/${webinar.id}/live`
          return
        }
      }
      
      // 게스트 계정 생성 API 호출
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          webinarId: webinar.id,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '게스트 입장에 실패했습니다')
      }
      
      // 게스트 계정으로 직접 로그인 (서버에서 생성한 이메일/비밀번호 사용)
      if (result.email && result.password) {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.password,
        })
        
        if (signInError) {
          console.error('게스트 로그인 실패:', signInError)
          throw new Error('게스트 로그인에 실패했습니다')
        }
        
        // 로그인 성공 후 세션 확인
        if (signInData.user) {
          // 세션이 설정될 때까지 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // 게스트 계정 생성 및 세션 설정 완료 후 라이브 페이지로 이동
          window.location.href = `/webinar/${webinar.id}/live`
        } else {
          throw new Error('게스트 로그인 후 사용자 정보를 가져올 수 없습니다')
        }
      } else {
        throw new Error('게스트 계정 정보를 받지 못했습니다')
      }
    } catch (err: any) {
      console.error('게스트 입장 오류:', err)
      setError(err.message || '게스트 입장 중 오류가 발생했습니다')
      setLoading(false)
    }
  }
  
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !email.trim()) {
      setError('이메일을 입력해주세요')
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/email-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          nickname: nickname.trim() || null,
          webinarId: webinar.id,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '입장 요청에 실패했습니다')
      }
      
      // 비밀번호로 바로 로그인
      if (result.email && result.password) {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.password,
        })
        
        if (signInError) {
          throw new Error('로그인에 실패했습니다')
        }
        
        // 세션이 설정될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 웨비나 등록 확인 및 등록
        if (signInData.user) {
          const { data: registration } = await supabase
            .from('registrations')
            .select('webinar_id, user_id')
            .eq('webinar_id', webinar.id)
            .eq('user_id', signInData.user.id)
            .maybeSingle()
          
          if (!registration) {
            try {
              await fetch(`/api/webinars/${webinar.id}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nickname: nickname.trim() || null,
                }),
              })
            } catch (registerError) {
              console.error('웨비나 등록 요청 오류:', registerError)
            }
          }
        }
        
        // 웨비나 라이브 페이지로 이동
        window.location.href = `/webinar/${webinar.id}/live`
      } else {
        throw new Error('로그인 정보를 받지 못했습니다')
      }
    } catch (err: any) {
      setError(err.message || '입장 중 오류가 발생했습니다')
      setLoading(false)
    }
  }
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !email.trim()) {
      setError('이메일을 입력해주세요')
      return
    }
    
    if (!displayName || !displayName.trim()) {
      setError('이름을 입력해주세요')
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch(`/api/webinars/${webinar.id}/register-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          nickname: nickname.trim() || null,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '등록 신청에 실패했습니다')
      }
      
      // 성공 메시지 표시
      setError('')
      alert('등록 신청이 완료되었습니다. 이메일 인증을 통해 입장할 수 있습니다.')
      
      // 이메일 인증 모드로 전환
      setMode('email_auth')
      setEmail(email.trim())
      setDisplayName('')
      setNickname(nickname.trim() || '')
      setLoading(false)
    } catch (err: any) {
      setError(err.message || '등록 신청 중 오류가 발생했습니다')
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
      // 기존 세션이 있으면 먼저 로그아웃 (웨비나별 독립 등록을 위해)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        // 기존 사용자가 이 웨비나에 등록되어 있는지 확인
        const { data: existingRegistration } = await supabase
          .from('registrations')
          .select('webinar_id, user_id')
          .eq('webinar_id', webinar.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()
        
        // 등록되어 있지 않으면 기존 세션 로그아웃 (새 계정 생성)
        if (!existingRegistration) {
          await supabase.auth.signOut()
        } else {
          // 이미 등록되어 있으면 바로 입장
          window.location.href = `/webinar/${webinar.id}/live`
          return
        }
      }
      
      // 닉네임이 지정되면 닉네임을, 아니면 이름을 display_name으로 사용
      const finalDisplayName = nickname.trim() || displayName.trim()
      
      const { error: signupError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: finalDisplayName,
            nickname: nickname.trim() || null, // 닉네임을 별도로 저장 (선택사항)
            role: 'participant',
            webinar_id: webinar.id, // 웨비나 ID를 메타데이터에 저장
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
          // 닉네임이 지정되면 닉네임을, 아니면 이름을 display_name으로 사용
          const finalDisplayName = nickname.trim() || displayName.trim()
          // 프로필 업데이트 (타입 오류 회피를 위해 any 사용)
          try {
            const profilesTable = (supabase as any).from('profiles')
            const updateQuery = profilesTable.update({
              display_name: finalDisplayName,
              email: email,
            } as any)
            const result = await updateQuery.eq('id', data.user.id)
            
            if (result?.error) {
              console.error('프로필 업데이트 오류:', result.error)
            }
          } catch (updateError) {
            console.error('프로필 업데이트 오류:', updateError)
          }
        }
        
        // 웨비나 등록 (이 웨비나에 자동 등록)
        try {
          const registerResponse = await fetch(`/api/webinars/${webinar.id}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nickname: nickname.trim() || null,
            }),
          })
          
          if (!registerResponse.ok) {
            console.warn('웨비나 자동 등록 실패:', registerResponse.status)
          }
        } catch (registerError) {
          console.error('웨비나 등록 요청 오류:', registerError)
        }
        
        // 이메일 인증 안내 모달 표시
        setShowEmailVerification(true)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || '등록 중 오류가 발생했습니다')
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
        
        {/* 로그인/등록/게스트 폼 */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {webinar.access_policy === 'guest_allowed' && (
            <div className="flex gap-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => {
                  setMode('guest')
                  setError('')
                }}
                className={`flex-1 py-3 text-center font-medium transition-colors ${
                  mode === 'guest'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                게스트 입장
              </button>
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
                웨비나 등록
              </button>
            </div>
          )}
          {webinar.access_policy === 'email_auth' && (
            <div className="flex gap-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => {
                  setMode('email_auth')
                  setError('')
                }}
                className={`flex-1 py-3 text-center font-medium transition-colors ${
                  mode === 'email_auth'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                웨비나 입장
              </button>
              <button
                onClick={() => {
                  setMode('register')
                  setError('')
                  setPrivacyAgreed(false)
                }}
                className={`flex-1 py-3 text-center font-medium transition-colors ${
                  mode === 'register'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                웨비나 등록
              </button>
            </div>
          )}
          {webinar.access_policy !== 'guest_allowed' && webinar.access_policy !== 'email_auth' && (
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
                웨비나 등록
              </button>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {mode === 'guest' ? (
            <form onSubmit={handleGuestEntry} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">닉네임</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="닉네임을 입력하세요"
                  required
                  disabled={loading}
                  maxLength={20}
                />
                <p className="mt-1 text-sm text-gray-500">닉네임만 입력하면 바로 입장할 수 있습니다</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? '입장 중...' : '게스트로 입장하기'}
              </button>
            </form>
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 <span className="text-gray-400 text-xs">(선택사항)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="채팅에 표시될 닉네임 (미입력 시 이름 사용)"
                  disabled={loading}
                  maxLength={20}
                />
                <p className="mt-1 text-sm text-gray-500">닉네임을 입력하지 않으면 이름이 표시됩니다</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? '로그인 중...' : '웨비나 입장'}
              </button>
            </form>
          ) : mode === 'email_auth' ? (
            <form onSubmit={handleEmailAuth} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일 <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="등록된 이메일 주소를 입력하세요"
                  required
                  disabled={loading}
                />
                <p className="mt-1 text-sm text-gray-500">
                  등록된 이메일 주소로 바로 입장할 수 있습니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 <span className="text-gray-500 text-xs font-normal">(선택사항)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="닉네임을 입력하세요 (선택사항)"
                  disabled={loading}
                  maxLength={20}
                />
                <p className="mt-1 text-xs text-gray-500">
                  닉네임을 지정하지 않으면 이메일 주소로 표기됩니다.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? '입장 중...' : '웨비나 입장'}
              </button>
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-600 leading-relaxed">
                  입장 확인을 위해 이벤터스로부터 제공받은 최소한의 정보(이름, 이메일)만을 활용하며, 해당 정보는 <strong>모두의특강((주)유스튜디오)</strong>의 개인정보 처리방침에 따라 안전하게 보호됩니다.
                </p>
              </div>
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>웨비나 등록 신청</strong><br />
                  등록 신청 후 이메일 인증을 통해 입장할 수 있습니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일 <span className="text-red-500">*</span></label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="이름을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 <span className="text-gray-500 text-xs font-normal">(선택사항)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="닉네임을 입력하세요 (선택사항)"
                  disabled={loading}
                  maxLength={20}
                />
                <p className="mt-1 text-xs text-gray-500">
                  닉네임을 지정하지 않으면 이름으로 표기됩니다.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="privacy-agree"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={loading}
                />
                <label htmlFor="privacy-agree" className="text-sm text-gray-700 cursor-pointer">
                  [필수] <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    개인정보 수집 및 이용
                  </button>에 동의합니다.
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || !privacyAgreed}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? '등록 중...' : '웨비나 등록 및 입장하기'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>웨비나 등록</strong><br />
                  이 웨비나에만 등록되며, 다른 웨비나에는 별도로 등록해야 합니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="이름을 입력하세요"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 <span className="text-gray-500 text-xs font-normal">(선택사항)</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="닉네임을 입력하세요 (선택사항)"
                  disabled={loading}
                  maxLength={20}
                />
                <p className="mt-1 text-xs text-gray-500">
                  닉네임을 지정하지 않으면 이름으로 표기됩니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이메일 <span className="text-red-500">*</span></label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                {loading ? '등록 중...' : '웨비나 등록하고 입장하기'}
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
                {mode === 'email_auth' ? (
                  <>
                    <strong>{email}</strong>로 전송된 인증 링크를 확인해주세요.<br />
                    이메일의 링크를 클릭하면 웨비나에 입장할 수 있습니다.
                  </>
                ) : (
                  <>
                    등록이 완료되었습니다!<br />
                    <strong>{email}</strong>로 전송된 인증 이메일을 확인해주세요.<br />
                    이메일 인증을 완료한 후 웨비나에 입장할 수 있습니다.
                  </>
                )}
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

      {/* 개인정보 수집 및 이용 동의 모달 */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">개인정보 수집 및 이용 동의</h2>
              <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                <p>
                  <strong>(주)유스튜디오</strong>(이하 '회사')는 '모두의특강' 웨비나 진행을 위해 아래와 같이 개인정보를 수집 및 이용합니다.
                </p>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">1. 수집 및 이용 목적</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>웨비나 신청 접수 및 참여 자격 확인</li>
                    <li>웨비나 접속 링크(URL) 및 안내 메일 발송</li>
                    <li>행사 진행 관련 공지사항 전달</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">2. 수집하는 개인정보 항목</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>필수항목: 이름, 이메일</li>
                    <li>선택항목: 닉네임</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">3. 개인정보의 보유 및 이용 기간</h3>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>수집 목적 달성 시(웨비나 종료 및 관련 안내 완료 시)까지</li>
                    <li>단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 법령에서 정한 기간 동안 보관합니다.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">4. 동의 거부 권리 및 불이익</h3>
                  <p>
                    귀하는 개인정보 수집 및 이용에 거부할 권리가 있습니다. 단, 동의를 거부할 경우 웨비나 신청 및 참여가 제한될 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowPrivacyModal(false)
                    setPrivacyAgreed(true)
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                >
                  동의하고 닫기
                </button>
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="flex-1 text-gray-600 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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


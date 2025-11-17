'use client'

import Link from 'next/link'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { formatTime } from '@/lib/webinar/utils'

interface Webinar {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  access_policy: string
}

export default function Home() {
  const router = useRouter()
  const supabase = createClientSupabase()
  const [checking, setChecking] = useState(true)
  const [webinars, setWebinars] = useState<Webinar[]>([])
  const [loadingWebinars, setLoadingWebinars] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  
  useEffect(() => {
    async function checkUserAndRedirect() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        
        if (!currentUser) {
          setChecking(false)
          return
        }
        
        setUser(currentUser)
        
        // API를 통해 대시보드 경로 가져오기 (서버 사이드에서 RLS 정책 적용)
        const response = await fetch('/api/auth/dashboard')
        const result = await response.json()
        const { dashboard } = result
        
        if (dashboard) {
          // 슈퍼어드민인 경우 즉시 리다이렉트
          if (dashboard === '/super/dashboard') {
            setIsSuperAdmin(true)
            router.push(dashboard)
            return
          }
          router.push(dashboard)
          return
        }
        
        // 슈퍼어드민 여부 확인 (JWT app_metadata 사용 - RLS 재귀 방지)
        // 클라이언트에서는 직접 DB 조회하지 않고 JWT에서 확인
        if (currentUser?.app_metadata?.is_super_admin) {
          setIsSuperAdmin(true)
        }
        
        setChecking(false)
      } catch (error) {
        console.error('리다이렉트 확인 중 오류:', error)
        setChecking(false)
      }
    }
    
    checkUserAndRedirect()
  }, [router, supabase])
  
  useEffect(() => {
    async function loadActiveWebinars() {
      try {
        const response = await fetch('/api/webinars/active')
        if (response.ok) {
          const { webinars: activeWebinars } = await response.json()
          setWebinars(activeWebinars || [])
        }
      } catch (error) {
        console.error('진행중인 웨비나 로드 실패:', error)
      } finally {
        setLoadingWebinars(false)
      }
    }
    
    if (!checking) {
      loadActiveWebinars()
    }
  }, [checking])
  
  if (checking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-700">로딩 중...</div>
        </div>
      </main>
    )
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EventLive.ai
          </h1>
          {isSuperAdmin && (
            <div className="mt-6">
              <Link
                href="/super/dashboard"
                className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
              >
                🎛️ 슈퍼 관리자 대시보드
              </Link>
            </div>
          )}
        </div>
        
        <div className="max-w-6xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">현재 진행중인 웨비나</h2>
          
          {loadingWebinars ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600">로딩 중...</div>
            </div>
          ) : webinars.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600">현재 진행중인 웨비나가 없습니다.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {webinars.map((webinar) => (
                <Link
                  key={webinar.id}
                  href={`/webinar/${webinar.id}`}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="inline-block px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold mb-3">
                        🔴 LIVE
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2 line-clamp-2">
                        {webinar.title}
                      </h3>
                    </div>
                  </div>
                  {webinar.start_time && (
                    <div className="text-sm text-gray-500">
                      시작: {formatTime(webinar.start_time, 'long')}
                    </div>
                  )}
                  {webinar.end_time && (
                    <div className="text-sm text-gray-500 mt-1">
                      종료: {formatTime(webinar.end_time, 'long')}
                    </div>
                  )}
                  <div className="mt-3">
                    {webinar.access_policy === 'guest_allowed' ? (
                      <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        ✅ 게스트 입장 가능
                      </div>
                    ) : (
                      <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        📝 회원가입 필요
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-blue-600 font-medium">
                    입장하기 →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}


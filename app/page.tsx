'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'
import { createClientSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const supabase = createClientSupabase()
  const [checking, setChecking] = useState(true)
  
  useEffect(() => {
    async function checkUserAndRedirect() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setChecking(false)
          return
        }
        
        // API를 통해 대시보드 경로 가져오기 (서버 사이드에서 RLS 정책 적용)
        const response = await fetch('/api/auth/dashboard')
        const { dashboard } = await response.json()
        
        if (dashboard) {
          router.push(dashboard)
          return
        }
        
        setChecking(false)
      } catch (error) {
        console.error('리다이렉트 확인 중 오류:', error)
        setChecking(false)
      }
    }
    
    checkUserAndRedirect()
  }, [router, supabase])
  
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
          <p className="text-2xl text-gray-700 mb-4 font-semibold">Enterprise Edition v2.0</p>
          <p className="text-lg text-gray-600 mb-12">B2B2C 멀티테넌시 웨비나 플랫폼</p>
          
          <div className="flex gap-4 justify-center mb-16">
            <Link href="/signup">
              <Button size="lg" className="px-8">
                시작하기
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-8">
                로그인
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🎥</div>
              <h3 className="text-xl font-semibold mb-2">실시간 웨비나</h3>
              <p className="text-gray-600">YouTube 생중계 기반의 고성능 인터랙티브 웨비나</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">실시간 상호작용</h3>
              <p className="text-gray-600">채팅, Q&A, 퀴즈, 추첨 등 다양한 상호작용 기능</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-xl font-semibold mb-2">멀티테넌시</h3>
              <p className="text-gray-600">에이전시-클라이언트 계층 구조로 확장 가능한 SaaS</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}


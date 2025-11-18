'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface NavItem {
  name: string
  href: string
  icon: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const supabase = createClientSupabase()
  const [user, setUser] = useState<any>(null)
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [supabase])
  
  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('로그아웃 오류:', error)
        alert('로그아웃 중 오류가 발생했습니다: ' + error.message)
        return
      }
      
      // 세션이 제대로 삭제되었는지 확인
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // 세션이 남아있으면 강제로 삭제
        await supabase.auth.signOut()
      }
      
      // 메인 페이지로 리다이렉트 (강제 새로고침)
      window.location.href = '/'
    } catch (error: any) {
      console.error('로그아웃 오류:', error)
      alert('로그아웃 중 오류가 발생했습니다')
      // 에러가 발생해도 메인 페이지로 이동 시도
      window.location.href = '/'
    }
  }
  
  // 공개 페이지에서는 사이드바 숨김
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
  if (isPublicPage) return null
  
  // 경로에 따라 다른 네비게이션 표시
  const getNavItems = (): NavItem[] => {
    if (pathname.includes('/super/')) {
      return [
        { name: '대시보드', href: '/super/dashboard', icon: '📊' },
        { name: '에이전시 관리', href: '/super/agencies', icon: '🏢' },
        { name: '계정 설정', href: '/settings/profile', icon: '⚙️' },
      ]
    } else if (pathname.includes('/agency/')) {
      const agencyId = params?.agencyId as string
      if (!agencyId) return []
      return [
        { name: '대시보드', href: `/agency/${agencyId}/dashboard`, icon: '📊' },
        { name: '클라이언트', href: `/agency/${agencyId}/clients`, icon: '👥' },
        { name: '리포트', href: `/agency/${agencyId}/reports`, icon: '📈' },
        { name: '도메인', href: `/agency/${agencyId}/domains`, icon: '🌐' },
        { name: '계정 설정', href: '/settings/profile', icon: '⚙️' },
      ]
    } else if (pathname.includes('/client/')) {
      const clientId = params?.clientId as string
      if (!clientId) return []
      return [
        { name: '대시보드', href: `/client/${clientId}/dashboard`, icon: '📊' },
        { name: '웨비나', href: `/client/${clientId}/webinars`, icon: '🎥' },
        { name: '가입계정관리', href: `/client/${clientId}/accounts`, icon: '👥' },
        { name: '브랜딩', href: `/client/${clientId}/settings/branding`, icon: '🎨' },
        { name: '계정 설정', href: '/settings/profile', icon: '⚙️' },
      ]
    }
    return []
  }
  
  const navItems = getNavItems()
  
  if (navItems.length === 0) return null
  
  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside className="hidden lg:flex w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen fixed left-0 top-0 flex-col">
        <div className="p-6">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            EventLive.ai
          </Link>
        </div>
        <nav className="mt-8 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-6 py-3 transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-600 border-r-4 border-blue-400' 
                    : 'hover:bg-gray-700'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-700">
          {user && (
            <div className="mb-3 px-4 py-2">
              <p className="text-sm text-gray-400 truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-6 py-3 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-all duration-200 rounded-lg"
          >
            <span className="text-xl">🚪</span>
            <span className="font-medium">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* 모바일 하단 메뉴 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-b from-gray-900 to-gray-800 text-white border-t border-gray-700 z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px]
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }
                `}
                title={item.name}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] text-red-400 hover:text-red-300 hover:bg-red-900/20"
            title="로그아웃"
          >
            <span className="text-2xl">🚪</span>
            <span className="text-xs font-medium">로그아웃</span>
          </button>
        </div>
      </nav>
    </>
  )
}


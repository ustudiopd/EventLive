'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useParams } from 'next/navigation'

interface NavItem {
  name: string
  href: string
  icon: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const params = useParams()
  
  // 공개 페이지에서는 사이드바 숨김
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
  if (isPublicPage) return null
  
  // 경로에 따라 다른 네비게이션 표시
  const getNavItems = (): NavItem[] => {
    if (pathname.includes('/super/')) {
      return [
        { name: '대시보드', href: '/super/dashboard', icon: '📊' },
        { name: '에이전시 관리', href: '/super/agencies', icon: '🏢' },
      ]
    } else if (pathname.includes('/agency/')) {
      const agencyId = params?.agencyId as string
      if (!agencyId) return []
      return [
        { name: '대시보드', href: `/agency/${agencyId}/dashboard`, icon: '📊' },
        { name: '클라이언트', href: `/agency/${agencyId}/clients`, icon: '👥' },
        { name: '리포트', href: `/agency/${agencyId}/reports`, icon: '📈' },
        { name: '도메인', href: `/agency/${agencyId}/domains`, icon: '🌐' },
      ]
    } else if (pathname.includes('/client/')) {
      const clientId = params?.clientId as string
      if (!clientId) return []
      return [
        { name: '대시보드', href: `/client/${clientId}/dashboard`, icon: '📊' },
        { name: '웨비나', href: `/client/${clientId}/webinars`, icon: '🎥' },
        { name: '브랜딩', href: `/client/${clientId}/settings/branding`, icon: '🎨' },
      ]
    }
    return []
  }
  
  const navItems = getNavItems()
  
  if (navItems.length === 0) return null
  
  return (
    <aside className="w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          EventLive.ai
        </Link>
      </div>
      <nav className="mt-8">
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
    </aside>
  )
}


'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface NavItem {
  name: string
  href: string
  icon: string
}

export default function SuperSidebar() {
  const pathname = usePathname()
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

      window.location.href = '/'
    } catch (error: any) {
      console.error('로그아웃 오류:', error)
      alert('로그아웃 중 오류가 발생했습니다')
      window.location.href = '/'
    }
  }

  const navItems: NavItem[] = [
    { name: '대시보드', href: '/super/dashboard', icon: '📊' },
    { name: '에이전시 관리', href: '/super/agencies', icon: '🏢' },
    { name: '클라이언트 관리', href: '/super/clients', icon: '👥' },
    { name: '계정 설정', href: '/settings/profile', icon: '⚙️' },
  ]

  return (
    <aside className="hidden lg:flex w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen fixed left-0 top-0 flex-col z-10">
      <div className="p-6">
        <Link href="/super/dashboard" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          EventLive.ai
        </Link>
        <div className="mt-2 text-xs text-gray-400">슈퍼 관리자</div>
      </div>

      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-xl">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-700">
        {user && (
          <div className="mb-4 px-4 py-2 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400">접속 계정</div>
            <div className="text-sm font-medium text-white truncate">
              {user.email}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}


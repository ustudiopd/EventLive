'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const supabase = createClientSupabase()
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
  
  if (isPublicPage) {
    return (
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EventLive.ai
            </Link>
            <div className="flex gap-4">
              {user ? (
                <>
                  <Link href="/" className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                    대시보드
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                    로그인
                  </Link>
                  <Link href="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    )
  }
  
  return null
}


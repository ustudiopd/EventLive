'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isWebinarPage = pathname.startsWith('/webinar/')
  
  if (isPublicPage || isWebinarPage) {
    return <>{children}</>
  }
  
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  )
}


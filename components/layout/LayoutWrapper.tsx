'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import { SidebarProvider, useSidebar } from './SidebarContext'

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { sidebarWidth } = useSidebar()
  const pathname = usePathname()
  
  // 공개 페이지: 홈, 로그인, 회원가입
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
  
  // /admin 페이지는 사이드바 없음
  const isAdminPage = pathname.startsWith('/admin')
  
  // 테스트 페이지는 사이드바 없음
  const isTestPage = pathname.startsWith('/test')
  
  // 설문조사 공개 페이지는 사이드바 없음
  const isSurveyPublicPage = pathname.startsWith('/event/')
  
  // 관리 웨비나 페이지 (콘솔, 등록자, 통계)는 사이드바 표시
  // 정규식: /webinar/[id 또는 slug]/console, /webinar/[id 또는 slug]/registrants, /webinar/[id 또는 slug]/stats 패턴 매칭
  // URL 인코딩된 경로도 처리 (decodeURIComponent 사용)
  // usePathname()은 이미 디코딩된 경로를 반환하지만, 안전을 위해 두 가지 모두 확인
  const decodedPathname = decodeURIComponent(pathname)
  
  // 더 명확한 경로 체크: /webinar/로 시작하고 /console, /registrants, /stats로 끝나는지 확인
  const isConsolePage = pathname.endsWith('/console') || decodedPathname.endsWith('/console')
  const isRegistrantsPage = pathname.endsWith('/registrants') || decodedPathname.endsWith('/registrants')
  const isStatsPage = pathname.endsWith('/stats') || decodedPathname.endsWith('/stats')
  const isAdminWebinarPage = (isConsolePage || isRegistrantsPage || isStatsPage) && 
                             (pathname.startsWith('/webinar/') || decodedPathname.startsWith('/webinar/'))
  
  // 공개 웨비나 페이지 (시청 페이지, 라이브 페이지)는 사이드바 없음
  // 단, /live 페이지는 admin 파라미터가 있어도 사이드바 없음 (시청 페이지이므로)
  const isPublicWebinarPage = (pathname.startsWith('/webinar/') || decodedPathname.startsWith('/webinar/')) && 
                               !isAdminWebinarPage && 
                               !pathname.includes('/live') && 
                               !decodedPathname.includes('/live')
  
  // 디버깅 로그 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development' && decodedPathname.includes('/webinar/')) {
    console.log('[LayoutWrapper] 경로 확인:', {
      pathname,
      decodedPathname,
      isConsolePage,
      isRegistrantsPage,
      isStatsPage,
      isAdminWebinarPage,
      isPublicWebinarPage,
      shouldShowSidebar: !(isPublicPage || isPublicWebinarPage || isAdminPage || isTestPage)
    })
  }
  
  // 사이드바를 숨겨야 하는 페이지: 공개 페이지, 공개 웨비나 페이지, /admin 페이지, 테스트 페이지, 설문조사 공개 페이지
  // 관리 웨비나 페이지(콘솔, 등록자, 통계)는 사이드바 표시
  if (isPublicPage || isPublicWebinarPage || isAdminPage || isTestPage || isSurveyPublicPage) {
    return <>{children}</>
  }
  
  // 나머지 모든 페이지 (관리 페이지, 관리 웨비나 페이지 등)는 사이드바 표시
  // 사이드바가 fixed이므로 flex 레이아웃 불필요
  return (
    <>
      <Sidebar />
      <main 
        className="pb-16 lg:pb-0 transition-all duration-300 min-h-screen bg-gradient-to-br from-gray-50 to-blue-50"
        style={{ 
          marginLeft: `${sidebarWidth}px`,
          width: `calc(100vw - ${sidebarWidth}px)`,
          maxWidth: `calc(100vw - ${sidebarWidth}px)`,
          boxSizing: 'border-box'
        }}
      >
        {children}
      </main>
    </>
  )
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  )
}


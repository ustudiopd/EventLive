'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClientSupabase } from '@/lib/supabase/client'
import YouTubePlayer from '@/components/webinar/YouTubePlayer'
import Chat from '@/components/webinar/Chat'
import QA from '@/components/webinar/QA'
import PresenceBar from '@/components/webinar/PresenceBar'

interface Webinar {
  id: string
  title: string
  description?: string
  youtube_url: string
  start_time?: string
  end_time?: string
  is_public: boolean
  access_policy: string
  clients?: {
    id: string
    name: string
    logo_url?: string
    brand_config?: any
  }
}

interface WebinarViewProps {
  webinar: Webinar
}

/**
 * 웨비나 시청 페이지 메인 컴포넌트
 * 모듈화된 컴포넌트들을 조합하여 구성
 */
export default function WebinarView({ webinar }: WebinarViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'qa'>('chat')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const supabase = createClientSupabase()
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // 웨비나 등록 확인 및 자동 등록
  useEffect(() => {
    const registerForWebinar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // 웨비나에 자동 등록
        const response = await fetch(`/api/webinars/${webinar.id}/register`, {
          method: 'POST',
        })
        
        if (!response.ok) {
          console.error('웨비나 등록 실패:', await response.text())
        }
      } catch (error) {
        console.error('웨비나 등록 오류:', error)
      }
    }
    
    registerForWebinar()
  }, [webinar.id, supabase])
  
  // 전체화면 진입
  const enterFullscreen = async () => {
    // 전체화면 요소를 먼저 표시
    setIsFullscreen(true)
    
    // 다음 프레임에서 전체화면 API 호출
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!fullscreenRef.current) return
    
    try {
      if (fullscreenRef.current.requestFullscreen) {
        await fullscreenRef.current.requestFullscreen()
      } else if ((fullscreenRef.current as any).webkitRequestFullscreen) {
        await (fullscreenRef.current as any).webkitRequestFullscreen()
      } else if ((fullscreenRef.current as any).mozRequestFullScreen) {
        await (fullscreenRef.current as any).mozRequestFullScreen()
      } else if ((fullscreenRef.current as any).msRequestFullscreen) {
        await (fullscreenRef.current as any).msRequestFullscreen()
      }
    } catch (error) {
      console.error('전체화면 진입 실패:', error)
      // 폴백: 커스텀 전체화면은 이미 표시됨
    }
  }
  
  // 전체화면 종료
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen()
      }
    } catch (error) {
      console.error('전체화면 종료 실패:', error)
    }
    setIsFullscreen(false)
  }
  
  // 전체화면 상태 변경 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])
  
  // ESC 키로 전체화면 해제
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen()
      }
    }
    
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isFullscreen])
  
  const fullscreenContent = isFullscreen && mounted ? (
    <div 
      ref={fullscreenRef}
      className="fixed inset-0 bg-black flex items-center justify-center"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        minWidth: '100vw',
        minHeight: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: '#000',
        zIndex: 2147483647,
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* 닫기 버튼 */}
        <button
          onClick={exitFullscreen}
          className="absolute top-4 right-4 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-colors"
          aria-label="전체화면 종료"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* ESC 안내 */}
        <div className="absolute top-4 left-4 z-50 bg-black/70 text-white text-sm px-3 py-2 rounded-lg">
          ESC 키를 눌러 종료
        </div>
        
        {/* YouTube 플레이어 */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="relative w-full h-full" style={{ maxWidth: '100vw', maxHeight: '100vh', aspectRatio: '16/9' }}>
            <YouTubePlayer
              url={webinar.youtube_url}
              width="100%"
              height="100%"
              autoplay={false}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </div>
  ) : null
  
  return (
    <>
      {mounted && createPortal(fullscreenContent, document.body)}
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 w-full overflow-x-hidden">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 w-full">
        <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 truncate">{webinar.title}</h1>
              {webinar.description && (
                <p className="text-xs lg:text-sm text-gray-600 mt-0.5 sm:mt-1 line-clamp-1">{webinar.description}</p>
              )}
            </div>
            {webinar.clients?.logo_url && (
              <img 
                src={webinar.clients.logo_url} 
                alt={webinar.clients.name}
                className="h-6 sm:h-8 lg:h-12 w-auto ml-2 flex-shrink-0"
              />
            )}
          </div>
        </div>
      </header>
      
      <div className="w-full max-w-[1600px] mx-auto px-0 sm:px-2 lg:px-4 py-2 sm:py-3 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-6 w-full">
          {/* 메인 영역 - YouTube 플레이어 */}
          <div className="lg:col-span-2 space-y-2 sm:space-y-3 lg:space-y-4">
            {/* YouTube 플레이어 */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-lg overflow-hidden w-full relative group">
              <div className="relative w-full pb-[56.25%] bg-black">
                <div className="absolute top-0 left-0 w-full h-full">
                  <YouTubePlayer
                    url={webinar.youtube_url}
                    width="100%"
                    height="100%"
                    autoplay={false}
                    className="w-full h-full"
                  />
                </div>
              </div>
              
              {/* 전체화면 버튼 (데스크톱만) */}
              <button
                onClick={enterFullscreen}
                className="hidden lg:flex absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white rounded-lg p-2 transition-all opacity-0 group-hover:opacity-100 z-10"
                aria-label="전체화면"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
            
            {/* 세션 소개 - 모바일에서도 표시 */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 lg:mb-4">세션 소개</h3>
              {webinar.description ? (
                <div className="prose prose-sm max-w-none">
                  <p className="text-xs sm:text-sm lg:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {webinar.description}
                  </p>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500 italic">세션 소개가 없습니다.</p>
              )}
              {webinar.start_time && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">시작: {new Date(webinar.start_time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {webinar.end_time && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">종료: {new Date(webinar.end_time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Presence Bar - 모바일에서도 표시 */}
            <PresenceBar
              webinarId={webinar.id}
              showTyping={true}
              className="text-xs sm:text-sm"
            />
            
            {/* 모바일 채팅/Q&A - 영상 아래 순서대로 */}
            <div className="lg:hidden">
              <div className="bg-white rounded-lg sm:rounded-xl shadow-lg overflow-hidden h-[50vh] min-h-[350px] max-h-[500px] flex flex-col">
                {/* 탭 */}
                <div className="border-b border-gray-200 flex flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                      activeTab === 'chat'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600'
                    }`}
                  >
                    💬 채팅
                  </button>
                  <button
                    onClick={() => setActiveTab('qa')}
                    className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                      activeTab === 'qa'
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600'
                    }`}
                  >
                    ❓ Q&A
                  </button>
                </div>
                
                {/* 탭 컨텐츠 */}
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'chat' ? (
                    <Chat
                      webinarId={webinar.id}
                      canSend={true}
                      maxMessages={50}
                    />
                  ) : (
                    <QA
                      webinarId={webinar.id}
                      canAsk={true}
                      showOnlyMine={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* 사이드바 - 채팅/Q&A (데스크톱) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden h-[calc(100vh-200px)] flex flex-col w-full max-w-[400px]">
              {/* 탭 */}
              <div className="border-b border-gray-200 flex">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  💬 채팅
                </button>
                <button
                  onClick={() => setActiveTab('qa')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'qa'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ❓ Q&A
                </button>
              </div>
              
              {/* 탭 컨텐츠 */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'chat' ? (
                  <Chat
                    webinarId={webinar.id}
                    canSend={true}
                    maxMessages={50}
                  />
                ) : (
                  <QA
                    webinarId={webinar.id}
                    canAsk={true}
                    showOnlyMine={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}


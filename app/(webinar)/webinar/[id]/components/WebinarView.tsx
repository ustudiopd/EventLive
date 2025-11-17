'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientSupabase } from '@/lib/supabase/client'
import YouTubePlayer from '@/components/webinar/YouTubePlayer'
import Chat from '@/components/webinar/Chat'
import QA from '@/components/webinar/QA'
import PresenceBar from '@/components/webinar/PresenceBar'
import FormWidget from '@/components/webinar/FormWidget'
import FileDownload from '@/components/webinar/FileDownload'
import GiveawayWidget from '@/components/webinar/GiveawayWidget'

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
  isAdminMode?: boolean
}

/**
 * 웨비나 시청 페이지 메인 컴포넌트
 * 모듈화된 컴포넌트들을 조합하여 구성
 */
export default function WebinarView({ webinar, isAdminMode = false }: WebinarViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'qa'>('chat')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openForms, setOpenForms] = useState<any[]>([])
  const [openGiveaways, setOpenGiveaways] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [popupContent, setPopupContent] = useState<{ type: 'form' | 'giveaway' | 'file'; id: string; title: string } | null>(null)
  const [shownPopups, setShownPopups] = useState<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)
  const previousItemsRef = useRef<{ forms: Set<string>; giveaways: Set<string>; files: Set<string> }>({
    forms: new Set(),
    giveaways: new Set(),
    files: new Set(),
  })
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const supabase = createClientSupabase()
  const router = useRouter()
  
  // Chat 컴포넌트를 한 번만 렌더링하여 중복 구독 방지 (해결책.md 권장사항)
  const chatComponent = useMemo(() => (
    <Chat
      key={`chat-${webinar.id}`}
      webinarId={webinar.id}
      canSend={true}
      maxMessages={50}
      isAdminMode={isAdminMode}
    />
  ), [webinar.id, isAdminMode])
  
  // QA 컴포넌트를 한 번만 렌더링하여 중복 구독 방지
  const qaComponent = useMemo(() => (
    <QA
      key={`qa-${webinar.id}`}
      webinarId={webinar.id}
      canAsk={true}
      showOnlyMine={false}
      isAdminMode={isAdminMode}
    />
  ), [webinar.id, isAdminMode])
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // 오픈된 폼, 추첨, 파일 로드
  useEffect(() => {
    const loadOpenItems = async () => {
      try {
        // 오픈된 폼 조회
        let formsResponse: Response
        try {
          formsResponse = await fetch(
            `/api/webinars/${webinar.id}/forms?status=open`,
            {
              credentials: 'include', // 쿠키 포함
            }
          )
        } catch (fetchError: any) {
          // 네트워크 오류는 조용히 처리 (재시도될 예정)
          if (fetchError.name === 'TypeError' && fetchError.message === 'Failed to fetch') {
            console.warn('네트워크 오류: 폼 조회 실패 (서버 연결 불가)')
            return
          }
          throw fetchError
        }
        
        const formsResult = await formsResponse.json()
        if (formsResponse.ok && formsResult.forms) {
          const loadedForms = formsResult.forms
          const currentFormIds = new Set<string>(loadedForms.map((f: any) => f.id))
          
          // 새로 오픈된 폼 찾기 (이전에 없던 것)
          if (!isInitialLoadRef.current) {
            const newForms = loadedForms.filter((form: any) => !previousItemsRef.current.forms.has(form.id))
            if (newForms.length > 0) {
              // 첫 번째 새 폼만 팝업으로 표시
              const newForm = newForms[0]
              const popupKey = `form-${newForm.id}`
              setShownPopups((prev) => {
                const next = new Set(prev)
                next.add(popupKey)
                return next
              })
              setPopupContent({
                type: 'form',
                id: newForm.id,
                title: newForm.title,
              })
            }
          }
          
          setOpenForms(loadedForms)
          previousItemsRef.current.forms = currentFormIds
        }

        // 오픈된 추첨 조회
        let giveawaysResponse: Response
        try {
          giveawaysResponse = await fetch(
            `/api/webinars/${webinar.id}/giveaways`,
            {
              credentials: 'include', // 쿠키 포함
            }
          )
        } catch (fetchError: any) {
          if (fetchError.name === 'TypeError' && fetchError.message === 'Failed to fetch') {
            console.warn('네트워크 오류: 추첨 조회 실패 (서버 연결 불가)')
            return
          }
          throw fetchError
        }
        
        const giveawaysResult = await giveawaysResponse.json()
        if (giveawaysResponse.ok && giveawaysResult.giveaways) {
          const loadedGiveaways = giveawaysResult.giveaways.filter(
            (g: any) => g.status === 'open' || g.status === 'drawn'
          )
          const currentGiveawayIds = new Set<string>(loadedGiveaways.map((g: any) => g.id))
          
          // 새로 오픈된 추첨 찾기 (이전에 없던 것)
          if (!isInitialLoadRef.current) {
            const newGiveaways = loadedGiveaways.filter((g: any) => !previousItemsRef.current.giveaways.has(g.id))
            if (newGiveaways.length > 0) {
              // 첫 번째 새 추첨만 팝업으로 표시
              const newGiveaway = newGiveaways[0]
              const popupKey = `giveaway-${newGiveaway.id}`
              setShownPopups((prev) => {
                const next = new Set(prev)
                next.add(popupKey)
                return next
              })
              setPopupContent({
                type: 'giveaway',
                id: newGiveaway.id,
                title: newGiveaway.name || newGiveaway.title,
              })
            }
          }
          
          setOpenGiveaways(loadedGiveaways)
          previousItemsRef.current.giveaways = currentGiveawayIds
        }

        // 파일 목록 조회
        let filesResponse: Response
        try {
          filesResponse = await fetch(
            `/api/webinars/${webinar.id}/files`,
            {
              credentials: 'include', // 쿠키 포함
            }
          )
        } catch (fetchError: any) {
          if (fetchError.name === 'TypeError' && fetchError.message === 'Failed to fetch') {
            console.warn('네트워크 오류: 파일 조회 실패 (서버 연결 불가)')
            return
          }
          throw fetchError
        }
        
        const filesResult = await filesResponse.json()
        if (filesResponse.ok && filesResult.files) {
          const loadedFiles = filesResult.files
          const currentFileIds = new Set<string>(loadedFiles.map((f: any) => f.id))
          
          // 새로 업로드된 파일 찾기 (이전에 없던 것)
          if (!isInitialLoadRef.current) {
            const newFiles = loadedFiles.filter((file: any) => !previousItemsRef.current.files.has(file.id))
            if (newFiles.length > 0) {
              // 첫 번째 새 파일만 팝업으로 표시
              const newFile = newFiles[0]
              const popupKey = `file-${newFile.id}`
              setShownPopups((prev) => {
                const next = new Set(prev)
                next.add(popupKey)
                return next
              })
              setPopupContent({
                type: 'file',
                id: 'all',
                title: '발표자료',
              })
            }
          }
          
          setFiles(loadedFiles)
          previousItemsRef.current.files = currentFileIds
        }
        
        // 초기 로드 완료 표시
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false
        }
      } catch (error: any) {
        // 네트워크 오류가 아닌 다른 에러만 로깅
        if (!(error.name === 'TypeError' && error.message === 'Failed to fetch')) {
          console.error('오픈된 항목 로드 실패:', error)
        }
      }
    }

    loadOpenItems()

    // 실시간 업데이트 구독
    const channel = supabase
      .channel(`webinar:${webinar.id}:participant-widgets`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forms',
          filter: `webinar_id=eq.${webinar.id}`,
        },
        () => {
          loadOpenItems()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'giveaways',
          filter: `webinar_id=eq.${webinar.id}`,
        },
        () => {
          loadOpenItems()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webinar_files',
          filter: `webinar_id=eq.${webinar.id}`,
        },
        () => {
          loadOpenItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [webinar.id, supabase])
  
  // 웨비나 등록 확인 및 자동 등록
  useEffect(() => {
    const registerForWebinar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // 웨비나에 자동 등록
        try {
          const response = await fetch(`/api/webinars/${webinar.id}/register`, {
            method: 'POST',
          })
          
          if (!response.ok) {
            const errorText = await response.text()
            // HTML 응답인 경우 (404 페이지 등) 간단히 로깅
            if (errorText.includes('<!DOCTYPE html>')) {
              console.warn('웨비나 등록 API 404:', `/api/webinars/${webinar.id}/register`)
            } else {
              console.error('웨비나 등록 실패:', response.status, errorText.substring(0, 200))
            }
          }
        } catch (fetchError) {
          console.error('웨비나 등록 요청 오류:', fetchError)
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
  
  // ESC 키로 전체화면 해제 및 팝업 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popupContent) {
          setPopupContent(null)
        } else if (isFullscreen) {
          exitFullscreen()
        }
      }
    }
    
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isFullscreen, popupContent])
  
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
      {/* 팝업 모달 */}
      {popupContent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // 배경 클릭 시 닫기
            if (e.target === e.currentTarget) {
              setPopupContent(null)
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{popupContent.title}</h3>
              <button
                onClick={() => setPopupContent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="닫기"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 팝업 내용 */}
            <div className="flex-1 overflow-y-auto p-4">
              {popupContent.type === 'form' && (
                <FormWidget
                  webinarId={webinar.id}
                  formId={popupContent.id}
                  onSubmitted={() => {
                    setPopupContent(null)
                    // 제출 후 목록에서 제거 (설문의 경우)
                    const form = openForms.find((f) => f.id === popupContent.id)
                    if (form?.kind === 'survey') {
                      setOpenForms((prev) => prev.filter((f) => f.id !== popupContent.id))
                    }
                  }}
                />
              )}
              {popupContent.type === 'giveaway' && (
                <GiveawayWidget
                  webinarId={webinar.id}
                  giveawayId={popupContent.id}
                />
              )}
              {popupContent.type === 'file' && (
                <FileDownload webinarId={webinar.id} canDelete={isAdminMode} />
              )}
            </div>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 w-full overflow-x-hidden">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 w-full">
        <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0">
              <h1 
                onClick={() => router.push(`/webinar/${webinar.id}`)}
                className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
                title="웨비나 입장 페이지로 이동"
              >
                {webinar.title}
              </h1>
              {webinar.description && (
                <p className="text-xs lg:text-sm text-gray-600 mt-0.5 sm:mt-1 line-clamp-1">{webinar.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 ml-4">
              {isAdminMode && (
                <Link
                  href={`/webinar/${webinar.id}/console`}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  운영 콘솔
                </Link>
              )}
              {webinar.clients?.logo_url && (
                <img 
                  src={webinar.clients.logo_url} 
                  alt={webinar.clients.name}
                  className="h-6 sm:h-8 lg:h-12 w-auto flex-shrink-0"
                />
              )}
            </div>
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
              
              {/* 설문/퀴즈/발표자료/추첨 버튼 */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {openForms.filter((f) => f.kind === 'survey').length > 0 && (
                    <button
                      onClick={() => {
                        const survey = openForms.find((f) => f.kind === 'survey')
                        if (survey) {
                          setPopupContent({
                            type: 'form',
                            id: survey.id,
                            title: survey.title,
                          })
                        }
                      }}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                    >
                      📋 설문조사
                      {openForms.filter((f) => f.kind === 'survey').length > 1 && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {openForms.filter((f) => f.kind === 'survey').length}
                        </span>
                      )}
                    </button>
                  )}
                  {openForms.filter((f) => f.kind === 'quiz').length > 0 && (
                    <button
                      onClick={() => {
                        const quiz = openForms.find((f) => f.kind === 'quiz')
                        if (quiz) {
                          setPopupContent({
                            type: 'form',
                            id: quiz.id,
                            title: quiz.title,
                          })
                        }
                      }}
                      className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                    >
                      ✏️ 퀴즈
                      {openForms.filter((f) => f.kind === 'quiz').length > 1 && (
                        <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {openForms.filter((f) => f.kind === 'quiz').length}
                        </span>
                      )}
                    </button>
                  )}
                  {files.length > 0 && (
                    <button
                      onClick={() => {
                        setPopupContent({
                          type: 'file',
                          id: 'all',
                          title: '발표자료',
                        })
                      }}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                    >
                      📎 발표자료
                      {files.length > 1 && (
                        <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {files.length}
                        </span>
                      )}
                    </button>
                  )}
                  {openGiveaways.length > 0 && (
                    <button
                      onClick={() => {
                        const giveaway = openGiveaways[0]
                        if (giveaway) {
                          setPopupContent({
                            type: 'giveaway',
                            id: giveaway.id,
                            title: giveaway.name || giveaway.title || '추첨',
                          })
                        }
                      }}
                      className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-xs sm:text-sm font-medium flex items-center gap-1.5"
                    >
                      🎁 추첨
                      {openGiveaways.length > 1 && (
                        <span className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {openGiveaways.length}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
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
                
                {/* 탭 컨텐츠 - 모바일 전용 (단일 인스턴스 사용) */}
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'chat' ? chatComponent : qaComponent}
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
              
              {/* 탭 컨텐츠 - 데스크톱 전용 (단일 인스턴스 사용) */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'chat' ? chatComponent : qaComponent}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}


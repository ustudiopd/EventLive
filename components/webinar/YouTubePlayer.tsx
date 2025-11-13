'use client'

import { useEffect, useRef } from 'react'

interface YouTubePlayerProps {
  /** YouTube URL (full URL or video ID) */
  url: string
  /** 플레이어 너비 */
  width?: string | number
  /** 플레이어 높이 */
  height?: string | number
  /** 자동 재생 여부 */
  autoplay?: boolean
  /** 음소거 여부 */
  muted?: boolean
  /** 커스텀 클래스명 */
  className?: string
  /** 플레이어 준비 완료 콜백 */
  onReady?: () => void
  /** 플레이어 에러 콜백 */
  onError?: (error: Error) => void
}

/**
 * YouTube 비디오 플레이어 컴포넌트
 * 재사용 가능하고 커스터마이징 가능한 YouTube 임베드 컴포넌트
 */
export default function YouTubePlayer({
  url,
  width = '100%',
  height = '100%',
  autoplay = false,
  muted = false,
  className = '',
  onReady,
  onError,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!containerRef.current) return
    
    // YouTube URL에서 video ID 추출
    const getVideoId = (url: string): string | null => {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/,
      ]
      
      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1] || match[0]
      }
      return null
    }
    
    const videoId = getVideoId(url)
    
    if (!videoId) {
      onError?.(new Error('Invalid YouTube URL'))
      return
    }
    
    // 기존 iframe 제거
    const existingIframe = containerRef.current.querySelector('iframe')
    if (existingIframe) {
      existingIframe.remove()
    }
    
    // YouTube 임베드 URL 생성
    const embedUrl = `https://www.youtube.com/embed/${videoId}?${
      autoplay ? 'autoplay=1&' : ''
    }${muted ? 'mute=1&' : ''}rel=0&modestbranding=1`
    
    // iframe 생성
    const iframe = document.createElement('iframe')
    iframe.src = embedUrl
    iframe.width = typeof width === 'number' ? width.toString() : width
    iframe.height = typeof height === 'number' ? height.toString() : height
    iframe.frameBorder = '0'
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true
    iframe.className = 'w-full h-full rounded-lg'
    
    iframe.onload = () => {
      onReady?.()
    }
    
    iframe.onerror = () => {
      onError?.(new Error('Failed to load YouTube player'))
    }
    
    containerRef.current.appendChild(iframe)
    
    return () => {
      if (containerRef.current) {
        const iframe = containerRef.current.querySelector('iframe')
        iframe?.remove()
      }
    }
  }, [url, autoplay, muted, width, height, onReady, onError])
  
  return (
    <div 
      ref={containerRef}
      className={`youtube-player-container ${className}`}
      style={{ 
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        aspectRatio: '16/9',
      }}
    />
  )
}


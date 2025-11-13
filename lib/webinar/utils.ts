/**
 * 웨비나 관련 유틸리티 함수
 * 재사용 가능한 헬퍼 함수들
 */

/**
 * YouTube URL에서 비디오 ID 추출
 */
export function extractYouTubeVideoId(url: string): string | null {
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

/**
 * YouTube 임베드 URL 생성
 */
export function createYouTubeEmbedUrl(
  videoId: string,
  options?: {
    autoplay?: boolean
    muted?: boolean
    start?: number
    end?: number
  }
): string {
  const params = new URLSearchParams()
  
  if (options?.autoplay) params.append('autoplay', '1')
  if (options?.muted) params.append('mute', '1')
  if (options?.start) params.append('start', options.start.toString())
  if (options?.end) params.append('end', options.end.toString())
  
  params.append('rel', '0')
  params.append('modestbranding', '1')
  
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * 웨비나 상태 확인
 */
export function getWebinarStatus(webinar: {
  start_time?: string | null
  end_time?: string | null
}): 'scheduled' | 'live' | 'ended' {
  if (!webinar.start_time) return 'scheduled'
  
  const now = new Date()
  const start = new Date(webinar.start_time)
  const end = webinar.end_time ? new Date(webinar.end_time) : null
  
  if (end && now > end) return 'ended'
  if (now >= start) return 'live'
  return 'scheduled'
}

/**
 * 시간 포맷팅
 */
export function formatTime(dateString: string, format: 'short' | 'long' = 'short'): string {
  const date = new Date(dateString)
  
  if (format === 'short') {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }
  
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 메시지 내용 검증
 */
export function validateMessage(content: string): { valid: boolean; error?: string } {
  if (!content.trim()) {
    return { valid: false, error: '메시지 내용을 입력해주세요' }
  }
  
  if (content.length > 500) {
    return { valid: false, error: '메시지는 500자 이하여야 합니다' }
  }
  
  return { valid: true }
}

/**
 * 질문 내용 검증
 */
export function validateQuestion(content: string): { valid: boolean; error?: string } {
  if (!content.trim()) {
    return { valid: false, error: '질문 내용을 입력해주세요' }
  }
  
  if (content.length > 1000) {
    return { valid: false, error: '질문은 1000자 이하여야 합니다' }
  }
  
  return { valid: true }
}


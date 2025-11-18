'use client'

import { useState } from 'react'

interface ShareLinkButtonProps {
  webinarId: string
  webinarTitle?: string
  className?: string
}

export default function ShareLinkButton({ 
  webinarId, 
  webinarTitle,
  className = '' 
}: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleShare = async () => {
    setLoading(true)
    try {
      // 짧은 링크 생성/조회
      const response = await fetch(`/api/webinars/${webinarId}/short-link`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate short link')
      }

      const data = await response.json()
      const urlToShare = data.shortUrl || data.fullUrl
      const title = data.webinarTitle || webinarTitle || '웨비나'

      // Web Share API 사용 (지원되는 경우)
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({
            title: title,
            text: `${title} - EventLive 웨비나에 참여하세요`,
            url: urlToShare,
          })
          // 공유 성공
          return
        } catch (shareError: any) {
          // 사용자가 공유를 취소한 경우는 에러로 처리하지 않음
          if (shareError.name === 'AbortError') {
            return
          }
          // 공유 실패 시 클립보드로 폴백
          throw shareError
        }
      }
      
      // Web Share API를 지원하지 않는 경우 또는 공유 실패 시 클립보드에 복사
      if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
        const clipboard = (navigator as any).clipboard
        if (clipboard && clipboard.writeText) {
          await clipboard.writeText(urlToShare)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('Clipboard API not available')
        }
      } else {
        // 클립보드 API도 없는 경우 (매우 드묾) - 수동 복사를 위한 fallback
        const textArea = document.createElement('textarea')
        textArea.value = urlToShare
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (fallbackError) {
          throw new Error('링크 복사에 실패했습니다. 링크를 수동으로 복사해주세요: ' + urlToShare)
        } finally {
          document.body.removeChild(textArea)
        }
      }
    } catch (error: any) {
      console.error('Failed to share/copy link:', error)
      alert(error.message || '링크 복사에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleShare}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
        title={typeof navigator !== 'undefined' && 'share' in navigator ? '공유하기' : '링크 복사'}
      >
        {copied ? (
          <>
            ✓ 복사됨
          </>
        ) : (
          <>
            {typeof navigator !== 'undefined' && 'share' in navigator ? '🔗 공유' : '📋 링크 복사'}
          </>
        )}
      </button>
    </div>
  )
}


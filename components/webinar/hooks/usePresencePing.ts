'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Presence Ping Hook
 * 라이브 웨비나 페이지에서 주기적으로 presence ping을 전송
 * 
 * 특징:
 * - 2분(120초) 주기로 ping 전송
 * - ±10초 지터로 동시 폭주 방지
 * - 탭이 hidden이면 중지
 * - 페이지 언로드 시 마지막 ping 전송 (sendBeacon 사용)
 * - 클라이언트 측 중복 호출 방지 (60초)
 */
export function usePresencePing(webinarId: string | null) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPingRef = useRef<number>(0)
  const pathname = usePathname()

  // ping 전송 함수
  const sendPing = useCallback(async () => {
    if (!webinarId) return

    // 클라이언트 측 중복 방지: 60초 이내 재호출 방지
    const now = Date.now()
    if (now - lastPingRef.current < 60000) {
      return
    }

    try {
      const response = await fetch(`/api/webinars/${webinarId}/presence/ping`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        lastPingRef.current = now
      }
    } catch (error) {
      // 네트워크 오류는 조용히 무시 (재시도는 다음 주기에서)
      console.debug('[Presence Ping] 전송 실패:', error)
    }
  }, [webinarId])

  // 지터가 포함된 간격 계산 (120초 ± 10초)
  const getIntervalWithJitter = useCallback(() => {
    const baseInterval = 120000 // 120초
    const jitter = (Math.random() - 0.5) * 20000 // ±10초
    return baseInterval + jitter
  }, [])

  useEffect(() => {
    if (!webinarId) return

    // 초기 ping 전송
    sendPing()

    // 탭 visibility 체크
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 탭이 다시 보이면 즉시 ping 전송
        sendPing()
        // 주기적 ping 재개
        const interval = getIntervalWithJitter()
        intervalRef.current = setInterval(sendPing, interval)
      } else {
        // 탭이 hidden이면 ping 중지
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    // 페이지 언로드 시 마지막 ping 전송
    const handleBeforeUnload = () => {
      if (navigator.sendBeacon && webinarId) {
        // sendBeacon 사용 (비동기, 브라우저가 페이지를 닫아도 전송 보장)
        const url = `/api/webinars/${webinarId}/presence/ping`
        navigator.sendBeacon(url, '')
      } else {
        // sendBeacon 미지원 시 동기 요청 (느리지만 전송 보장)
        sendPing()
      }
    }

    // 주기적 ping 시작
    const interval = getIntervalWithJitter()
    intervalRef.current = setInterval(sendPing, interval)

    // 이벤트 리스너 등록
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)

    // cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [webinarId, sendPing, getIntervalWithJitter])

  // 경로 변경 시 cleanup (다른 페이지로 이동 시)
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [pathname])
}





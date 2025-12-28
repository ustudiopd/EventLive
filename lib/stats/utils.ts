/**
 * 통계 API 공통 유틸리티
 */

export interface StatsQueryParams {
  from?: string
  to?: string
  interval?: '5m' | '15m' | '1h'
}

export interface ParsedStatsParams {
  from: Date
  to: Date
  intervalSeconds: number
}

/**
 * 쿼리 파라미터 파싱 및 검증
 */
export function parseStatsParams(
  searchParams: URLSearchParams,
  webinarStartTime?: string | null,
  webinarEndTime?: string | null
): ParsedStatsParams {
  // interval 파싱
  const intervalParam = searchParams.get('interval') || '5m'
  const intervalMap: Record<string, number> = {
    '5m': 300,
    '15m': 900,
    '1h': 3600,
  }
  const intervalSeconds = intervalMap[intervalParam] || 300

  // from/to 파싱
  const now = new Date()
  let from: Date
  let to: Date

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam && toParam) {
    from = new Date(fromParam)
    to = new Date(toParam)
  } else if (webinarStartTime && webinarEndTime) {
    // 웨비나 시작~종료 시간 사용
    from = new Date(webinarStartTime)
    to = new Date(webinarEndTime)
  } else {
    // 기본값: 최근 24시간
    to = now
    from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }

  // 검증
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new Error('Invalid date format')
  }

  if (from >= to) {
    throw new Error('from must be before to')
  }

  // 최대 범위 제한 (31일 이상이면 interval 강제 상향)
  const daysDiff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 31) {
    // interval을 1h로 강제
    return {
      from,
      to,
      intervalSeconds: 3600,
    }
  }

  return {
    from,
    to,
    intervalSeconds,
  }
}





import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'
import { parseStatsParams } from '@/lib/stats/utils'

/**
 * 접속 통계 API
 * GET /api/webinars/[webinarId]/stats/access?from=&to=&interval=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { searchParams } = new URL(request.url)

    // 권한 확인
    const { hasPermission, webinar } = await checkWebinarStatsPermission(webinarId)
    if (!hasPermission || !webinar) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    const admin = createAdminSupabase()

    // 웨비나 정보 조회
    const { data: webinarInfo } = await admin
      .from('webinars')
      .select('start_time, end_time')
      .eq('id', webinarId)
      .single()

    // 쿼리 파라미터 파싱
    const { from, to } = parseStatsParams(
      searchParams,
      webinarInfo?.start_time,
      webinarInfo?.end_time
    )

    // 접속 로그 조회
    const { data: accessLogs } = await admin
      .from('webinar_access_logs')
      .select('*')
      .eq('webinar_id', webinarId)
      .gte('time_bucket', from.toISOString())
      .lt('time_bucket', to.toISOString())
      .order('time_bucket', { ascending: true })

    // 전체 최대/평균 동시접속 계산
    let maxConcurrentParticipants = 0
    let totalSum = 0
    let totalSamples = 0

    accessLogs?.forEach((log) => {
      if (log.max_participants > maxConcurrentParticipants) {
        maxConcurrentParticipants = log.max_participants
      }
      totalSum += log.sum_participants
      totalSamples += log.sample_count
    })

    const avgConcurrentParticipants =
      totalSamples > 0 ? totalSum / totalSamples : 0

    // 타임라인
    const timeline =
      accessLogs?.map((log) => ({
        time: log.time_bucket,
        avgParticipants:
          log.sample_count > 0 ? log.sum_participants / log.sample_count : 0,
        maxParticipants: log.max_participants,
        minParticipants: log.min_participants,
        lastParticipants: log.last_participants,
      })) || []

    // 피크 시간대
    const peakTimeEntry =
      accessLogs && accessLogs.length > 0
        ? accessLogs.reduce(
            (max, log) =>
              log.max_participants > max.max_participants ? log : max,
            accessLogs[0]
          )
        : null

    return NextResponse.json({
      success: true,
      data: {
        maxConcurrentParticipants,
        avgConcurrentParticipants: Math.round(avgConcurrentParticipants * 100) / 100,
        timeline,
        peakTime: peakTimeEntry
          ? {
              time: peakTimeEntry.time_bucket,
              participantCount: peakTimeEntry.max_participants,
            }
          : null,
      },
    })
  } catch (error: any) {
    console.error('[Stats Access] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





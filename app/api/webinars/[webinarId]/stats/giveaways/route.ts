import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'
import { parseStatsParams } from '@/lib/stats/utils'

/**
 * 추첨 통계 API
 * GET /api/webinars/[webinarId]/stats/giveaways?from=&to=&interval=
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
    const { from, to, intervalSeconds } = parseStatsParams(
      searchParams,
      webinarInfo?.start_time,
      webinarInfo?.end_time
    )

    // 기본 통계
    const { data: giveaways } = await admin
      .from('giveaways')
      .select('id, status')
      .eq('webinar_id', webinarId)

    const totalGiveaways = giveaways?.length || 0
    const drawnGiveaways = giveaways?.filter((g) => g.status === 'drawn').length || 0

    // 참여/당첨 요약
    const giveawayIds = giveaways?.map((g) => g.id) || []
    const { data: entries } =
      giveawayIds.length > 0
        ? await admin
            .from('giveaway_entries')
            .select('id, participant_id, created_at')
            .in('giveaway_id', giveawayIds)
            .gte('created_at', from.toISOString())
            .lt('created_at', to.toISOString())
        : { data: null }

    const totalEntries = entries?.length || 0
    const uniqueParticipants = new Set(entries?.map((e) => e.participant_id)).size

    // 타임라인
    const timelineMap = new Map<string, { entry_count: number; participant_count: Set<string> }>()
    entries?.forEach((entry) => {
      const bucketTime = new Date(entry.created_at)
      const bucketSeconds = Math.floor(bucketTime.getTime() / 1000 / intervalSeconds) * intervalSeconds
      const bucketKey = new Date(bucketSeconds * 1000).toISOString()

      if (!timelineMap.has(bucketKey)) {
        timelineMap.set(bucketKey, { entry_count: 0, participant_count: new Set() })
      }
      const bucket = timelineMap.get(bucketKey)!
      bucket.entry_count++
      bucket.participant_count.add(entry.participant_id)
    })

    const timeline = Array.from(timelineMap.entries())
      .map(([time_slot, data]) => ({
        time_slot,
        entry_count: data.entry_count,
        participant_count: data.participant_count.size,
      }))
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot))

    return NextResponse.json({
      success: true,
      data: {
        totalGiveaways,
        drawnGiveaways,
        totalEntries,
        uniqueParticipants,
        timeline,
      },
    })
  } catch (error: any) {
    console.error('[Stats Giveaways] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





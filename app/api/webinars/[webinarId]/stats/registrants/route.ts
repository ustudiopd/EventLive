import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'

/**
 * 등록자 통계 API
 * GET /api/webinars/[webinarId]/stats/registrants
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params

    // 권한 확인
    const { hasPermission, webinar } = await checkWebinarStatsPermission(webinarId)
    if (!hasPermission || !webinar) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    const admin = createAdminSupabase()

    // 기본 등록자 수
    const { count: totalRegistrants } = await admin
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('webinar_id', webinarId)

    // 등록 출처별 통계
    const { data: registrations } = await admin
      .from('registrations')
      .select('registered_via')
      .eq('webinar_id', webinarId)

    const sourceCounts = new Map<string, number>()
    registrations?.forEach((reg) => {
      const source = reg.registered_via || 'unknown'
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)
    })

    const registrationSources = Array.from(sourceCounts.entries()).map(
      ([source, count]) => ({
        source,
        count,
      })
    )

    // 최대 동시 접속자 (접속 로그 기반)
    const { data: maxAccessLog } = await admin
      .from('webinar_access_logs')
      .select('max_participants')
      .eq('webinar_id', webinarId)
      .order('max_participants', { ascending: false })
      .limit(1)
      .single()

    const maxConcurrentParticipants = maxAccessLog?.max_participants || 0

    return NextResponse.json({
      success: true,
      data: {
        totalRegistrants: totalRegistrants || 0,
        registrationSources,
        maxConcurrentParticipants,
      },
    })
  } catch (error: any) {
    console.error('[Stats Registrants] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





import { createAdminSupabase } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 크론: 웨비나 접속 스냅샷 수집
 * 
 * Vercel Cron에서 1분마다 호출
 * 활성 웨비나별 접속자 수를 집계하여 5분 버킷으로 누적
 * 
 * GET /api/cron/webinar-access-snapshot?secret=CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 자동 인증 (권장)
    // Vercel Cron은 자동으로 Authorization 헤더를 추가합니다
    const authHeader = request.headers.get('authorization')
    
    // 로컬 테스트용: 쿼리 파라미터로 secret 확인
    const secretParam = request.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    // Vercel Cron 자동 인증 또는 수동 secret 검증
    const isAuthorized = 
      authHeader === `Bearer ${process.env.CRON_SECRET}` || // Vercel Cron 자동 인증
      (secretParam && expectedSecret && secretParam === expectedSecret) // 로컬 테스트용

    if (!isAuthorized) {
      console.error('[Cron] 인증 실패')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = createAdminSupabase()

    // 1. cutoff = now - 3분 (활성 사용자 판정 기준)
    const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString()

    // 2. 활성 웨비나별 접속자 수 집계
    const { data: snapshots, error: rpcError } = await admin.rpc(
      'get_active_webinar_participant_counts',
      { _active_since: cutoff }
    )

    if (rpcError) {
      console.error('[Cron] get_active_webinar_participant_counts 오류:', rpcError)
      return NextResponse.json(
        { success: false, error: '집계 실패' },
        { status: 500 }
      )
    }

    // 활성 웨비나가 없으면 조기 종료
    if (!snapshots || snapshots.length === 0) {
      return new NextResponse(null, { status: 204 })
    }

    // 3. 결과를 jsonb array로 변환하여 배치 기록
    const snapshotsJsonb = snapshots.map((s: { webinar_id: string; participant_count: number }) => ({
      webinar_id: s.webinar_id,
      participant_count: s.participant_count,
    }))

    const sampledAt = new Date().toISOString()
    const { error: batchError } = await admin.rpc(
      'record_webinar_access_snapshot_batch',
      {
        _snapshots: snapshotsJsonb as any,
        _sampled_at: sampledAt,
      }
    )

    if (batchError) {
      console.error('[Cron] record_webinar_access_snapshot_batch 오류:', batchError)
      return NextResponse.json(
        { success: false, error: '기록 실패' },
        { status: 500 }
      )
    }

    // 성공: 204 No Content
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('[Cron] 예상치 못한 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류' },
      { status: 500 }
    )
  }
}





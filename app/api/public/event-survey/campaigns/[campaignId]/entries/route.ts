import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * 공개 대시보드용 참여자 목록 조회 API (전화번호 제외)
 * GET /api/public/event-survey/campaigns/[campaignId]/entries
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const admin = createAdminSupabase()

    // 캠페인 존재 확인
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('status', 'published')
      .maybeSingle()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // 참여자 목록 조회 (전화번호 뒷자리 4자리만 포함, 완료일시 순서로 정렬)
    const { data: entries, error: entriesError } = await admin
      .from('event_survey_entries')
      .select('id, survey_no, code6, name, company, phone_norm, completed_at, prize_label')
      .eq('campaign_id', campaignId)
      .order('completed_at', { ascending: false })

    if (entriesError) {
      console.error('참여자 목록 조회 오류:', entriesError)
      return NextResponse.json(
        { error: entriesError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      entries: entries || [],
    })
  } catch (error: any) {
    console.error('참여자 목록 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

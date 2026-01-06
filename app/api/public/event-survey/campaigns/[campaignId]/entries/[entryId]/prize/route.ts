import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * 공개 대시보드용 경품 기록 업데이트 API
 * PUT /api/public/event-survey/campaigns/[campaignId]/entries/[entryId]/prize
 * body: { prize_label: '1번 우산' | '2번 워시백' | null }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; entryId: string }> }
) {
  try {
    const { campaignId, entryId } = await params
    const { prize_label } = await req.json()

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

    // 참여자 존재 확인
    const { data: entry, error: entryError } = await admin
      .from('event_survey_entries')
      .select('id, campaign_id')
      .eq('id', entryId)
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (entryError || !entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      )
    }

    // 경품 기록 업데이트
    const updateData: any = {}
    if (prize_label) {
      updateData.prize_label = prize_label
      updateData.prize_recorded_at = new Date().toISOString()
    } else {
      // null이면 경품 기록 삭제
      updateData.prize_label = null
      updateData.prize_recorded_at = null
    }

    const { error: updateError } = await admin
      .from('event_survey_entries')
      .update(updateData)
      .eq('id', entryId)

    if (updateError) {
      console.error('경품 기록 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      prize_label: updateData.prize_label,
    })
  } catch (error: any) {
    console.error('경품 기록 업데이트 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

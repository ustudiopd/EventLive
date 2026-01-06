import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * 운영콘솔용 경품 기록 업데이트 API
 * PUT /api/event-survey/campaigns/[campaignId]/entries/[entryId]/prize
 * body: { prize_label: '우산' | '워시백' | null }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; entryId: string }> }
) {
  try {
    const { campaignId, entryId } = await params
    const { prize_label } = await req.json()

    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()

    // 캠페인 조회 및 권한 확인
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, client_id, agency_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    let hasPermission = false
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (clientMember && ['owner', 'admin', 'operator', 'analyst'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('role')
          .eq('agency_id', campaign.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
          hasPermission = true
        }
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
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
      updateData.prize_recorded_by = user.id
    } else {
      // null이면 경품 기록 삭제
      updateData.prize_label = null
      updateData.prize_recorded_at = null
      updateData.prize_recorded_by = null
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

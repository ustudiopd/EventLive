/**
 * Guideline Pack Publish API
 * POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/publish
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; guidelineId: string }> }
) {
  try {
    const { campaignId, guidelineId } = await params

    const admin = createAdminSupabase()

    // Guideline 조회
    const { data: guideline, error: guidelineError } = await admin
      .from('survey_analysis_guidelines')
      .select('id, campaign_id, status')
      .eq('id', guidelineId)
      .eq('campaign_id', campaignId)
      .single()

    if (guidelineError || !guideline) {
      return NextResponse.json(
        { error: 'Guideline not found', code: 'GUIDELINE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 권한 확인
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    let hasPermission = false

    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 캠페인 정보 조회
      const { data: campaign } = await admin
        .from('event_survey_campaigns')
        .select('client_id, agency_id')
        .eq('id', campaignId)
        .single()

      if (campaign) {
        // 클라이언트 멤버십 확인
        const { data: clientMember } = await supabase
          .from('client_members')
          .select('role')
          .eq('client_id', campaign.client_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (clientMember && ['owner', 'admin', 'operator', 'analyst'].includes(clientMember.role)) {
          hasPermission = true
        } else if (campaign.agency_id) {
          // 에이전시 멤버십 확인
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', campaign.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()

          if (agencyMember && ['owner', 'admin', 'analyst'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    // 기존 published Guideline을 archived로 변경
    const { error: archiveError } = await admin
      .from('survey_analysis_guidelines')
      .update({ status: 'archived' })
      .eq('campaign_id', campaignId)
      .eq('status', 'published')

    if (archiveError) {
      console.error('[publishGuideline] 기존 published 아카이브 실패:', archiveError)
      // 계속 진행 (unique constraint가 있으므로 실패해도 괜찮음)
    }

    // 해당 Guideline을 published로 변경
    const { data: published, error: publishError } = await admin
      .from('survey_analysis_guidelines')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', guidelineId)
      .select()
      .single()

    if (publishError) {
      console.error('[publishGuideline] Publish 실패:', publishError)
      return NextResponse.json(
        { error: 'Failed to publish guideline', code: 'PUBLISH_FAILED', details: publishError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      guideline: published,
    })
  } catch (error: any) {
    console.error('[publishGuideline] 오류:', error)
    return NextResponse.json(
      {
        error: 'Failed to publish guideline',
        code: 'PUBLISH_FAILED',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

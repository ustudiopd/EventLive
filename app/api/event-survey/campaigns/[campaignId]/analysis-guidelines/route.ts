/**
 * Guideline Pack 조회 API
 * GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // 'draft' | 'published' | null (all)

    const admin = createAdminSupabase()

    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, client_id, agency_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' },
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
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (clientMember && ['owner', 'admin', 'operator', 'analyst', 'viewer'].includes(clientMember.role)) {
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

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    // Guideline 목록 조회
    let query = admin
      .from('survey_analysis_guidelines')
      .select('id, status, version_int, title, description, form_fingerprint, created_at, updated_at, published_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: guidelines, error: guidelinesError } = await query

    if (guidelinesError) {
      console.error('[getGuidelines] 조회 실패:', guidelinesError)
      return NextResponse.json(
        { error: 'Failed to fetch guidelines', code: 'FETCH_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      guidelines: guidelines || [],
    })
  } catch (error: any) {
    console.error('[getGuidelines] 오류:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch guidelines',
        code: 'FETCH_FAILED',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

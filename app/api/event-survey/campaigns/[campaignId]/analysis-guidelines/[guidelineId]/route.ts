/**
 * Guideline Pack 단건 조회/수정 API
 * GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]
 * PATCH /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { GuidelinePackSchema } from '@/lib/surveys/analysis/guidelinePackSchema'
import { lintGuidelinePack } from '@/lib/surveys/analysis/lintGuidelinePack'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; guidelineId: string }> }
) {
  try {
    const { campaignId, guidelineId } = await params

    const admin = createAdminSupabase()

    // Guideline 조회
    const { data: guideline, error: guidelineError } = await admin
      .from('survey_analysis_guidelines')
      .select('*')
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
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      guideline,
    })
  } catch (error: any) {
    console.error('[getGuideline] 오류:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch guideline',
        code: 'FETCH_FAILED',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; guidelineId: string }> }
) {
  try {
    const { campaignId, guidelineId } = await params
    const body = await req.json()

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

    // 업데이트할 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (body.title !== undefined) {
      updateData.title = body.title
    }

    if (body.description !== undefined) {
      updateData.description = body.description
    }

    if (body.guideline_pack !== undefined) {
      // Zod 검증
      try {
        const validated = GuidelinePackSchema.parse(body.guideline_pack)
        
        // Lint 검증
        const lintResult = lintGuidelinePack(validated)
        
        if (!lintResult.isValid) {
          const errors = lintResult.warnings.filter((w) => w.level === 'error')
          if (errors.length > 0) {
            return NextResponse.json(
              {
                error: 'Guideline validation failed',
                code: 'VALIDATION_FAILED',
                lint: lintResult,
              },
              { status: 400 }
            )
          }
        }

        updateData.guideline_pack = validated
      } catch (error: any) {
        if (error.issues) {
          return NextResponse.json(
            {
              error: 'Schema validation failed',
              code: 'SCHEMA_VALIDATION_FAILED',
              details: error.issues,
            },
            { status: 400 }
          )
        }
        throw error
      }
    }

    // 업데이트
    const { data: updated, error: updateError } = await admin
      .from('survey_analysis_guidelines')
      .update(updateData)
      .eq('id', guidelineId)
      .select()
      .single()

    if (updateError) {
      console.error('[updateGuideline] 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: 'Failed to update guideline', code: 'UPDATE_FAILED', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      guideline: updated,
    })
  } catch (error: any) {
    console.error('[updateGuideline] 오류:', error)
    return NextResponse.json(
      {
        error: 'Failed to update guideline',
        code: 'UPDATE_FAILED',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

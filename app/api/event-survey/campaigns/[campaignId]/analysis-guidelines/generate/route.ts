/**
 * Guideline Pack 생성 API
 * POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/generate
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { buildSurveyBlueprint } from '@/lib/surveys/analysis/buildSurveyBlueprint'
import { buildFormFingerprint } from '@/lib/surveys/analysis/buildFormFingerprint'
import { generateGuidelinePackWithRetry } from '@/lib/surveys/analysis/generateGuidelinePack'
import { lintGuidelinePack } from '@/lib/surveys/analysis/lintGuidelinePack'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { mode = 'fresh', title } = await req.json().catch(() => ({
      mode: 'fresh',
      title: undefined,
    }))

    const admin = createAdminSupabase()

    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, title, client_id, agency_id, form_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!campaign.form_id) {
      return NextResponse.json(
        { error: 'Campaign has no form', code: 'NO_FORM' },
        { status: 400 }
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

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    // 폼 문항 조회
    const { data: questions, error: questionsError } = await admin
      .from('form_questions')
      .select('id, order_no, body, type, options')
      .eq('form_id', campaign.form_id)
      .order('order_no', { ascending: true })

    if (questionsError || !questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions found', code: 'NO_QUESTIONS' },
        { status: 400 }
      )
    }

    // Survey Blueprint 생성
    const blueprint = buildSurveyBlueprint(campaign.form_id, questions)

    // Form Fingerprint 생성
    const formFingerprint = buildFormFingerprint({
      questions: blueprint.questions.map((q) => ({
        id: q.id,
        order_no: q.orderNo,
        body: q.body,
        type: q.type,
        options: q.options,
      })),
    })

    // Guideline Pack 생성
    const guidelinePack = await generateGuidelinePackWithRetry(
      blueprint,
      formFingerprint
    )

    // Lint 검증
    const lintResult = lintGuidelinePack(guidelinePack)

    // DB 저장 (draft)
    const { data: guideline, error: insertError } = await admin
      .from('survey_analysis_guidelines')
      .insert({
        campaign_id: campaignId,
        form_id: campaign.form_id,
        status: 'draft',
        version_int: 1,
        title: title || `Guideline ${new Date().toISOString()}`,
        form_fingerprint: formFingerprint,
        guideline_pack: guidelinePack,
        agency_id: campaign.agency_id,
        client_id: campaign.client_id,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[generateGuideline] DB 저장 실패:', insertError)
      return NextResponse.json(
        { error: 'Failed to save guideline', code: 'SAVE_FAILED', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      guideline: {
        id: guideline.id,
        status: guideline.status,
        version_int: guideline.version_int,
        form_fingerprint: guideline.form_fingerprint,
        guideline_pack: guideline.guideline_pack,
        lint: lintResult,
      },
    })
  } catch (error: any) {
    console.error('[generateGuideline] 오류:', error)
    return NextResponse.json(
      {
        error: 'Guideline generation failed',
        code: 'GENERATION_FAILED',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

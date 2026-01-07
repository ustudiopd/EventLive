/**
 * Guideline Pack Publish API
 * POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/publish
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { compileGuideline } from '@/lib/surveys/analysis/compileGuideline'
import { GuidelinePackSchema } from '@/lib/surveys/analysis/guidelinePackSchema'
import { inferQuestionRoles } from '@/lib/surveys/analysis/roleInference'
import { normalizeQuestions } from '@/lib/surveys/analysis/utils/normalizeQuestions'

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

    // Guideline Pack 조회 및 Compile 수행
    const { data: guidelineFull, error: guidelineFullError } = await admin
      .from('survey_analysis_guidelines')
      .select('*, form_id')
      .eq('id', guidelineId)
      .single()

    if (guidelineFullError || !guidelineFull) {
      return NextResponse.json(
        { error: 'Guideline not found', code: 'GUIDELINE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 현재 폼 문항 조회 및 Compile
    const { data: questions } = await admin
      .from('form_questions')
      .select('id, body, type, options, order_no, analysis_role_override, revision')
      .eq('form_id', guidelineFull.form_id)
      .order('order_no', { ascending: true })

    let compiledConfig = null
    if (questions && questions.length > 0) {
      const normalizedQuestions = normalizeQuestions(questions)
      const questionsWithRoles = inferQuestionRoles(
        questions.map((q: any) => ({
          id: q.id,
          body: q.body,
          type: q.type,
          options: normalizedQuestions.find((nq) => nq.id === q.id)?.options,
          analysis_role_override: q.analysis_role_override || null,
        }))
      )

      const guidelinePack = GuidelinePackSchema.parse(guidelineFull.guideline_pack)
      const currentFormRevision = questions[0]?.revision || 1

      const compileResult = compileGuideline(
        guidelinePack,
        questionsWithRoles,
        currentFormRevision
      )

      if (compileResult.success && compileResult.compiled) {
        compiledConfig = compileResult.compiled
        console.log('[publishGuideline] Compile 완료:', {
          compiledQuestionCount: compileResult.compiled.questionMap.length,
          warnings: compileResult.warnings,
        })
      } else {
        console.warn('[publishGuideline] Compile 실패:', {
          errors: compileResult.errors,
          warnings: compileResult.warnings,
        })
      }
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

    // 해당 Guideline을 published로 변경 (compiled config 포함)
    const updateData: any = {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (compiledConfig) {
      updateData.guideline_pack_compiled = compiledConfig
    }

    const { data: published, error: publishError } = await admin
      .from('survey_analysis_guidelines')
      .update(updateData)
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

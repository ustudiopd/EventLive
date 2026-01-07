import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { validateGuidelinePack } from '@/lib/surveys/analysis/validateGuideline'
import { buildFormFingerprint } from '@/lib/surveys/analysis/buildFormFingerprint'
import { GuidelinePackSchema } from '@/lib/surveys/analysis/guidelinePackSchema'

export const runtime = 'nodejs'

/**
 * Guideline 검증 API
 * POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/validate
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; guidelineId: string }> }
) {
  try {
    const { campaignId, guidelineId } = await params
    const { user } = await requireAuth()
    const admin = createAdminSupabase()

    // 1. Guideline 조회
    const { data: guideline, error: guidelineError } = await admin
      .from('survey_analysis_guidelines')
      .select('*')
      .eq('id', guidelineId)
      .eq('campaign_id', campaignId)
      .single()

    if (guidelineError || !guideline) {
      return NextResponse.json(
        { error: 'Guideline not found' },
        { status: 404 }
      )
    }

    // 2. 현재 폼 Fingerprint 계산
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('id, campaign_id')
      .eq('id', guideline.form_id)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    const { data: questions } = await admin
      .from('form_questions')
      .select('id, body, type, options, order_no')
      .eq('form_id', form.id)
      .order('order_no', { ascending: true })

    const currentFingerprint = buildFormFingerprint({
      questions: (questions || []).map((q: any) => ({
        id: q.id,
        order_no: q.order_no,
        body: q.body,
        type: q.type,
        options: q.options,
      })),
    })

    // 3. Guideline Pack 파싱
    const guidelinePack = GuidelinePackSchema.parse(guideline.guideline_pack)

    // 4. 검증 수행
    const validationResult = validateGuidelinePack(guidelinePack, currentFingerprint)

    return NextResponse.json({
      success: true,
      ...validationResult,
      currentFormFingerprint: currentFingerprint,
      guidelineFormFingerprint: guideline.form_fingerprint,
      fingerprintMatch: currentFingerprint === guideline.form_fingerprint,
    })
  } catch (error: any) {
    console.error('Guideline 검증 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

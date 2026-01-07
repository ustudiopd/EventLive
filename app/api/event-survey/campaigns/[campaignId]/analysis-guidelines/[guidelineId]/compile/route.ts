import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { compileGuideline } from '@/lib/surveys/analysis/compileGuideline'
import { GuidelinePackSchema } from '@/lib/surveys/analysis/guidelinePackSchema'
import { inferQuestionRoles } from '@/lib/surveys/analysis/roleInference'
import { normalizeQuestions } from '@/lib/surveys/analysis/utils/normalizeQuestions'

export const runtime = 'nodejs'

/**
 * Guideline Compile API
 * POST /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/compile
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

    // 2. 현재 폼 문항 조회
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('id')
      .eq('id', guideline.form_id)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    const { data: questions, error: questionsError } = await admin
      .from('form_questions')
      .select('id, body, type, options, order_no, analysis_role_override')
      .eq('form_id', form.id)
      .order('order_no', { ascending: true })

    if (questionsError || !questions) {
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      )
    }

    // 3. 문항 정규화 및 역할 추정
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

    // 4. Guideline Pack 파싱
    const guidelinePack = GuidelinePackSchema.parse(guideline.guideline_pack)

    // 5. 현재 폼 revision 조회 (최신 revision)
    const { data: latestQuestion } = await admin
      .from('form_questions')
      .select('revision')
      .eq('form_id', form.id)
      .order('revision', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentFormRevision = latestQuestion?.revision || 1

    // 6. Compile 수행
    const compileResult = compileGuideline(
      guidelinePack,
      questionsWithRoles,
      currentFormRevision
    )

    // 7. Compiled config 저장 (선택적)
    if (compileResult.success && compileResult.compiled) {
      const { error: updateError } = await admin
        .from('survey_analysis_guidelines')
        .update({
          guideline_pack_compiled: compileResult.compiled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guidelineId)

      if (updateError) {
        console.error('[compileGuideline] Compiled config 저장 실패:', updateError)
        // 저장 실패는 경고만 하고 계속 진행
      }
    }

    return NextResponse.json({
      success: compileResult.success,
      compiled: compileResult.compiled,
      warnings: compileResult.warnings,
      errors: compileResult.errors,
    })
  } catch (error: any) {
    console.error('Guideline Compile 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

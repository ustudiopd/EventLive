/**
 * Guideline Pack 다운로드 API (Markdown)
 * GET /api/event-survey/campaigns/[campaignId]/analysis-guidelines/[guidelineId]/download.md
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { renderGuidelinePackMD } from '@/lib/surveys/analysis/renderGuidelinePackMD'
import { normalizeQuestions } from '@/lib/surveys/analysis/utils/normalizeQuestions'

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

    // 폼 문항 조회 (본문 및 선택지 정보 포함)
    const { data: questions } = await admin
      .from('form_questions')
      .select('id, order_no, body, type, options')
      .eq('form_id', guideline.form_id)
      .order('order_no', { ascending: true })

    // 문항 정보를 Map으로 변환 (questionId로 빠른 조회)
    const questionsMap = new Map()
    if (questions) {
      questions.forEach((q) => {
        const normalized = normalizeQuestions([q])
        if (normalized.length > 0) {
          questionsMap.set(q.id, {
            body: q.body,
            type: q.type,
            options: normalized[0].options || [],
          })
        }
      })
    }

    // Markdown 생성
    const markdown = renderGuidelinePackMD(guideline, questionsMap)

    // 파일명 생성
    const fileName = `guideline-${guidelineId.substring(0, 8)}-${new Date(guideline.created_at).toISOString().split('T')[0]}.md`

    // Response 반환
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('[downloadGuideline] 오류:', error)
    return NextResponse.json(
      {
        error: 'Failed to download guideline',
        code: 'DOWNLOAD_FAILED',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

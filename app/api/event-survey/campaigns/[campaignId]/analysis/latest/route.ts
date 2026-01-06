/**
 * 최신 분석 리포트 조회 API
 * GET /api/event-survey/campaigns/[campaignId]/analysis/latest
 * 
 * 구현 명세서 v1.0: UI에서 "가장 최신 리포트"를 빠르게 로드하는 용도
 */

import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/guards'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { searchParams } = new URL(req.url)
    const lens = searchParams.get('lens') || 'general'

    // 인증 확인
    const { user } = await requireAuth()
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

    // 권한 확인 (간단한 버전 - 필요시 확장)
    const { data: profile } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    let hasPermission = false
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // Client 또는 Agency 멤버 확인
      const { data: clientMember } = await admin
        .from('client_members')
        .select('role')
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (clientMember) {
        hasPermission = true
      } else {
        const { data: agencyMember } = await admin
          .from('agency_members')
          .select('role')
          .eq('agency_id', campaign.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (agencyMember) {
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

    // 최신 리포트 조회
    const { data: report, error: reportError } = await admin
      .from('survey_analysis_reports')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('lens', lens)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reportError) {
      console.error('[latest] 리포트 조회 오류:', reportError)
      return NextResponse.json(
        { error: reportError.message || 'Failed to fetch report' },
        { status: 500 }
      )
    }

    if (!report) {
      return NextResponse.json(
        { error: 'No report found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        campaign_id: report.campaign_id,
        analyzed_at: report.analyzed_at,
        sample_count: report.sample_count,
        total_questions: report.total_questions,
        lens: report.lens,
        report_title: report.report_title,
        summary: report.summary,
        analysis_pack: report.analysis_pack,
        decision_pack: report.decision_pack,
        report_md: report.report_md,
        generation_warnings: report.generation_warnings,
      },
    })
  } catch (error: any) {
    console.error('[latest] API 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

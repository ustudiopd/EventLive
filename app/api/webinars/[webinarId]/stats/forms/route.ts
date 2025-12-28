import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'
import { parseStatsParams } from '@/lib/stats/utils'

/**
 * 폼/퀴즈 통계 API
 * GET /api/webinars/[webinarId]/stats/forms?from=&to=&interval=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { searchParams } = new URL(request.url)

    // 권한 확인
    const { hasPermission, webinar } = await checkWebinarStatsPermission(webinarId)
    if (!hasPermission || !webinar) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    const admin = createAdminSupabase()

    // 웨비나 정보 조회
    const { data: webinarInfo } = await admin
      .from('webinars')
      .select('start_time, end_time')
      .eq('id', webinarId)
      .single()

    // 쿼리 파라미터 파싱
    const { from, to } = parseStatsParams(
      searchParams,
      webinarInfo?.start_time,
      webinarInfo?.end_time
    )

    // 웨비나 레벨 요약
    const { data: forms } = await admin
      .from('forms')
      .select('id, kind')
      .eq('webinar_id', webinarId)

    const totalSurveys = forms?.filter((f) => f.kind === 'survey').length || 0
    const totalQuizzes = forms?.filter((f) => f.kind === 'quiz').length || 0

    // 설문 제출 통계
    const surveyFormIds = forms?.filter((f) => f.kind === 'survey').map((f) => f.id) || []
    const { data: surveySubmissions } =
      surveyFormIds.length > 0
        ? await admin
            .from('form_submissions')
            .select('id, participant_id')
            .in('form_id', surveyFormIds)
            .gte('submitted_at', from.toISOString())
            .lt('submitted_at', to.toISOString())
        : { data: null }

    const totalSubmissions = surveySubmissions?.length || 0
    const uniqueRespondents = new Set(surveySubmissions?.map((s) => s.participant_id)).size

    // 퀴즈 시도 통계
    const quizFormIds = forms?.filter((f) => f.kind === 'quiz').map((f) => f.id) || []
    const { data: quizAttempts } =
      quizFormIds.length > 0
        ? await admin
            .from('quiz_attempts')
            .select('id, participant_id, total_score')
            .in('form_id', quizFormIds)
            .gte('submitted_at', from.toISOString())
            .lt('submitted_at', to.toISOString())
        : { data: null }

    const totalAttempts = quizAttempts?.length || 0
    const uniqueParticipants = new Set(quizAttempts?.map((a) => a.participant_id)).size

    const scores = quizAttempts?.map((a) => a.total_score) || []
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0
    const minScore = scores.length > 0 ? Math.min(...scores) : 0

    return NextResponse.json({
      success: true,
      data: {
        totalSurveys,
        totalQuizzes,
        survey: {
          totalSubmissions,
          uniqueRespondents,
        },
        quiz: {
          totalAttempts,
          uniqueParticipants,
          avgScore: Math.round(avgScore * 100) / 100,
          maxScore,
          minScore,
        },
      },
    })
  } catch (error: any) {
    console.error('[Stats Forms] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'
import { parseStatsParams } from '@/lib/stats/utils'

/**
 * Q&A 통계 API
 * GET /api/webinars/[webinarId]/stats/qa?from=&to=&interval=
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
    const { from, to, intervalSeconds } = parseStatsParams(
      searchParams,
      webinarInfo?.start_time,
      webinarInfo?.end_time
    )

    // 기본 통계
    const { data: questions } = await admin
      .from('questions')
      .select('id, user_id, answered_at, created_at')
      .eq('webinar_id', webinarId)
      .neq('status', 'hidden')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())

    const totalQuestions = questions?.length || 0
    const answeredQuestions = questions?.filter((q) => q.answered_at).length || 0
    const uniqueQuestioners = new Set(questions?.map((q) => q.user_id)).size

    // 답변 시간 계산
    const answeredQuestionsWithTime = questions?.filter((q) => q.answered_at) || []
    const answerTimes = answeredQuestionsWithTime.map((q) => {
      const created = new Date(q.created_at).getTime()
      const answered = new Date(q.answered_at!).getTime()
      return (answered - created) / 1000 / 60 // 분 단위
    })

    const avgMinutes = answerTimes.length > 0
      ? answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length
      : 0
    const minMinutes = answerTimes.length > 0 ? Math.min(...answerTimes) : 0
    const maxMinutes = answerTimes.length > 0 ? Math.max(...answerTimes) : 0

    // 타임라인
    const timelineMap = new Map<string, { question_count: number; answered_count: number }>()
    questions?.forEach((q) => {
      const bucketTime = new Date(q.created_at)
      const bucketSeconds = Math.floor(bucketTime.getTime() / 1000 / intervalSeconds) * intervalSeconds
      const bucketKey = new Date(bucketSeconds * 1000).toISOString()

      if (!timelineMap.has(bucketKey)) {
        timelineMap.set(bucketKey, { question_count: 0, answered_count: 0 })
      }
      const bucket = timelineMap.get(bucketKey)!
      bucket.question_count++
      if (q.answered_at) {
        bucket.answered_count++
      }
    })

    const timeline = Array.from(timelineMap.entries())
      .map(([time_slot, data]) => ({
        time_slot,
        question_count: data.question_count,
        answered_count: data.answered_count,
      }))
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot))

    // Top questioners
    const questionerCounts = new Map<string, { count: number; user_id: string }>()
    questions?.forEach((q) => {
      const current = questionerCounts.get(q.user_id) || { count: 0, user_id: q.user_id }
      questionerCounts.set(q.user_id, { ...current, count: current.count + 1 })
    })

    const topQuestionersData = Array.from(questionerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 닉네임 조회
    const userIds = topQuestionersData.map((q) => q.user_id)
    const [registrationsData, profilesData] = await Promise.all([
      admin
        .from('registrations')
        .select('user_id, nickname')
        .eq('webinar_id', webinarId)
        .in('user_id', userIds),
      admin
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds),
    ])

    const nicknameMap = new Map<string, string>()
    registrationsData.data?.forEach((r) => {
      if (r.nickname) nicknameMap.set(r.user_id, r.nickname)
    })
    profilesData.data?.forEach((p) => {
      if (p.nickname && !nicknameMap.has(p.id)) {
        nicknameMap.set(p.id, p.nickname)
      }
    })

    const topQuestioners = topQuestionersData.map((questioner) => ({
      user_id: questioner.user_id,
      nickname: nicknameMap.get(questioner.user_id) || '익명',
      question_count: questioner.count,
    }))

    // 답변 시간 분포
    const timeRanges = [
      { label: '5분 이내', max: 5 },
      { label: '10분 이내', max: 10 },
      { label: '30분 이내', max: 30 },
      { label: '1시간 이내', max: 60 },
      { label: '1시간 이상', max: Infinity },
    ]

    const answerTimeDistribution = timeRanges.map((range) => {
      const count = answerTimes.filter((t) => t <= range.max).length
      return {
        range: range.label,
        count,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalQuestions,
        answeredQuestions,
        uniqueQuestioners,
        answerTime: {
          avgMinutes: Math.round(avgMinutes * 100) / 100,
          minMinutes: Math.round(minMinutes * 100) / 100,
          maxMinutes: Math.round(maxMinutes * 100) / 100,
        },
        timeline,
        topQuestioners,
        answerTimeDistribution,
      },
    })
  } catch (error: any) {
    console.error('[Stats QA] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





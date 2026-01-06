/**
 * Analysis Pack 생성 함수
 * 서버에서 생성하는 기초 분석팩 (Deterministic)
 * 문항이 바뀌어도 동일한 구조로 생성
 * 
 * 구현 명세서 v1.0에 따른 개선:
 * - 정규화 모듈 사용 (normalizeQuestions, normalizeAnswers)
 * - Role 추정 모듈 사용 (roleInference)
 * - 안전한 통계 계산 (statsMath)
 */

import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  buildCrosstabs,
  buildLeadSignals,
  buildDataQuality,
  buildCrosstabHighlights,
  buildEvidenceCatalog,
} from './buildComputedMetrics'
import type { AnalysisPack } from './analysisPackSchema'
import { normalizeQuestions, normalizeQuestion } from './utils/normalizeQuestions'
import { normalizeAnswers } from './utils/normalizeAnswers'
import { inferQuestionRoles, type QuestionWithRole } from './roleInference'
import { safePercentage } from './utils/statsMath'

interface Question {
  id: string
  order_no: number
  body: string
  type: 'single' | 'multiple' | 'text'
  options?: any[]
  role?: 'timeframe' | 'project_type' | 'followup_intent' | 'other'
  analysis_role_override?: string | null
}

interface Answer {
  submission_id: string
  question_id: string
  choice_ids?: string[]
  text_answer?: string
  answer_value?: string
}

interface Submission {
  id: string
  [key: string]: any
}

/**
 * Analysis Pack 생성
 * @param campaignId 캠페인 ID
 * @returns Analysis Pack (ap-1.0)
 */
export async function buildAnalysisPack(
  campaignId: string,
  campaign?: { id: string; title: string; form_id: string | null }
): Promise<AnalysisPack> {
  const admin = createAdminSupabase()

  // 1. 캠페인 정보 조회 (이미 조회된 경우 재사용)
  let campaignData = campaign
  if (!campaignData) {
    const { data: fetchedCampaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, title, form_id')
      .eq('id', campaignId)
      .single()

    if (campaignError || !fetchedCampaign) {
      console.error('[buildAnalysisPack] 캠페인 조회 실패:', campaignError)
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    campaignData = fetchedCampaign
  }

  console.log('[buildAnalysisPack] 캠페인 정보:', {
    campaignId,
    formId: campaignData.form_id,
    title: campaignData.title,
  })

  if (!campaignData.form_id) {
    throw new Error(`Campaign has no form assigned: ${campaignId}`)
  }

  // 2. 문항 조회 (analysis_role_override 포함)
  const { data: questions, error: questionsError } = await admin
    .from('form_questions')
    .select('*, analysis_role_override')
    .eq('form_id', campaignData.form_id)
    .order('order_no', { ascending: true })

  console.log('[buildAnalysisPack] 문항 조회 결과:', {
    formId: campaignData.form_id,
    questionsCount: questions?.length || 0,
    questionsError: questionsError?.message,
    questionIds: questions?.map((q: any) => q.id),
  })

  if (questionsError) {
    console.error('[buildAnalysisPack] 문항 조회 에러:', questionsError)
    throw new Error(`Failed to fetch questions: ${questionsError.message}`)
  }

  if (!questions || questions.length === 0) {
    console.error('[buildAnalysisPack] 문항이 없음:', {
      campaignId,
      formId: campaignData.form_id,
    })
    throw new Error(`No questions found for campaign: ${campaignId} (form_id: ${campaignData.form_id})`)
  }

  // 2-1. 문항 정규화 및 역할 추정 (구현 명세서 v1.0)
  let normalizedQuestions: ReturnType<typeof normalizeQuestions>
  let questionsWithRoleData: ReturnType<typeof inferQuestionRoles>
  let questionsWithRole: Question[]

  try {
    normalizedQuestions = normalizeQuestions(questions)
    console.log('[buildAnalysisPack] 문항 정규화 완료:', {
      count: normalizedQuestions.length,
      sample: normalizedQuestions[0] ? {
        id: normalizedQuestions[0].id,
        optionsCount: normalizedQuestions[0].options.length,
      } : null,
    })

    questionsWithRoleData = inferQuestionRoles(
      questions.map((q: any) => ({
        id: q.id,
        body: q.body,
        type: q.type,
        options: normalizedQuestions.find((nq) => nq.id === q.id)?.options,
        analysis_role_override: q.analysis_role_override || null, // 컬럼이 없을 경우 null
      }))
    )
    console.log('[buildAnalysisPack] 역할 추정 완료:', {
      count: questionsWithRoleData.length,
      roles: questionsWithRoleData.map((q) => ({ id: q.id, role: q.role, source: q.roleSource })),
    })

    // 기존 인터페이스와 호환되도록 변환
    questionsWithRole = questionsWithRoleData.map((qwr) => ({
      id: qwr.id,
      order_no: questions.find((q: any) => q.id === qwr.id)?.order_no || 0,
      body: qwr.body,
      type: qwr.type,
      options: qwr.options,
      role: qwr.role,
    }))
  } catch (error: any) {
    console.error('[buildAnalysisPack] 문항 정규화/역할 추정 오류:', error)
    throw new Error(`문항 처리 실패: ${error.message || '알 수 없는 오류'}`)
  }

  // 3. 응답 조회 (event_survey_entries를 통해)
  const { data: entries, error: entriesError } = await admin
    .from('event_survey_entries')
    .select('form_submission_id')
    .eq('campaign_id', campaignId)
    .not('form_submission_id', 'is', null)

  if (entriesError) {
    throw new Error(`Failed to fetch entries: ${entriesError.message}`)
  }

  const submissionIds = entries?.map((e: any) => e.form_submission_id).filter(Boolean) || []

  if (submissionIds.length === 0) {
    throw new Error(`No submissions found for campaign: ${campaignId}`)
  }

  // 3-1. Submission 조회 (buildCrosstabs, buildLeadSignals에 필요)
  const { data: submissions, error: submissionsError } = await admin
    .from('form_submissions')
    .select('id')
    .in('id', submissionIds)

  if (submissionsError) {
    throw new Error(`Failed to fetch submissions: ${submissionsError.message}`)
  }

  // 4. 답변 조회 (기존 파이프라인과 동일하게 select('*') 사용)
  const { data: answers, error: answersError } = await admin
    .from('form_answers')
    .select('*')
    .in('submission_id', submissionIds)

  if (answersError) {
    throw new Error(`Failed to fetch answers: ${answersError.message}`)
  }

  // 4-1. 답변 정규화 (구현 명세서 v1.0)
  let normalizedAnswers: ReturnType<typeof normalizeAnswers> = []
  let answersArray: Answer[] = []

  try {
    normalizedAnswers = normalizeAnswers(answers || [])
    console.log('[buildAnalysisPack] 답변 정규화 완료:', {
      count: normalizedAnswers.length,
      sample: normalizedAnswers[0] ? {
        submissionId: normalizedAnswers[0].submissionId,
        questionId: normalizedAnswers[0].questionId,
        choiceIdsCount: normalizedAnswers[0].choiceIds.length,
        hasTextAnswer: !!normalizedAnswers[0].textAnswer,
      } : null,
    })

    // 정규화된 답변이 없으면 에러
    if (normalizedAnswers.length === 0) {
      throw new Error(`정규화된 답변이 없습니다. 원본 답변 수: ${answers?.length || 0}`)
    }

    // 기존 인터페이스와 호환되도록 변환
    answersArray = normalizedAnswers
      .filter((na) => na.submissionId && na.questionId) // 빈 값 필터링
      .map((na) => ({
        submission_id: na.submissionId,
        question_id: na.questionId,
        choice_ids: na.choiceIds.length > 0 ? na.choiceIds : undefined,
        text_answer: na.textAnswer || undefined,
      }))
    
    console.log('[buildAnalysisPack] 답변 변환 완료:', {
      originalCount: answers?.length || 0,
      normalizedCount: normalizedAnswers.length,
      filteredCount: answersArray.length,
    })

    // 변환된 답변이 없으면 에러
    if (answersArray.length === 0) {
      throw new Error(`유효한 답변이 없습니다. 정규화된 답변 수: ${normalizedAnswers.length}`)
    }
  } catch (error: any) {
    console.error('[buildAnalysisPack] 답변 정규화 오류:', {
      error: error.message,
      stack: error.stack,
      answersCount: answers?.length || 0,
      normalizedAnswersCount: normalizedAnswers.length,
      answersArrayCount: answersArray.length,
    })
    throw new Error(`답변 처리 실패: ${error.message || '알 수 없는 오류'}`)
  }

  // 5. 문항별 통계 계산 (정규화된 데이터 사용)
  const questionStats: any[] = []
  for (const normalizedQ of normalizedQuestions) {
    const qWithRole = questionsWithRoleData.find((q) => q.id === normalizedQ.id)
    const role = qWithRole?.role || 'other'

    const questionAnswers = normalizedAnswers.filter((a) => a.questionId === normalizedQ.id)

    const stats: any = {
      questionId: normalizedQ.id,
      orderNo: normalizedQ.orderNo,
      questionBody: normalizedQ.body,
      questionType: normalizedQ.type,
      totalAnswers: questionAnswers.length,
      options: normalizedQ.options,
      choiceDistribution: {},
      textAnswers: [],
      role,
    }

    if (normalizedQ.type === 'text') {
      // 텍스트 답변: 빈 값 제거 후 배열
      // 구현 명세서 v1.0: 전체를 저장하되, 프롬프트에는 샘플링(최대 50개)
      const allTextAnswers = questionAnswers
        .map((a) => a.textAnswer)
        .filter((text): text is string => text !== null && text.trim().length > 0)
      
      stats.textAnswers = allTextAnswers
      stats.textAnswerCount = allTextAnswers.length
      // 샘플링: 최대 50개 (랜덤 또는 최근순)
      stats.textAnswerSamples = allTextAnswers
        .sort(() => Math.random() - 0.5) // 랜덤 샘플링
        .slice(0, 50)
    } else if (normalizedQ.type === 'single' || normalizedQ.type === 'multiple') {
      // 선택형: 분포 계산
      const distribution: Record<string, number> = {}
      questionAnswers.forEach((answer) => {
        answer.choiceIds.forEach((choiceId: string) => {
          distribution[choiceId] = (distribution[choiceId] || 0) + 1
        })
      })
      stats.choiceDistribution = distribution

      // Top choices 계산 (안전한 백분율 계산 사용)
      const topChoices = Object.entries(distribution)
        .map(([choiceId, count]) => {
          const option = normalizedQ.options.find((opt) => opt.id === choiceId)
          return {
            text: option ? option.text : choiceId,
            count,
            percentage: safePercentage(count, questionAnswers.length || 1),
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      stats.topChoices = topChoices
      stats.analysis = {
        summary_chart: normalizedQ.orderNo <= 6,
      }
    }

    questionStats.push(stats)
  }

  // 6. 교차표 생성

  // submissions가 null일 수 있으므로 안전하게 처리
  const submissionsArray: Submission[] = (submissions || []).map((s) => ({ id: s.id }))

  console.log('[buildAnalysisPack] 교차표 생성 시작:', {
    questionsCount: questionsWithRole.length,
    answersCount: answersArray.length,
    submissionsCount: submissionsArray.length,
  })

  let crosstabs: ReturnType<typeof buildCrosstabs>
  try {
    crosstabs = buildCrosstabs(
      questionsWithRole,
      answersArray,
      submissionsArray
    )
    console.log('[buildAnalysisPack] 교차표 생성 완료:', {
      crosstabsCount: crosstabs.length,
    })
  } catch (error: any) {
    console.error('[buildAnalysisPack] 교차표 생성 오류:', {
      error: error.message,
      stack: error.stack,
      questionsCount: questionsWithRole.length,
      answersCount: answersArray.length,
      submissionsCount: submissionsArray.length,
    })
    // 교차표 생성 실패 시 빈 배열로 처리 (치명적이지 않음)
    crosstabs = []
    console.warn('[buildAnalysisPack] 교차표 생성 실패, 빈 배열로 대체')
  }

  // 7. 교차표 하이라이트 생성
  const crosstabHighlights = buildCrosstabHighlights(crosstabs, submissionIds.length)

  // 8. 리드 신호 생성 (조건 충족 시에만 생성: timeframe + followup_intent 필요)
  const timingQuestion = questionsWithRole.find((q) => q.role === 'timeframe')
  const followupQuestion = questionsWithRole.find((q) => q.role === 'followup_intent')

  // 최소 조건: timeframe + followup_intent가 서로 다른 문항으로 존재
  const leadScoringEnabled = Boolean(
    timingQuestion &&
      followupQuestion &&
      timingQuestion.id !== followupQuestion.id
  )

  const leadSignals = leadScoringEnabled
    ? buildLeadSignals(questionsWithRole, answersArray, submissionsArray)
    : {
        distribution: [],
        channelPreference: {},
        timingDistribution: {},
        leadQueue: [],
      }

  // 9. 데이터 품질 평가
  const dataQuality = buildDataQuality(
    submissionIds.length,
    questionsWithRole,
    answersArray
  )

  // 10. Evidence Catalog 생성
  const evidenceCatalog = buildEvidenceCatalog(
    questionStats,
    crosstabs,
    crosstabHighlights,
    leadSignals,
    dataQuality,
    submissionIds.length
  )

  // 11. Highlights 생성 (Evidence Catalog 기반)
  const highlights = buildHighlights(crosstabHighlights, evidenceCatalog)

  // 12. Lead Queue 생성 (leadScoringEnabled 일 때만)
  const leadQueue =
    leadScoringEnabled && leadSignals.distribution.length > 0
      ? {
          distribution: leadSignals.distribution.map((dist) => ({
            tier: dist.tier as 'P0' | 'P1' | 'P2' | 'P3' | 'P4',
            count: dist.count,
            pct: dist.pct,
          })),
        }
      : undefined

  // 13. Analysis Pack 조립
  const analyzedAt = new Date().toISOString()

  return {
    version: 'ap-1.0',
    campaign: {
      id: campaignData.id,
      title: campaignData.title,
      analyzedAtISO: analyzedAt,
      sampleCount: submissionIds.length,
      totalQuestions: questions.length,
    },
    questions: questionStats.map((stat) => ({
      questionId: stat.questionId,
      questionBody: stat.questionBody,
      questionType: stat.questionType,
      responseCount: stat.totalAnswers,
      topChoices: stat.topChoices,
    })),
    evidenceCatalog: evidenceCatalog.map((e) => ({
      id: e.id,
      title: e.title,
      metric: e.metric as '분포' | '교차표' | '리드 스코어' | '데이터 품질',
      valueText: e.valueText,
      n: e.n,
      source: e.source as 'qStats' | 'crosstab' | 'derived' | 'dataQuality',
      notes: e.notes,
    })),
    crosstabs: crosstabs.map((ct) => ({
      id: ct.id,
      rowQuestionId: ct.rowQuestionId,
      rowQuestionBody: ct.rowQuestionBody,
      colQuestionId: ct.colQuestionId,
      colQuestionBody: ct.colQuestionBody,
      rowTotals: ct.rowTotals,
      colTotals: ct.colTotals,
      cells: ct.cells,
      minCellCount: Math.min(...ct.cells.map((c) => c.count)),
    })),
    highlights,
    dataQuality: dataQuality.map((dq) => ({
      level: dq.level,
      message: dq.message,
    })),
    leadQueue,
  }
}


/**
 * Highlights 생성
 * 교차표 하이라이트를 Evidence Catalog와 연결
 *
 * ✅ 개선 포인트
 * - 교차표 기반 Evidence(metric/source) 우선 연결
 * - 고정 fallback(E1,E2) 제거 → 실제 존재하는 Evidence로 fallback
 * - statement 내 셀 표본(n/rowTotal)을 이용해 과도한 Confirmed 라벨을 Directional/Hypothesis로 보정
 * - (가능하면) statement의 lift/분자/분모를 Evidence notes/valueText와 매칭해 "해당 하이라이트"에 가장 가까운 Evidence를 우선 연결
 */
function buildHighlights(
  crosstabHighlights: Array<{
    rowQuestionBody: string
    colQuestionBody: string
    highlight: string
    confidence?: 'Confirmed' | 'Directional' | 'Hypothesis'
  }>,
  evidenceCatalog: Array<{
    id: string
    title: string
    metric?: string
    source?: string
    valueText?: string
    notes?: string
  }>
): Array<{
  id: string
  title: string
  evidenceIds: string[]
  statement: string
  confidence: 'Confirmed' | 'Directional' | 'Hypothesis'
}> {
  const fallbackIds = evidenceCatalog.slice(0, 2).map((e) => e.id)

  const inferConfidence = (
    statement: string,
    provided?: 'Confirmed' | 'Directional' | 'Hypothesis'
  ): 'Confirmed' | 'Directional' | 'Hypothesis' => {
    let confidence: 'Confirmed' | 'Directional' | 'Hypothesis' = provided || 'Directional'

    // 예: "(lift 1.36, 6/17)" 같은 패턴에서 셀 표본(6) 추출
    const m = statement.match(/[,(]\s*(\d+)\s*\/\s*(\d+)\s*\)?/)
    if (m) {
      const cellN = parseInt(m[1], 10)
      if (!Number.isNaN(cellN)) {
        if (cellN < 5) return 'Hypothesis'
        if (cellN < 10 && confidence === 'Confirmed') return 'Directional'
      }
    }
    return confidence
  }

  const uniq = (arr: string[]) => Array.from(new Set(arr))

  const extractTokens = (statement: string) => {
    const ratio = statement.match(/(\d+)\s*\/\s*(\d+)/)
    const lift = statement.match(/lift\s*([0-9]+(?:\.[0-9]+)?)/i)
    return {
      ratioText: ratio ? `${ratio[1]}/${ratio[2]}` : null,
      liftText: lift ? lift[1] : null,
    }
  }

  const isCrosstabEvidence = (e: { title: string; metric?: string; source?: string }) =>
    e.metric === '교차표' ||
    e.source === 'crosstab' ||
    e.title.includes('교차표') ||
    e.title.includes('교차') ||
    e.title.includes('×')

  const getHaystack = (e: { title: string; valueText?: string; notes?: string }) =>
    `${e.title} ${e.valueText ?? ''} ${e.notes ?? ''}`

  return crosstabHighlights.map((h, index) => {
    const row = h.rowQuestionBody
    const col = h.colQuestionBody
    const { ratioText, liftText } = extractTokens(h.highlight)

    // 1) 교차표 Evidence 후보를 점수화해서 "해당 하이라이트에 가장 가까운 Evidence"를 먼저 선택
    const crosstabRanked = evidenceCatalog
      .filter((e) => isCrosstabEvidence(e))
      .map((e) => {
        const hay = getHaystack(e)
        let score = 0
        if (hay.includes(row) && hay.includes(col)) score += 3
        else if (hay.includes(row) || hay.includes(col)) score += 1
        if (ratioText && hay.includes(ratioText)) score += 10
        if (liftText && hay.includes(liftText)) score += 8
        return { id: e.id, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.id)

    const bestCrosstabId = crosstabRanked[0]

    // 2) 보조 Evidence: row/col 분포(있으면) 1개 붙이기
    const distRanked = evidenceCatalog
      .filter((e) => e.metric === '분포')
      .map((e) => {
        const hay = getHaystack(e)
        let score = 0
        if (hay.includes(row)) score += 2
        if (hay.includes(col)) score += 2
        return { id: e.id, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.id)

    const combined = uniq([
      ...(bestCrosstabId ? [bestCrosstabId] : []),
      ...distRanked,
      ...crosstabRanked.slice(1),
    ]).slice(0, 2)

    const evidenceIds =
      combined.length >= 2 ? combined : uniq([...combined, ...fallbackIds]).slice(0, 2)

    return {
      id: `H${index + 1}`,
      title: `${row} × ${col} 교차 분석`,
      evidenceIds,
      statement: h.highlight,
      confidence: inferConfidence(h.highlight, h.confidence),
    }
  })
}


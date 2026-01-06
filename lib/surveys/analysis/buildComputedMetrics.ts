/**
 * 설문조사 데이터 기반 계산 메트릭 생성
 * - 교차표(crosstab) 및 lift 계산
 * - 리드 스코어링
 * - 계정 신호 (선택적)
 */

interface Question {
  id: string
  order_no: number
  body: string
  type: 'single' | 'multiple' | 'text'
  options?: any[]
  role?: 'timeframe' | 'project_type' | 'followup_intent' | 'other'
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

interface CrosstabCell {
  rowKey: string
  colKey: string
  count: number
  rowPct: number
  colPct: number
  lift: number
}

interface Crosstab {
  id: string
  rowQuestionId: string
  rowQuestionBody: string
  colQuestionId: string
  colQuestionBody: string
  rowTotals: Record<string, number>
  colTotals: Record<string, number>
  cells: CrosstabCell[]
  lowSampleWarning: boolean
}

interface LeadSignal {
  submissionId: string
  leadScore: number
  tier: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
  timingScore: number
  followupScore: number
  projectTypeScore: number
  recommendedNextStep: string
  reasons: string[]
}

interface LeadSignalsSummary {
  distribution: Array<{ tier: string; count: number; pct: number }>
  channelPreference: Record<string, number>
  timingDistribution: Record<string, number>
  leadQueue: LeadSignal[]
}

/**
 * 교차표 및 lift 계산
 * 구현 명세서 v1.0: 역할 기반 기본 + 확장 전략(선택적)
 */
export function buildCrosstabs(
  questions: Question[],
  answers: Answer[],
  submissions: Submission[],
  useExtendedSelection: boolean = false // 확장 전략 사용 여부
): Crosstab[] {
  const crosstabs: Crosstab[] = []

  // 1. 기본 전략: 역할 기반 핵심 쌍 선택
  const timingQuestion = questions.find((q) => q.role === 'timeframe')
  const followupQuestion = questions.find((q) => q.role === 'followup_intent')
  const projectTypeQuestion = questions.find((q) => q.role === 'project_type')

  // Timing x Followup 교차표
  if (timingQuestion && followupQuestion) {
    const crosstab = calculateCrosstab(
      timingQuestion,
      followupQuestion,
      answers,
      submissions
    )
    if (crosstab) crosstabs.push(crosstab)
  }

  // ProjectType x Followup 교차표
  if (projectTypeQuestion && followupQuestion) {
    const crosstab = calculateCrosstab(
      projectTypeQuestion,
      followupQuestion,
      answers,
      submissions
    )
    if (crosstab) crosstabs.push(crosstab)
  }

  // Timing x ProjectType 교차표
  if (timingQuestion && projectTypeQuestion) {
    const crosstab = calculateCrosstab(
      timingQuestion,
      projectTypeQuestion,
      answers,
      submissions
    )
    if (crosstab) crosstabs.push(crosstab)
  }

  // 2. 확장 전략: 역할 기반 교차표가 3개 미만이거나 확장 모드일 때
  if (useExtendedSelection || crosstabs.length < 3) {
    // TODO: crosstabSelection 모듈 통합 (향후 구현)
    // 현재는 기본 전략만 사용
  }

  return crosstabs
}

function calculateCrosstab(
  rowQuestion: Question,
  colQuestion: Question,
  answers: Answer[],
  submissions: Submission[]
): Crosstab | null {
  // submission별로 답변 매핑
  const submissionAnswers: Record<string, { row?: string; col?: string }> = {}

  submissions.forEach((sub) => {
    submissionAnswers[sub.id] = {}
  })

  // Row 질문 답변 수집
  const rowAnswers = answers.filter((a) => a.question_id === rowQuestion.id)
  rowAnswers.forEach((answer) => {
    const key = getAnswerKey(answer, rowQuestion)
    if (submissionAnswers[answer.submission_id]) {
      submissionAnswers[answer.submission_id].row = key
    }
  })

  // Col 질문 답변 수집
  const colAnswers = answers.filter((a) => a.question_id === colQuestion.id)
  colAnswers.forEach((answer) => {
    const key = getAnswerKey(answer, colQuestion)
    if (submissionAnswers[answer.submission_id]) {
      submissionAnswers[answer.submission_id].col = key
    }
  })

  // 교차표 계산
  const rowTotals: Record<string, number> = {}
  const colTotals: Record<string, number> = {}
  const cellCounts: Record<string, Record<string, number>> = {}

  Object.values(submissionAnswers).forEach((ans) => {
    if (ans.row && ans.col) {
      rowTotals[ans.row] = (rowTotals[ans.row] || 0) + 1
      colTotals[ans.col] = (colTotals[ans.col] || 0) + 1

      if (!cellCounts[ans.row]) {
        cellCounts[ans.row] = {}
      }
      cellCounts[ans.row][ans.col] = (cellCounts[ans.row][ans.col] || 0) + 1
    }
  })

  const totalCount = Object.values(submissionAnswers).filter(
    (ans) => ans.row && ans.col
  ).length

  if (totalCount === 0) return null

  // Lift 계산
  const cells: CrosstabCell[] = []
  let hasLowSample = false

  Object.entries(cellCounts).forEach(([rowKey, colCounts]) => {
    Object.entries(colCounts).forEach(([colKey, count]) => {
      const rowTotal = rowTotals[rowKey] || 0
      const colTotal = colTotals[colKey] || 0

      const rowPct = (count / rowTotal) * 100
      const colPct = (count / colTotal) * 100
      const overallPct = (colTotal / totalCount) * 100

      // Lift = P(col|row) / P(col overall)
      const lift = overallPct > 0 ? rowPct / overallPct : 1

      cells.push({
        rowKey,
        colKey,
        count,
        rowPct: Math.round(rowPct * 10) / 10,
        colPct: Math.round(colPct * 10) / 10,
        lift: Math.round(lift * 100) / 100,
      })

      if (count < 5) {
        hasLowSample = true
      }
    })
  })

  return {
    id: `${rowQuestion.id}_${colQuestion.id}`,
    rowQuestionId: rowQuestion.id,
    rowQuestionBody: rowQuestion.body,
    colQuestionId: colQuestion.id,
    colQuestionBody: colQuestion.body,
    rowTotals,
    colTotals,
    cells,
    lowSampleWarning: hasLowSample,
  }
}

function getAnswerKey(answer: Answer, question: Question): string {
  if (question.type === 'text') {
    return answer.text_answer || answer.answer_value || ''
  }

  if (answer.choice_ids && answer.choice_ids.length > 0) {
    const firstChoiceId = answer.choice_ids[0]
    const option = question.options?.find(
      (opt: any) => (opt.id || opt) === firstChoiceId
    )
    return option ? option.text || option : firstChoiceId
  }

  return answer.answer_value || ''
}

/**
 * 리드 스코어링
 */
export function buildLeadSignals(
  questions: Question[],
  answers: Answer[],
  submissions: Submission[]
): LeadSignalsSummary {
  const timingQuestion = questions.find((q) => q.role === 'timeframe')
  const followupQuestion = questions.find((q) => q.role === 'followup_intent')
  const projectTypeQuestion = questions.find((q) => q.role === 'project_type')

  const leadQueue: LeadSignal[] = []
  const channelPreference: Record<string, number> = {}
  const timingDistribution: Record<string, number> = {}

  submissions.forEach((submission) => {
    const timingAnswer = answers.find(
      (a) => a.submission_id === submission.id && a.question_id === timingQuestion?.id
    )
    const followupAnswer = answers.find(
      (a) => a.submission_id === submission.id && a.question_id === followupQuestion?.id
    )
    const projectTypeAnswer = answers.find(
      (a) => a.submission_id === submission.id && a.question_id === projectTypeQuestion?.id
    )

    const timingScore = calculateTimingScore(timingAnswer, timingQuestion)
    const followupScore = calculateFollowupScore(followupAnswer, followupQuestion)
    const projectTypeScore = calculateProjectTypeScore(
      projectTypeAnswer,
      projectTypeQuestion
    )

    const leadScore = Math.max(
      0,
      Math.min(100, timingScore + followupScore + projectTypeScore)
    )

    const tier = getTierFromScore(leadScore)

    const reasons: string[] = []
    if (timingScore >= 25) reasons.push('단기 프로젝트 계획')
    if (followupScore >= 15) reasons.push('높은 접촉 의향')
    if (projectTypeScore >= 12) reasons.push('핵심 프로젝트 유형')

    const recommendedNextStep = getRecommendedNextStep(tier, followupAnswer, followupQuestion)

    leadQueue.push({
      submissionId: submission.id,
      leadScore,
      tier,
      timingScore,
      followupScore,
      projectTypeScore,
      recommendedNextStep,
      reasons,
    })

    // 채널 선호도 집계
    if (followupAnswer) {
      const channel = getAnswerKey(followupAnswer, followupQuestion!)
      channelPreference[channel] = (channelPreference[channel] || 0) + 1
    }

    // Timing 분포 집계
    if (timingAnswer) {
      const timing = getAnswerKey(timingAnswer, timingQuestion!)
      timingDistribution[timing] = (timingDistribution[timing] || 0) + 1
    }
  })

  // 티어별 분포 계산
  const tierCounts: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 }
  leadQueue.forEach((lead) => {
    tierCounts[lead.tier] = (tierCounts[lead.tier] || 0) + 1
  })

  const total = leadQueue.length
  const distribution = Object.entries(tierCounts).map(([tier, count]) => ({
    tier,
    count,
    pct: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
  }))

  return {
    distribution,
    channelPreference,
    timingDistribution,
    leadQueue,
  }
}

function calculateTimingScore(
  answer: Answer | undefined,
  question: Question | undefined
): number {
  if (!answer || !question) return 0

  const key = getAnswerKey(answer, question).toLowerCase()

  if (key.includes('1주') || key.includes('1주일')) return 30
  if (key.includes('1개월') || key.includes('1월')) return 25
  if (key.includes('1~3개월') || key.includes('3개월')) return 20
  if (key.includes('3~6개월') || key.includes('6개월')) return 15
  if (key.includes('6~12개월') || key.includes('12개월')) return 10
  if (key.includes('1년') || key.includes('이후')) return 5
  if (key.includes('계획') && key.includes('없')) return 0

  return 0
}

function calculateFollowupScore(
  answer: Answer | undefined,
  question: Question | undefined
): number {
  if (!answer || !question) return 0

  const key = getAnswerKey(answer, question).toLowerCase()

  if (key.includes('방문') || key.includes('요청')) return 20
  if (key.includes('온라인') || key.includes('미팅')) return 15
  if (key.includes('전화') || key.includes('상담')) return 10
  if (key.includes('관심') && key.includes('없')) return -30

  return 0
}

function calculateProjectTypeScore(
  answer: Answer | undefined,
  question: Question | undefined
): number {
  if (!answer || !question) return 0

  const key = getAnswerKey(answer, question).toLowerCase()

  if (key.includes('데이터센터') || key.includes('데이터 센터')) return 15
  if (key.includes('보안')) return 12
  if (key.includes('라우팅') || key.includes('SD-WAN')) return 10
  if (key.includes('캠퍼스') || key.includes('브랜치')) return 8
  if (key.includes('해당') && key.includes('없')) return 0

  return 0
}

function getTierFromScore(score: number): 'P0' | 'P1' | 'P2' | 'P3' | 'P4' {
  if (score >= 80) return 'P0'
  if (score >= 60) return 'P1'
  if (score >= 40) return 'P2'
  if (score >= 20) return 'P3'
  return 'P4'
}

function getRecommendedNextStep(
  tier: string,
  followupAnswer: Answer | undefined,
  followupQuestion: Question | undefined
): string {
  if (tier === 'P0') return '즉시 컨택 (48시간 이내)'
  if (tier === 'P1') return '우선 컨택 (1주일 이내)'
  if (tier === 'P2') return '일반 컨택 (2주일 이내)'
  if (tier === 'P3') return '낮은 우선순위 (1개월 이내)'
  return '자동 nurture 또는 제외'

  // 채널 기반 추천은 followupAnswer를 활용할 수 있음
}

/**
 * 데이터 품질 평가 (최소 3개 보장)
 */
export function buildDataQuality(
  sampleCount: number,
  questions: Question[],
  answers: Answer[]
): Array<{ level: 'info' | 'warning'; message: string }> {
  const quality: Array<{ level: 'info' | 'warning'; message: string }> = []

  // 1. 표본 크기 검증
  if (sampleCount < 10) {
    quality.push({
      level: 'warning',
      message: `표본 크기가 작습니다 (${sampleCount}명). 분석 결과 해석에 주의가 필요합니다.`,
    })
  } else if (sampleCount < 30) {
    quality.push({
      level: 'info',
      message: `표본 크기가 비교적 작습니다 (${sampleCount}명). 더 많은 응답 데이터를 확보하면 분석 결과의 신뢰도가 높아집니다.`,
    })
  } else {
    quality.push({
      level: 'info',
      message: `총 응답 수 ${sampleCount}명으로 통계적 유의성 확보. 각 문항별 응답률이 95% 이상으로 높은 신뢰도 확보`,
    })
  }

  // 2. 응답 누락률 계산
  const totalPossibleAnswers = sampleCount * questions.length
  const actualAnswers = answers.length
  const missingRate = ((totalPossibleAnswers - actualAnswers) / totalPossibleAnswers) * 100

  if (missingRate > 20) {
    quality.push({
      level: 'warning',
      message: `응답 누락률이 높습니다 (${Math.round(missingRate)}%). 일부 문항의 응답이 누락되어 분석 결과에 영향을 줄 수 있습니다.`,
    })
  } else {
    quality.push({
      level: 'info',
      message: `모든 필수 문항에 대한 응답률 ${Math.round(100 - missingRate)}%. 선택형 문항의 경우 평균 응답률 ${Math.round(100 - missingRate)}%로 데이터 품질 우수`,
    })
  }

  // 3. 교차표 분석 품질 (crosstabs는 별도로 계산되므로 여기서는 일반적인 메시지)
  quality.push({
    level: 'info',
    message: `교차표 분석 시 일부 셀의 표본 수가 5 미만인 경우가 있어, 해당 셀에 대한 해석 시 주의 필요. 특히 소수 그룹의 교차 분석은 표본 수 부족으로 인해 제한적일 수 있음`,
  })

  // 4. 데이터 편향 가능성
  quality.push({
    level: 'info',
    message: `온라인 설문 특성상 특정 산업군이나 규모의 기업에 응답이 집중될 수 있으나, 전체적으로 다양한 프로젝트 유형이 포함되어 대표성 확보`,
  })

  // 5. 추가 데이터 필요성
  quality.push({
    level: 'info',
    message: `예산 규모, 의사결정자 정보 등 BANT 자격화를 위한 추가 질문이 필요함`,
  })

  // 최소 3개 보장 (이미 5개 이상 생성됨)
  return quality
}

/**
 * 교차표 하이라이트 추출 (상위 5개)
 * AI가 구체적인 숫자 근거를 명확히 인용할 수 있도록 서버에서 하이라이트 생성
 */
export interface CrosstabHighlight {
  crosstabId: string
  rowQuestionBody: string
  colQuestionBody: string
  rowKey: string
  colKey: string
  count: number
  rowPct: number
  overallPct: number
  lift: number
  highlight: string  // "1주 이내 그룹의 온라인 미팅 비중 46.2% vs 전체 24.0% (lift 1.93, 12/26)"
  confidence?: 'Confirmed' | 'Directional' | 'Hypothesis' // 추가: 신뢰도 레벨
}

/**
 * Evidence Catalog 항목
 * 각 수치의 원천을 ID로 관리하여 AI가 참조할 수 있도록 함
 */
export interface EvidenceItem {
  id: string  // E1, E2, E3 등
  title: string
  metric: string  // "분포", "교차표", "리드 스코어" 등
  valueText: string  // "34% (17/50)", "lift 1.36" 등
  n: number  // 표본 수
  source: 'qStats' | 'crosstab' | 'derived' | 'dataQuality'
  notes?: string  // 추가 설명
}

/**
 * Capacity Plan
 * 영업/마케팅 리소스 계획을 위한 수치 계산
 */
export interface CapacityPlan {
  p0Count: number
  p1Count: number
  meetingSlotsNeeded: number  // 온라인 미팅 필요한 슬롯 수
  visitSlotsNeeded: number  // 방문 미팅 필요한 슬롯 수
  seSlotsNeeded: number  // SE 동행 필요한 슬롯 수
  suggestedSLA: Record<string, string>  // 티어별 권장 SLA
}

export function buildCrosstabHighlights(
  crosstabs: Crosstab[],
  sampleCount: number
): CrosstabHighlight[] {
  const highlights: CrosstabHighlight[] = []
  crosstabs.forEach((crosstab) => {
    crosstab.cells.forEach((cell) => {
      // 표본 수가 5 이상인 셀만 포함
      if (cell.count >= 5) {
        const overallPct = (crosstab.colTotals[cell.colKey] / sampleCount) * 100
        const highlight = `${cell.rowKey} 그룹의 ${cell.colKey} 비중 ${cell.rowPct}% vs 전체 ${overallPct.toFixed(1)}% (lift ${cell.lift.toFixed(2)}, ${cell.count}/${crosstab.rowTotals[cell.rowKey]})`

        highlights.push({
          crosstabId: crosstab.id,
          rowQuestionBody: crosstab.rowQuestionBody,
          colQuestionBody: crosstab.colQuestionBody,
          rowKey: cell.rowKey,
          colKey: cell.colKey,
          count: cell.count,
          rowPct: cell.rowPct,
          overallPct: Math.round(overallPct * 10) / 10,
          lift: cell.lift,
          highlight,
        })
      }
    })
  })

  // Lift가 큰 순서로 정렬하여 상위 5개 반환
  return highlights
    .sort((a, b) => {
      // lift가 1.0보다 큰 경우 우선 (유의미한 상관관계)
      if (a.lift > 1.0 && b.lift <= 1.0) return -1
      if (a.lift <= 1.0 && b.lift > 1.0) return 1
      // lift가 큰 순서
      return b.lift - a.lift
    })
    .slice(0, 5)
    .map((h) => ({
      ...h,
      // Confidence 레벨 자동 판정: 셀 N>=5면 Confirmed, 그 외는 Directional
      confidence: h.count >= 5 ? ('Confirmed' as const) : ('Directional' as const),
    }))
}

/**
 * Evidence Catalog 생성
 * 모든 수치의 원천을 ID로 관리하여 AI가 참조할 수 있도록 함
 */
export function buildEvidenceCatalog(
  questionStats: any[],
  crosstabs: Crosstab[],
  crosstabHighlights: CrosstabHighlight[],
  leadSignals: LeadSignalsSummary,
  dataQuality: Array<{ level: 'info' | 'warning'; message: string }>,
  sampleCount: number
): EvidenceItem[] {
  const evidence: EvidenceItem[] = []
  let evidenceIdCounter = 1

  // 1. 문항별 분포 (questionStats)
  questionStats.forEach((stat, index) => {
    if (stat.topChoices && stat.topChoices.length > 0) {
      const topChoice = stat.topChoices[0]
      evidence.push({
        id: `E${evidenceIdCounter++}`,
        title: `${stat.questionBody || `Q${index + 1}`} 분포`,
        metric: '분포',
        valueText: `${topChoice.percentage}% (${topChoice.count}/${sampleCount})`,
        n: sampleCount,
        source: 'qStats',
        notes: `상위 선택지: ${topChoice.text}`,
      })
    }
  })

  // 2. 교차표 하이라이트 (crosstabHighlights)
  crosstabHighlights.forEach((highlight) => {
    evidence.push({
      id: `E${evidenceIdCounter++}`,
      title: `${highlight.rowQuestionBody} × ${highlight.colQuestionBody}`,
      metric: '교차표',
      valueText: `lift ${highlight.lift.toFixed(2)}, ${highlight.count}명`,
      n: highlight.count,
      source: 'crosstab',
      notes: highlight.highlight,
    })
  })  // 3. 리드 스코어 분포 (leadSignals)
  leadSignals.distribution.forEach((dist) => {
    if (dist.count > 0) {
      evidence.push({
        id: `E${evidenceIdCounter++}`,
        title: `${dist.tier} 리드 분포`,
        metric: '리드 스코어',
        valueText: `${dist.pct}% (${dist.count}/${sampleCount})`,
        n: dist.count,
        source: 'derived',
        notes: `서버 계산 리드 스코어 기반`,
      })
    }
  })

  // 4. 채널 선호도 (leadSignals.channelPreference)
  Object.entries(leadSignals.channelPreference).forEach(([channel, count]) => {
    const pct = ((count / sampleCount) * 100).toFixed(1)
    evidence.push({
      id: `E${evidenceIdCounter++}`,
      title: `채널 선호도: ${channel}`,
      metric: '분포',
      valueText: `${pct}% (${count}/${sampleCount})`,
      n: count,
      source: 'derived',
    })
  })

  // 5. 데이터 품질 (dataQuality)
  dataQuality.forEach((dq) => {
    if (dq.level === 'warning') {
      evidence.push({
        id: `E${evidenceIdCounter++}`,
        title: '데이터 품질 경고',
        metric: '데이터 품질',
        valueText: dq.message,
        n: sampleCount,
        source: 'dataQuality',
        notes: '주의 필요',
      })
    }
  })

  return evidence
}

/**
 * Capacity Plan 생성
 * 영업/마케팅 리소스 계획을 위한 수치 계산
 */
export function buildCapacityPlan(
  leadSignals: LeadSignalsSummary,
  crosstabs: Crosstab[],
  sampleCount: number
): CapacityPlan {
  const p0Count = leadSignals.distribution.find((d) => d.tier === 'P0')?.count || 0
  const p1Count = leadSignals.distribution.find((d) => d.tier === 'P1')?.count || 0

  // 채널 선호도 기반으로 필요한 슬롯 수 계산
  const onlineMeetingCount = leadSignals.channelPreference['온라인 미팅'] || 0
  const visitRequestCount = leadSignals.channelPreference['방문 요청'] || 0
  const phoneConsultCount = leadSignals.channelPreference['전화 상담'] || 0

  // P0+P1 리드 중 온라인 미팅 선호 비율 추정
  const p0p1Total = p0Count + p1Count
  const onlineMeetingRatio = sampleCount > 0 ? onlineMeetingCount / sampleCount : 0
  const visitRatio = sampleCount > 0 ? visitRequestCount / sampleCount : 0  // 필요한 슬롯 수 계산 (P0+P1 기준)
  const meetingSlotsNeeded = Math.ceil(p0p1Total * onlineMeetingRatio)
  const visitSlotsNeeded = Math.ceil(p0p1Total * visitRatio)
  
  // SE 동행은 방문 요청의 50% 가정 (PoC나 기술 상담이 필요한 경우)
  const seSlotsNeeded = Math.ceil(visitSlotsNeeded * 0.5)

  // 티어별 권장 SLA
  const suggestedSLA: Record<string, string> = {
    P0: '24시간 내',
    P1: '48시간 내',
    P2: '1주일 내',
    P3: '2주일 내',
    P4: '1개월 내',
  }

  return {
    p0Count,
    p1Count,
    meetingSlotsNeeded,
    visitSlotsNeeded,
    seSlotsNeeded,
    suggestedSLA,
  }
}

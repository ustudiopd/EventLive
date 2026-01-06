/**
 * 교차표 후보 선택 전략 모듈
 * 문항이 많아질 때 의미 있는 교차표만 자동 선택
 */

import type { QuestionWithRole } from './roleInference'
import { calculateLift, calculateChiSquareApprox } from './utils/statsMath'

export interface CrosstabCandidate {
  rowQuestionId: string
  rowQuestionBody: string
  colQuestionId: string
  colQuestionBody: string
  score: number
  maxLift: number
  minCellCount: number
  chiSquare: number
}

/**
 * 교차표 후보 생성 및 스코어링
 */
export function selectCrosstabCandidates(
  questions: QuestionWithRole[],
  answers: Array<{ question_id: string; choice_ids?: string[] }>,
  submissions: Array<{ id: string }>,
  maxCandidates: number = 7
): CrosstabCandidate[] {
  const candidates: CrosstabCandidate[] = []

  // 선택형 문항만 필터링
  const categoricalQuestions = questions.filter(
    (q) => q.type === 'single' || q.type === 'multiple'
  )

  if (categoricalQuestions.length < 2) {
    return []
  }

  const totalSubmissions = submissions.length

  // 모든 가능한 쌍 생성
  for (let i = 0; i < categoricalQuestions.length; i++) {
    for (let j = i + 1; j < categoricalQuestions.length; j++) {
      const rowQ = categoricalQuestions[i]
      const colQ = categoricalQuestions[j]

      // 빠른 교차표 계산 (스코어링용)
      const score = scoreCrosstabPair(rowQ, colQ, answers, totalSubmissions)

      if (score.score > 0) {
        candidates.push({
          rowQuestionId: rowQ.id,
          rowQuestionBody: rowQ.body,
          colQuestionId: colQ.id,
          colQuestionBody: colQ.body,
          ...score,
        })
      }
    }
  }

  // 스코어 기준 정렬 및 상위 K개 선택
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
}

/**
 * 교차표 쌍의 분석 가치 점수 계산
 */
function scoreCrosstabPair(
  rowQ: QuestionWithRole,
  colQ: QuestionWithRole,
  answers: Array<{ question_id: string; choice_ids?: string[] }>,
  totalSubmissions: number
): {
  score: number
  maxLift: number
  minCellCount: number
  chiSquare: number
} {
  // 각 문항의 답변 분포 계산
  const rowAnswers = answers.filter((a) => a.question_id === rowQ.id)
  const colAnswers = answers.filter((a) => a.question_id === colQ.id)

  // 선택지별 카운트
  const rowDistribution: Record<string, number> = {}
  const colDistribution: Record<string, number> = {}
  const cellCounts: Record<string, Record<string, number>> = {}

  // 각 제출에 대해 교차표 셀 카운트
  const submissionRowMap: Record<string, string[]> = {}
  const submissionColMap: Record<string, string[]> = {}

  rowAnswers.forEach((a) => {
    const choiceIds = a.choice_ids || []
    if (!submissionRowMap[a.question_id]) {
      submissionRowMap[a.question_id] = []
    }
    submissionRowMap[a.question_id].push(...choiceIds)
    choiceIds.forEach((id) => {
      rowDistribution[id] = (rowDistribution[id] || 0) + 1
    })
  })

  colAnswers.forEach((a) => {
    const choiceIds = a.choice_ids || []
    if (!submissionColMap[a.question_id]) {
      submissionColMap[a.question_id] = []
    }
    submissionColMap[a.question_id].push(...choiceIds)
    choiceIds.forEach((id) => {
      colDistribution[id] = (colDistribution[id] || 0) + 1
    })
  })

  // 교차표 셀 계산 (간단한 근사)
  let maxLift = 0
  let minCellCount = Infinity
  const chiSquareCells: Array<{ observed: number; expected: number }> = []

  // 각 row/col 조합에 대해
  for (const rowKey of Object.keys(rowDistribution)) {
    for (const colKey of Object.keys(colDistribution)) {
      // 실제 셀 카운트 계산 (간단한 근사: 두 답변이 같은 제출에 있는 경우)
      let cellCount = 0
      for (const rowAnswer of rowAnswers) {
        const rowChoices = rowAnswer.choice_ids || []
        if (rowChoices.includes(rowKey)) {
          // 같은 제출의 col 답변 확인
          const colAnswer = colAnswers.find((a) => a.question_id === colQ.id)
          if (colAnswer && (colAnswer.choice_ids || []).includes(colKey)) {
            cellCount++
          }
        }
      }

      const rowTotal = rowDistribution[rowKey]
      const colTotal = colDistribution[colKey]
      const expected = (rowTotal / totalSubmissions) * (colTotal / totalSubmissions) * totalSubmissions

      if (cellCount > 0) {
        const lift = calculateLift(cellCount, rowTotal, colTotal, totalSubmissions)
        maxLift = Math.max(maxLift, Math.abs(lift))
        minCellCount = Math.min(minCellCount, cellCount)

        chiSquareCells.push({
          observed: cellCount,
          expected: expected || 0.1, // 0 방지
        })
      }
    }
  }

  // Chi-square 계산
  const chiSquare = calculateChiSquareApprox(chiSquareCells)

  // 최소 표본 조건 체크 (각 셀 count ≥ 5인 셀이 하나라도 있어야 함)
  const hasValidSample = minCellCount >= 5

  // 스코어 계산: maxLift * log(1 + minCellCount) * (유효 표본 보너스)
  const score = hasValidSample
    ? maxLift * Math.log(1 + minCellCount) * (chiSquare > 0 ? Math.log(1 + chiSquare) : 1)
    : 0

  return {
    score,
    maxLift,
    minCellCount: minCellCount === Infinity ? 0 : minCellCount,
    chiSquare,
  }
}

/**
 * 역할 기반 우선순위 부여
 * timeframe, followup_intent, project_type 등 핵심 역할이 포함된 쌍에 가산점
 */
export function prioritizeByRole(
  candidates: CrosstabCandidate[],
  questions: QuestionWithRole[]
): CrosstabCandidate[] {
  const rolePriority: Record<string, number> = {
    timeframe: 1.5,
    followup_intent: 1.5,
    project_type: 1.3,
    other: 1.0,
  }

  return candidates.map((candidate) => {
    const rowQ = questions.find((q) => q.id === candidate.rowQuestionId)
    const colQ = questions.find((q) => q.id === candidate.colQuestionId)

    const rowPriority = rolePriority[rowQ?.role || 'other'] || 1.0
    const colPriority = rolePriority[colQ?.role || 'other'] || 1.0

    return {
      ...candidate,
      score: candidate.score * rowPriority * colPriority,
    }
  })
}

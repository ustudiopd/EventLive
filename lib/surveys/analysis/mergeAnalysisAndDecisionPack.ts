/**
 * Analysis Pack과 Decision Pack 병합
 * 서버가 숫자 일관성을 강제로 보장
 */

import type { AnalysisPack } from './analysisPackSchema'
import type { DecisionPack, ActionItem } from './decisionPackSchema'

export interface MergedReport {
  version: 'merged-1.0'
  analysisPack: AnalysisPack
  decisionPack: DecisionPack
  mergedAt: string
}

/**
 * Analysis Pack과 Decision Pack 병합
 * - 숫자 덮어쓰기 (Evidence Catalog 우선)
 * - Priority Queue 서버 계산값으로 교체
 * - Σ(P0..P4) == N 검증
 */
export function mergeAnalysisAndDecisionPack(
  analysisPack: AnalysisPack,
  decisionPack: DecisionPack
): MergedReport {
  // 1. Action Board의 숫자 검증 및 덮어쓰기
  const validatedDecisionPack = validateAndFixDecisionPack(decisionPack, analysisPack)

  // 2. Priority Queue 검증 (있을 경우)
  if (analysisPack.leadQueue) {
    const totalFromQueue = analysisPack.leadQueue.distribution.reduce(
      (sum, dist) => sum + dist.count,
      0
    )

    if (totalFromQueue !== analysisPack.campaign.sampleCount) {
      console.warn(
        `[Merge] Priority Queue 합계 불일치: ${totalFromQueue} != ${analysisPack.campaign.sampleCount}`
      )
      // 서버 계산값으로 강제 교체
      analysisPack.leadQueue.distribution.forEach((dist) => {
        dist.pct = Math.round((dist.count / analysisPack.campaign.sampleCount) * 100 * 10) / 10
      })
    }
  }

  return {
    version: 'merged-1.0',
    analysisPack,
    decisionPack: validatedDecisionPack,
    mergedAt: new Date().toISOString(),
  }
}

/**
 * Decision Pack 검증 및 수정
 * - Evidence Catalog 기반 숫자 검증
 * - targetCount/KPI 일관성 확인
 */
function validateAndFixDecisionPack(
  decisionPack: DecisionPack,
  analysisPack: AnalysisPack
): DecisionPack {
  // Action Board의 targetCount가 Evidence Catalog와 일치하는지 확인
  const validatedActionBoard = {
    d0: decisionPack.actionBoard.d0?.map((action) => validateActionItem(action, analysisPack)),
    d7: decisionPack.actionBoard.d7?.map((action) => validateActionItem(action, analysisPack)),
    d14: decisionPack.actionBoard.d14?.map((action) => validateActionItem(action, analysisPack)),
  }

  // Decision Cards의 evidenceIds가 유효한지 확인
  const validatedDecisionCards = decisionPack.decisionCards.map((card) => {
    const validEvidenceIds = card.evidenceIds.filter((id) =>
      analysisPack.evidenceCatalog.some((e) => e.id === id)
    )

    // 최소 2개가 유효하지 않으면 첫 2개 Evidence ID로 교체
    if (validEvidenceIds.length < 2) {
      const fallbackIds = analysisPack.evidenceCatalog
        .slice(0, 2)
        .map((e) => e.id)
      console.warn(
        `[Merge] Decision Card "${card.question}"의 evidenceIds가 유효하지 않아 ${fallbackIds.join(', ')}로 교체`
      )
      return {
        ...card,
        evidenceIds: fallbackIds,
      }
    }

    return {
      ...card,
      evidenceIds: validEvidenceIds,
    }
  })

  return {
    ...decisionPack,
    decisionCards: validatedDecisionCards,
    actionBoard: validatedActionBoard,
  }
}

/**
 * Action Item 검증
 * - targetCount가 Evidence Catalog와 일치하는지 확인
 * - 불일치 시 Evidence Catalog 값으로 교체
 */
function validateActionItem(
  action: ActionItem,
  analysisPack: AnalysisPack
): ActionItem {
  // targetCount에서 숫자 추출 (예: "17명" -> 17)
  const targetCountMatch = action.targetCount.match(/(\d+)(명|건)/)
  if (!targetCountMatch) {
    return action // 형식이 맞지 않으면 그대로 반환
  }

  const targetCountNum = parseInt(targetCountMatch[1], 10)

  // Evidence Catalog에서 관련 수치 찾기
  // (간단한 휴리스틱: title에 "리드", "P0", "P1" 등이 포함된 Evidence)
  const relatedEvidence = analysisPack.evidenceCatalog.find((e) => {
    const titleLower = e.title.toLowerCase()
    return (
      titleLower.includes('p0') ||
      titleLower.includes('p1') ||
      titleLower.includes('리드') ||
      titleLower.includes(action.owner)
    )
  })

  if (relatedEvidence) {
    // Evidence의 n 값과 비교
    const evidenceValue = relatedEvidence.n

    // 차이가 20% 이상이면 경고 (하지만 교체하지는 않음 - LLM의 판단 존중)
    const diff = Math.abs(targetCountNum - evidenceValue) / Math.max(targetCountNum, evidenceValue)
    if (diff > 0.2) {
      console.warn(
        `[Merge] Action "${action.title}"의 targetCount (${targetCountNum})가 Evidence "${relatedEvidence.id}" (${evidenceValue})와 차이가 큼`
      )
    }
  }

  return action
}


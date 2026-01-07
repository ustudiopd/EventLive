/**
 * Guideline 적용 유틸리티
 * Guideline Pack을 Analysis Pack 생성에 적용
 * 
 * 명세서 기반 보완: 표준 Role 지원, 옵션 매핑, 다중선택 전략
 */

import type { GuidelinePack, Role, MultiSelectStrategy } from './guidelinePackSchema'
import { normalizeLegacyRole } from './guidelinePackSchema'
import type { QuestionWithRole, QuestionRole, standardRoleToQuestionRole } from './roleInference'
import { standardRoleToQuestionRole as convertRole } from './roleInference'

/**
 * Guideline Role을 QuestionRole로 변환 (표준 Role 지원)
 */
function mapGuidelineRoleToQuestionRole(role: Role): QuestionRole {
  return convertRole(role)
}

/**
 * Guideline의 questionMap을 기반으로 문항 역할 매핑 적용
 * logicalKey 지원 추가
 */
export function applyGuidelineRoleMapping(
  questions: Array<{ id: string; body?: string; type?: string; options?: any; logical_key?: string | null }>,
  guideline: GuidelinePack
): QuestionWithRole[] {
  return questions.map((q) => {
    // 1. ID로 매핑 시도
    let mapping = guideline.questionMap.find((qm) => qm.questionId === q.id)
    
    // 2. logicalKey로 매핑 시도 (ID 매핑 실패 시)
    if (!mapping && q.logical_key) {
      mapping = guideline.questionMap.find((qm) => qm.logicalKey === q.logical_key)
    }
    
    if (mapping) {
      return {
        id: q.id,
        body: q.body || '',
        type: (q.type || mapping.questionType || 'other') as 'single' | 'multiple' | 'text',
        options: q.options,
        role: mapGuidelineRoleToQuestionRole(mapping.role),
        roleSource: 'override', // Guideline은 수동 override로 간주
      }
    }

    // 매핑이 없으면 기본값
    return {
      id: q.id,
      body: q.body || '',
      type: (q.type || 'other') as 'single' | 'multiple' | 'text',
      options: q.options,
      role: 'other',
      roleSource: 'unknown',
    }
  })
}

/**
 * 옵션을 그룹으로 매핑 (명세서 제안: byOptionId/byOptionText)
 */
export function mapOptionToGroup(
  optionId: string | undefined,
  optionText: string | undefined,
  optionMap?: GuidelinePack['questionMap'][0]['optionMap']
): string | null {
  if (!optionMap) return null

  // 1. byOptionId 우선
  if (optionId && optionMap.byOptionId?.[optionId]) {
    return optionMap.byOptionId[optionId].groupKey
  }

  // 2. byOptionText fallback
  if (optionText && optionMap.byOptionText?.[optionText]) {
    return optionMap.byOptionText[optionText].groupKey
  }

  return null
}

/**
 * 그룹별 스코어 가져오기
 */
export function getGroupScore(
  groupKey: string,
  groups?: GuidelinePack['questionMap'][0]['groups']
): number | null {
  if (!groups || !groups[groupKey]) return null
  return groups[groupKey].score ?? null
}

/**
 * 다중선택 전략 적용
 */
export function applyMultiSelectStrategy(
  scores: number[],
  strategy: MultiSelectStrategy | undefined
): number {
  if (!strategy || scores.length === 0) {
    // 기본값: max
    return Math.max(...scores)
  }

  switch (strategy) {
    case 'max':
      return Math.max(...scores)
    case 'sumCap':
      return Math.min(100, scores.reduce((sum, s) => sum + s, 0))
    case 'binaryAny':
      return scores.some((s) => s > 0) ? 1 : 0
    default:
      return Math.max(...scores)
  }
}

/**
 * Guideline의 교차표 계획 반환 (레거시 + 새로운 구조 지원)
 */
export function getCrosstabPlanFromGuideline(guideline: GuidelinePack) {
  // 새로운 crosstabs.pinned 구조 우선
  if (guideline.crosstabs?.pinned) {
    return guideline.crosstabs.pinned.map((p) => ({
      rowRole: p.rowRole,
      colRole: p.colRole,
      minCellN: p.minCellCount,
      topKRows: guideline.crosstabs?.autoPick?.topK || 5,
      topKCols: guideline.crosstabs?.autoPick?.topK || 5,
    }))
  }

  // 레거시 crosstabPlan
  return guideline.crosstabPlan || []
}

/**
 * Guideline의 교차표 autoPick 설정 반환
 */
export function getCrosstabAutoPickFromGuideline(guideline: GuidelinePack) {
  return guideline.crosstabs?.autoPick
}

/**
 * Guideline의 leadScoring 설정 반환
 */
export function getLeadScoringFromGuideline(guideline: GuidelinePack) {
  return guideline.leadScoring
}

/**
 * Guideline의 Decision Cards 설정 반환
 */
export function getDecisionCardsFromGuideline(guideline: GuidelinePack) {
  return guideline.decisionCards
}

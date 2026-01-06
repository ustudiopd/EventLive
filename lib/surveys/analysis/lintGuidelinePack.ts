/**
 * Guideline Pack Linter
 * Guideline Pack의 품질과 완전성을 검증
 */

import type { GuidelinePack } from './guidelinePackSchema'

export interface LinterWarning {
  level: 'error' | 'warning' | 'info'
  field: string
  message: string
}

export interface LinterResult {
  isValid: boolean
  warnings: LinterWarning[]
}

/**
 * Guideline Pack Lint
 */
export function lintGuidelinePack(pack: GuidelinePack): LinterResult {
  const warnings: LinterWarning[] = []

  // 1. Version 검증
  if (pack.version !== 'gp-1.0') {
    warnings.push({
      level: 'error',
      field: 'version',
      message: `버전이 올바르지 않습니다. 예상: gp-1.0, 실제: ${pack.version}`,
    })
  }

  // 2. Form Fingerprint 검증
  if (!pack.formFingerprint || pack.formFingerprint.length !== 64) {
    warnings.push({
      level: 'error',
      field: 'formFingerprint',
      message: 'Form Fingerprint가 올바른 형식이 아닙니다 (SHA256 해시여야 함)',
    })
  }

  // 3. Objectives 검증
  if (!pack.objectives.primaryDecisionQuestions || pack.objectives.primaryDecisionQuestions.length < 3) {
    warnings.push({
      level: 'warning',
      field: 'objectives.primaryDecisionQuestions',
      message: '디시전 질문이 최소 3개 이상 필요합니다',
    })
  }

  // 4. QuestionMap 검증
  if (!pack.questionMap || pack.questionMap.length === 0) {
    warnings.push({
      level: 'error',
      field: 'questionMap',
      message: '문항 매핑이 비어있습니다',
    })
  } else {
    // 역할 분포 확인
    const roleCounts: Record<string, number> = {}
    pack.questionMap.forEach((q) => {
      roleCounts[q.role] = (roleCounts[q.role] || 0) + 1
    })

    // 핵심 역할 확인
    const coreRoles = ['timeline', 'engagement_intent']
    coreRoles.forEach((role) => {
      if (!roleCounts[role]) {
        warnings.push({
          level: 'warning',
          field: 'questionMap',
          message: `핵심 역할 "${role}"에 해당하는 문항이 없습니다`,
        })
      }
    })

    // 옵션 그룹핑 확인 (timeline 문항)
    const timelineQuestions = pack.questionMap.filter((q) => q.role === 'timeline')
    timelineQuestions.forEach((q) => {
      if (!q.optionGroups || q.optionGroups.length === 0) {
        warnings.push({
          level: 'info',
          field: `questionMap[${q.questionId}].optionGroups`,
          message: 'Timeline 문항에 옵션 그룹핑이 없습니다 (권장)',
        })
      }
    })
  }

  // 5. CrosstabPlan 검증
  if (!pack.crosstabPlan || pack.crosstabPlan.length < 2) {
    warnings.push({
      level: 'warning',
      field: 'crosstabPlan',
      message: '교차표 계획이 최소 2개 이상 필요합니다',
    })
  } else {
    pack.crosstabPlan.forEach((plan, idx) => {
      if (plan.minCellN < 3) {
        warnings.push({
          level: 'warning',
          field: `crosstabPlan[${idx}].minCellN`,
          message: '최소 셀 수가 너무 작습니다 (권장: 5 이상)',
        })
      }
    })
  }

  // 6. LeadScoring 검증
  if (!pack.leadScoring.enabled) {
    warnings.push({
      level: 'info',
      field: 'leadScoring.enabled',
      message: '리드 스코어링이 비활성화되어 있습니다',
    })
  } else {
    if (!pack.leadScoring.components || pack.leadScoring.components.length < 3) {
      warnings.push({
        level: 'warning',
        field: 'leadScoring.components',
        message: '리드 스코어링 컴포넌트가 최소 3개 이상 필요합니다',
      })
    }

    // Tier thresholds 검증
    const thresholds = pack.leadScoring.tierThresholds
    if (thresholds.P0 <= thresholds.P1 || thresholds.P1 <= thresholds.P2 || thresholds.P2 <= thresholds.P3) {
      warnings.push({
        level: 'error',
        field: 'leadScoring.tierThresholds',
        message: '티어 임계값이 올바른 순서가 아닙니다 (P0 > P1 > P2 > P3)',
      })
    }
  }

  const hasErrors = warnings.some((w) => w.level === 'error')
  return {
    isValid: !hasErrors,
    warnings,
  }
}

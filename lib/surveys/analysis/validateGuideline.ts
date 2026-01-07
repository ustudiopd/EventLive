/**
 * Guideline 검증 모듈
 * 발행 전 필수 검증 규칙 적용
 * 
 * 명세서 기반: validation 엔드포인트용
 */

import type { GuidelinePack } from './guidelinePackSchema'

export interface ValidationError {
  code: string
  message: string
  path?: string[]
}

export interface ValidationWarning {
  code: string
  message: string
  path?: string[]
  autoFixable?: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * Guideline Pack 검증
 */
export function validateGuidelinePack(
  guideline: GuidelinePack,
  currentFormFingerprint?: string
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 1. Fingerprint mismatch 검증
  if (
    currentFormFingerprint &&
    guideline.formFingerprint !== currentFormFingerprint &&
    guideline.validation?.warnIfFormFingerprintMismatch !== false
  ) {
    warnings.push({
      code: 'FINGERPRINT_MISMATCH',
      message: '폼 구조가 변경되었습니다. Guideline을 재검토하거나 reconcile을 수행하세요.',
      path: ['formFingerprint'],
      autoFixable: true,
    })
  }

  // 2. 문항 매핑 검증
  for (const [index, question] of guideline.questionMap.entries()) {
    const path = ['questionMap', index.toString()]

    // 2-1. Role 검증
    if (!question.role || question.role === 'other') {
      if (question.importance === 'core') {
        errors.push({
          code: 'CORE_QUESTION_WITHOUT_ROLE',
          message: `핵심 문항(${question.questionId})에 role이 없거나 'other'입니다.`,
          path: [...path, 'role'],
        })
      } else {
        warnings.push({
          code: 'QUESTION_WITHOUT_ROLE',
          message: `문항(${question.questionId})에 role이 없습니다.`,
          path: [...path, 'role'],
        })
      }
    }

    // 2-2. 옵션 매핑 검증 (single/multiple 문항)
    if (
      (question.questionType === 'single' || question.questionType === 'multiple') &&
      !question.optionMap &&
      !question.optionGroups
    ) {
      warnings.push({
        code: 'NO_OPTION_MAPPING',
        message: `문항(${question.questionId})에 옵션 매핑이 없습니다.`,
        path: [...path, 'optionMap'],
      })
    }

    // 2-3. 다중선택 전략 검증
    if (question.questionType === 'multiple' && !question.multiSelectStrategy) {
      warnings.push({
        code: 'NO_MULTISELECT_STRATEGY',
        message: `다중선택 문항(${question.questionId})에 multiSelectStrategy가 없습니다. 기본값 'max'가 사용됩니다.`,
        path: [...path, 'multiSelectStrategy'],
        autoFixable: true,
      })
    }

    // 2-4. 옵션 매핑 완전성 검증
    if (question.optionMap) {
      const mappedOptionIds = Object.keys(question.optionMap.byOptionId || {})
      const mappedOptionTexts = Object.keys(question.optionMap.byOptionText || {})
      const totalMapped = mappedOptionIds.length + mappedOptionTexts.length

      if (totalMapped === 0) {
        warnings.push({
          code: 'EMPTY_OPTION_MAP',
          message: `문항(${question.questionId})의 optionMap이 비어있습니다.`,
          path: [...path, 'optionMap'],
        })
      }
    }

    // 2-5. Groups 스코어 검증
    if (question.groups) {
      for (const [groupKey, groupDef] of Object.entries(question.groups)) {
        if (groupDef.score === undefined && question.importance === 'core') {
          warnings.push({
            code: 'CORE_GROUP_WITHOUT_SCORE',
            message: `핵심 문항(${question.questionId})의 그룹 "${groupKey}"에 score가 없습니다.`,
            path: [...path, 'groups', groupKey, 'score'],
          })
        }
      }
    }
  }

  // 3. 교차표 계획 검증
  const crosstabCount =
    (guideline.crosstabs?.pinned?.length || 0) +
    (guideline.crosstabPlan?.length || 0)

  if (crosstabCount === 0) {
    warnings.push({
      code: 'NO_CROSSTAB_PLAN',
      message: '교차표 계획이 없습니다. 최소 1개 이상 권장합니다.',
      path: ['crosstabs'],
    })
  }

  // 4. 리드 스코어링 검증
  if (guideline.leadScoring.enabled) {
    // 4-1. 필수 role 검증
    if (guideline.validation?.requireRolesForLeadScoringAny) {
      const requiredRoles = guideline.validation.requireRolesForLeadScoringAny
      const questionRoles = new Set(guideline.questionMap.map((q) => q.role))
      const missingRoles = requiredRoles.filter((role) => !questionRoles.has(role))

      if (missingRoles.length > 0) {
        errors.push({
          code: 'MISSING_REQUIRED_ROLES_FOR_LEAD_SCORING',
          message: `리드 스코어링에 필요한 role이 없습니다: ${missingRoles.join(', ')}`,
          path: ['leadScoring', 'components'],
        })
      }
    }

    // 4-2. 컴포넌트 검증
    if (guideline.leadScoring.components.length === 0) {
      errors.push({
        code: 'NO_LEAD_SCORING_COMPONENTS',
        message: '리드 스코어링이 활성화되었지만 컴포넌트가 없습니다.',
        path: ['leadScoring', 'components'],
      })
    }

    // 4-3. 티어 임계값 검증
    const thresholds = guideline.leadScoring.tierThresholds
    if (thresholds.P0 <= thresholds.P1 || thresholds.P1 <= thresholds.P2 || thresholds.P2 <= thresholds.P3) {
      errors.push({
        code: 'INVALID_TIER_THRESHOLDS',
        message: '티어 임계값이 올바르지 않습니다. P0 > P1 > P2 > P3 이어야 합니다.',
        path: ['leadScoring', 'tierThresholds'],
      })
    }
  }

  // 5. Decision Cards 검증
  if (guideline.decisionCards?.preferredTemplates) {
    if (guideline.decisionCards.preferredTemplates.length === 0) {
      warnings.push({
        code: 'EMPTY_PREFERRED_TEMPLATES',
        message: 'preferredTemplates가 비어있습니다.',
        path: ['decisionCards', 'preferredTemplates'],
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

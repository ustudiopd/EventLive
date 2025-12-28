/**
 * Decision Pack Linter
 * Decision Pack 품질 검증
 */

import type { DecisionPack } from './decisionPackSchema'
import type { AnalysisPack } from './analysisPackSchema'

export interface LinterWarning {
  level: 'error' | 'warning'
  field: string
  message: string
  details?: string
}

export interface LinterResult {
  isValid: boolean
  warnings: LinterWarning[]
}

/**
 * Decision Pack 품질 검증
 */
export function lintDecisionPack(
  decisionPack: DecisionPack,
  analysisPack: AnalysisPack
): LinterResult {
  const warnings: LinterWarning[] = []

  // 1. Decision Cards 검증
  if (decisionPack.decisionCards.length < 3) {
    warnings.push({
      level: 'error',
      field: 'decisionCards',
      message: `Decision Cards는 최소 3개 이상이어야 합니다. 현재: ${decisionPack.decisionCards.length}개`,
    })
  }

  decisionPack.decisionCards.forEach((card, index) => {
    // evidenceIds 검증
    if (card.evidenceIds.length < 2) {
      warnings.push({
        level: 'error',
        field: `decisionCards[${index}].evidenceIds`,
        message: '각 Decision Card는 최소 2개 이상의 evidenceIds를 포함해야 합니다.',
      })
    }

    // Evidence Catalog에 존재하는지 확인
    const invalidEvidenceIds = card.evidenceIds.filter(
      (id) => !analysisPack.evidenceCatalog.some((e) => e.id === id)
    )

    if (invalidEvidenceIds.length > 0) {
      warnings.push({
        level: 'warning',
        field: `decisionCards[${index}].evidenceIds`,
        message: `다음 Evidence ID가 Evidence Catalog에 존재하지 않습니다: ${invalidEvidenceIds.join(', ')}`,
      })
    }

    // recommendation이 유효한 옵션인지 확인
    const validOptionIds = card.options.map((opt) => opt.id)
    if (!validOptionIds.includes(card.recommendation)) {
      warnings.push({
        level: 'error',
        field: `decisionCards[${index}].recommendation`,
        message: `Recommendation은 유효한 Option ID 중 하나여야 합니다. 현재: ${card.recommendation}, 유효한 옵션: ${validOptionIds.join(', ')}`,
      })
    }

    // rationale 길이 검증
    if (card.rationale.length < 20) {
      warnings.push({
        level: 'warning',
        field: `decisionCards[${index}].rationale`,
        message: `Rationale은 최소 20자 이상 권장됩니다. 현재: ${card.rationale.length}자`,
      })
    }
  })

  // 2. Action Board 검증
  const allActionItems = [
    ...(decisionPack.actionBoard.d0 || []),
    ...(decisionPack.actionBoard.d7 || []),
    ...(decisionPack.actionBoard.d14 || []),
  ]

  if (allActionItems.length === 0) {
    warnings.push({
      level: 'error',
      field: 'actionBoard',
      message: 'Action Board에 최소 1개 이상의 실행 항목이 있어야 합니다.',
    })
  }

  allActionItems.forEach((item, itemIndex) => {
    // targetCount 검증
    if (!item.targetCount || !/\d+(명|건)/.test(item.targetCount)) {
      warnings.push({
        level: 'error',
        field: `actionBoard.item[${itemIndex}].targetCount`,
        message: 'Action Item은 대상 수량(N명 또는 K건)을 포함해야 합니다.',
      })
    }

    // KPI 검증
    if (!item.kpi || item.kpi.length < 5) {
      warnings.push({
        level: 'error',
        field: `actionBoard.item[${itemIndex}].kpi`,
        message: 'Action Item은 목표 KPI를 포함해야 합니다 (최소 5자).',
      })
    }

    // owner 필드 검증
    if (!['sales', 'marketing', 'ops'].includes(item.owner)) {
      warnings.push({
        level: 'error',
        field: `actionBoard.item[${itemIndex}].owner`,
        message: `owner 필드는 'sales', 'marketing', 'ops' 중 하나여야 합니다. 현재: ${item.owner}`,
      })
    }

    // steps 검증
    if (!item.steps || item.steps.length === 0) {
      warnings.push({
        level: 'error',
        field: `actionBoard.item[${itemIndex}].steps`,
        message: 'Action Item은 최소 1개 이상의 실행 단계를 포함해야 합니다.',
      })
    }
  })

  // 3. Playbooks 검증
  if (decisionPack.playbooks.sales.length < 3) {
    warnings.push({
      level: 'warning',
      field: 'playbooks.sales',
      message: `세일즈 플레이북은 최소 3개 이상 권장됩니다. 현재: ${decisionPack.playbooks.sales.length}개`,
    })
  }

  if (decisionPack.playbooks.marketing.length < 3) {
    warnings.push({
      level: 'warning',
      field: 'playbooks.marketing',
      message: `마케팅 플레이북은 최소 3개 이상 권장됩니다. 현재: ${decisionPack.playbooks.marketing.length}개`,
    })
  }

  // 4. Survey Next Questions 검증
  if (decisionPack.surveyNextQuestions.length < 2) {
    warnings.push({
      level: 'warning',
      field: 'surveyNextQuestions',
      message: `Survey Next Questions는 최소 2개 이상 권장됩니다. 현재: ${decisionPack.surveyNextQuestions.length}개`,
    })
  }

  decisionPack.surveyNextQuestions.forEach((q, index) => {
    if (q.why.length < 10) {
      warnings.push({
        level: 'warning',
        field: `surveyNextQuestions[${index}].why`,
        message: `Why 필드는 최소 10자 이상 권장됩니다. 현재: ${q.why.length}자`,
      })
    }
  })

  // 5. 플레이스홀더 감지
  const placeholderPatterns = [
    /ℹ️ 정보:/,
    /ℼ 정보:/,
    /TODO/,
    /TBD/,
    /예시/,
    /샘플/,
  ]

  const allText = JSON.stringify(decisionPack)
  placeholderPatterns.forEach((pattern) => {
    if (pattern.test(allText)) {
      warnings.push({
        level: 'error',
        field: 'decisionPack',
        message: `플레이스홀더 텍스트가 감지되었습니다: ${pattern.source}`,
      })
    }
  })

  const errors = warnings.filter((w) => w.level === 'error')
  const isValid = errors.length === 0

  return {
    isValid,
    warnings,
  }
}

/**
 * Linter 경고를 재시도 프롬프트로 변환
 */
export function buildQualityPrompt(warnings: LinterWarning[]): string {
  if (warnings.length === 0) {
    return ''
  }

  const errorWarnings = warnings.filter((w) => w.level === 'error')
  const warningWarnings = warnings.filter((w) => w.level === 'warning')

  let prompt = '\n\n**품질 검증 오류 (반드시 수정하세요):**\n'

  if (errorWarnings.length > 0) {
    prompt += errorWarnings
      .slice(0, 10)
      .map((w) => `- [ERROR] ${w.field}: ${w.message}`)
      .join('\n')
  }

  if (warningWarnings.length > 0) {
    prompt += '\n\n**품질 개선 권장사항:**\n'
    prompt += warningWarnings
      .slice(0, 10)
      .map((w) => `- [WARNING] ${w.field}: ${w.message}`)
      .join('\n')
  }

  prompt += '\n\n위 오류를 모두 수정한 올바른 Decision Pack JSON을 생성하세요.'

  return prompt
}



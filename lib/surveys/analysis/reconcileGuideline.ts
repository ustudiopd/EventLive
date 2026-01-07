/**
 * Guideline Reconcile 모듈
 * Form Fingerprint mismatch 시 Guideline을 현재 폼 구조에 맞게 조정
 * 
 * 명세서 기반: Fingerprint mismatch 처리
 */

import type { GuidelinePack, Role } from './guidelinePackSchema'
import { normalizeLegacyRole } from './guidelinePackSchema'
import type { QuestionWithRole } from './roleInference'

export interface ReconcileResult {
  canReconcile: boolean
  confidence: number // 0~1
  warnings: string[]
  reconciled?: GuidelinePack
}

/**
 * Guideline을 현재 폼 구조에 맞게 조정
 * 
 * @param guideline 기존 Guideline Pack
 * @param currentFormFingerprint 현재 폼의 Fingerprint
 * @param currentQuestions 현재 폼의 문항 목록
 */
export function reconcileGuideline(
  guideline: GuidelinePack,
  currentFormFingerprint: string,
  currentQuestions: QuestionWithRole[]
): ReconcileResult {
  const warnings: string[] = []
  let confidence = 1.0

  // 1. Fingerprint 일치 확인
  if (guideline.formFingerprint === currentFormFingerprint) {
    return {
      canReconcile: true,
      confidence: 1.0,
      warnings: [],
      reconciled: guideline,
    }
  }

  // 2. 문항 수 변경 감지
  const guidelineQuestionCount = guideline.questionMap.length
  const currentQuestionCount = currentQuestions.length

  if (guidelineQuestionCount !== currentQuestionCount) {
    warnings.push(
      `문항 수가 변경되었습니다: ${guidelineQuestionCount}개 → ${currentQuestionCount}개`
    )
    confidence -= 0.3
  }

  // 3. 문항 ID 매칭 시도
  const matchedQuestions: Array<{
    guidelineItem: typeof guideline.questionMap[0]
    currentQuestion: QuestionWithRole
    matchType: 'id' | 'logicalKey' | 'order' | 'role' | 'none'
  }> = []

  for (const guidelineItem of guideline.questionMap) {
    // 3-1. ID로 매칭
    const byId = currentQuestions.find((q) => q.id === guidelineItem.questionId)
    if (byId) {
      matchedQuestions.push({
        guidelineItem,
        currentQuestion: byId,
        matchType: 'id',
      })
      continue
    }

    // 3-2. logicalKey로 매칭
    if (guidelineItem.logicalKey) {
      // logicalKey는 현재 구현에서 아직 없으므로, orderNo로 대체
      const byOrder = currentQuestions.find(
        (q, idx) => idx + 1 === guidelineItem.orderNo
      )
      if (byOrder) {
        matchedQuestions.push({
          guidelineItem,
          currentQuestion: byOrder,
          matchType: 'order',
        })
        confidence -= 0.1
        continue
      }
    }

    // 3-3. Role로 매칭 (같은 순서에 같은 role)
    const byRole = currentQuestions.find(
      (q, idx) =>
        idx + 1 === guidelineItem.orderNo &&
        normalizeLegacyRole(q.role) === guidelineItem.role
    )
    if (byRole) {
      matchedQuestions.push({
        guidelineItem,
        currentQuestion: byRole,
        matchType: 'role',
      })
      confidence -= 0.2
      warnings.push(
        `문항 "${guidelineItem.questionId}"는 role 기반으로 매칭되었습니다.`
      )
      continue
    }

    // 매칭 실패
    matchedQuestions.push({
      guidelineItem,
      currentQuestion: currentQuestions[matchedQuestions.length] || currentQuestions[0],
      matchType: 'none',
    })
    confidence -= 0.5
    warnings.push(
      `문항 "${guidelineItem.questionId}"를 매칭할 수 없습니다.`
    )
  }

  // 4. 매칭된 문항이 너무 적으면 reconcile 불가
  const matchedCount = matchedQuestions.filter((m) => m.matchType !== 'none').length
  if (matchedCount < guidelineQuestionCount * 0.5) {
    return {
      canReconcile: false,
      confidence: 0,
      warnings: [
        ...warnings,
        `매칭 가능한 문항이 너무 적습니다 (${matchedCount}/${guidelineQuestionCount}). 새 Guideline을 생성하세요.`,
      ],
    }
  }

  // 5. Reconcile된 Guideline 생성
  const reconciled: GuidelinePack = {
    ...guideline,
    formFingerprint: currentFormFingerprint,
    questionMap: matchedQuestions.map((match) => {
      const { guidelineItem, currentQuestion } = match

      // 옵션 매핑이 있으면 현재 옵션과 비교
      if (guidelineItem.optionMap && currentQuestion.options) {
        const currentOptionIds = currentQuestion.options.map((opt) => opt.id)
        const currentOptionTexts = currentQuestion.options.map((opt) => opt.text)

        // 기존 매핑에서 현재 옵션에 없는 것 제거
        const reconciledOptionMap = {
          byOptionId: {} as Record<string, { groupKey: string }>,
          byOptionText: {} as Record<string, { groupKey: string }>,
        }

        if (guidelineItem.optionMap.byOptionId) {
          for (const [optionId, mapping] of Object.entries(
            guidelineItem.optionMap.byOptionId
          )) {
            if (currentOptionIds.includes(optionId)) {
              reconciledOptionMap.byOptionId[optionId] = mapping
            } else {
              warnings.push(
                `옵션 ID "${optionId}"가 현재 폼에 없습니다. 매핑이 제거됩니다.`
              )
            }
          }
        }

        if (guidelineItem.optionMap.byOptionText) {
          for (const [optionText, mapping] of Object.entries(
            guidelineItem.optionMap.byOptionText
          )) {
            if (currentOptionTexts.includes(optionText)) {
              reconciledOptionMap.byOptionText[optionText] = mapping
            } else {
              warnings.push(
                `옵션 텍스트 "${optionText}"가 현재 폼에 없습니다. 매핑이 제거됩니다.`
              )
            }
          }
        }

        return {
          ...guidelineItem,
          questionId: currentQuestion.id,
          optionMap: reconciledOptionMap,
        }
      }

      return {
        ...guidelineItem,
        questionId: currentQuestion.id,
      }
    }),
  }

  // 6. confidence 조정
  if (confidence < 0.5) {
    warnings.push(
      'Reconcile confidence가 낮습니다. 새 Guideline 생성 또는 수동 검토를 권장합니다.'
    )
  }

  return {
    canReconcile: true,
    confidence: Math.max(0, confidence),
    warnings,
    reconciled,
  }
}

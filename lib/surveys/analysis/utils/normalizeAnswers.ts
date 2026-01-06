/**
 * 답변 정규화 유틸리티
 * choice_ids와 text_answer를 안전하게 처리
 */

export interface NormalizedAnswer {
  submissionId: string
  questionId: string
  choiceIds: string[] // 선택형: 선택된 option ID 배열
  textAnswer: string | null // 텍스트형: 답변 텍스트
}

/**
 * choice_ids를 정규화된 문자열 배열로 변환
 */
export function normalizeChoiceIds(choiceIds: any): string[] {
  if (!choiceIds) {
    return []
  }

  // 이미 배열인 경우
  if (Array.isArray(choiceIds)) {
    return choiceIds.map((id) => String(id)).filter(Boolean)
  }

  // 문자열인 경우 JSON 파싱 시도
  if (typeof choiceIds === 'string') {
    try {
      const parsed = JSON.parse(choiceIds)
      return normalizeChoiceIds(parsed) // 재귀 호출
    } catch (e) {
      // JSON 파싱 실패: 단일 값으로 처리
      return [choiceIds]
    }
  }

  // 단일 값인 경우 배열로 변환
  return [String(choiceIds)]
}

/**
 * text_answer를 정규화된 문자열로 변환
 */
export function normalizeTextAnswer(textAnswer: any): string | null {
  if (!textAnswer) {
    return null
  }

  const normalized = String(textAnswer).trim()
  return normalized || null
}

/**
 * 답변을 정규화된 형태로 변환
 */
export function normalizeAnswer(answer: any): NormalizedAnswer {
  return {
    submissionId: answer.submission_id || answer.submissionId || '',
    questionId: answer.question_id || answer.questionId || '',
    choiceIds: normalizeChoiceIds(answer.choice_ids || answer.choiceIds),
    textAnswer: normalizeTextAnswer(answer.text_answer || answer.textAnswer),
  }
}

/**
 * 답변 배열을 정규화
 */
export function normalizeAnswers(answers: any[]): NormalizedAnswer[] {
  return answers.map((a) => normalizeAnswer(a))
}

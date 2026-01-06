/**
 * Survey Blueprint 생성
 * Guideline 생성용 최소 구조로 정리
 */

import { FormBlueprint } from './buildFormFingerprint'

export interface SurveyBlueprint {
  formId: string
  questions: Array<{
    id: string
    orderNo: number
    body: string
    type: 'single' | 'multiple' | 'text'
    options?: Array<{ id: string; text: string }>
  }>
}

/**
 * Raw form questions를 SurveyBlueprint로 변환
 */
export function buildSurveyBlueprint(
  formId: string,
  questions: Array<{
    id: string
    order_no: number
    body: string
    type: 'single' | 'multiple' | 'text'
    options?: any
  }>
): SurveyBlueprint {
  return {
    formId,
    questions: questions
      .sort((a, b) => a.order_no - b.order_no)
      .map((q) => {
        // 옵션 정규화
        let normalizedOptions: Array<{ id: string; text: string }> | undefined

        if (q.options && Array.isArray(q.options)) {
          normalizedOptions = q.options
            .map((opt: any) => {
              if (typeof opt === 'object' && opt !== null) {
                return {
                  id: String(opt.id || opt),
                  text: String(opt.text || opt.id || opt),
                }
              }
              return {
                id: String(opt),
                text: String(opt),
              }
            })
            .sort((a, b) => a.id.localeCompare(b.id))
        }

        return {
          id: q.id,
          orderNo: q.order_no,
          body: q.body.trim(),
          type: q.type,
          options: normalizedOptions,
        }
      }),
  }
}

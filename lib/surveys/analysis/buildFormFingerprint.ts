/**
 * Form Fingerprint 생성
 * 폼 구조의 변경을 감지하기 위한 SHA256 해시 생성
 */

import { createHash } from 'crypto'

export interface FormBlueprint {
  questions: Array<{
    id: string
    order_no: number
    body: string
    type: 'single' | 'multiple' | 'text'
    options?: Array<{ id: string; text: string }>
  }>
}

/**
 * 정규화된 폼 구조를 JSON 문자열로 변환 (정렬 보장)
 */
function serializeFormBlueprint(blueprint: FormBlueprint): string {
  const normalized = {
    questions: blueprint.questions
      .sort((a, b) => a.order_no - b.order_no)
      .map((q) => ({
        id: q.id,
        order_no: q.order_no,
        body: q.body.trim(),
        type: q.type,
        options:
          q.options && q.options.length > 0
            ? q.options
                .map((opt) => ({
                  id: opt.id,
                  text: opt.text.trim(),
                }))
                .sort((a, b) => a.id.localeCompare(b.id))
            : undefined,
      })),
  }

  return JSON.stringify(normalized, null, 0)
}

/**
 * Form Fingerprint 생성 (SHA256)
 */
export function buildFormFingerprint(blueprint: FormBlueprint): string {
  const serialized = serializeFormBlueprint(blueprint)
  return createHash('sha256').update(serialized, 'utf8').digest('hex')
}

/**
 * 두 Fingerprint 비교
 */
export function compareFormFingerprints(
  fp1: string,
  fp2: string
): boolean {
  return fp1 === fp2
}

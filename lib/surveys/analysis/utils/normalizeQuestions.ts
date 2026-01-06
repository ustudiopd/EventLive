/**
 * 문항 정규화 유틸리티
 * options 파싱 및 정규화를 안전하게 처리
 */

export interface NormalizedOption {
  id: string
  text: string
}

export interface NormalizedQuestion {
  id: string
  orderNo: number
  body: string
  type: 'single' | 'multiple' | 'text'
  options: NormalizedOption[] // 선택형만
  rawOptions: any // 원본 options (디버깅용)
}

/**
 * options를 정규화된 배열로 변환
 * 문자열 JSON, JSONB, 배열, 객체 등 다양한 형식 지원
 */
export function normalizeOptions(options: any): NormalizedOption[] {
  if (!options) {
    return []
  }

  // 이미 배열인 경우
  if (Array.isArray(options)) {
    return options.map((opt, index) => {
      if (typeof opt === 'string') {
        // 문자열인 경우: id와 text가 같다고 가정
        return { id: `opt_${index}`, text: opt }
      }
      if (typeof opt === 'object' && opt !== null) {
        // 객체인 경우: id와 text 추출
        const id = opt.id || opt.value || `opt_${index}`
        const text = opt.text || opt.label || opt.name || String(opt)
        return { id: String(id), text: String(text) }
      }
      // 기타: 문자열로 변환
      return { id: `opt_${index}`, text: String(opt) }
    })
  }

  // 문자열인 경우 JSON 파싱 시도
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options)
      return normalizeOptions(parsed) // 재귀 호출로 배열/객체 처리
    } catch (e) {
      // JSON 파싱 실패: 빈 배열 반환
      console.warn('[normalizeOptions] JSON 파싱 실패:', e)
      return []
    }
  }

  // 객체인 경우 (단일 옵션 객체)
  if (typeof options === 'object' && options !== null) {
    // 객체의 키가 id/text 형태인지 확인
    if ('id' in options || 'text' in options) {
      return [
        {
          id: String(options.id || options.value || 'opt_0'),
          text: String(options.text || options.label || options.name || ''),
        },
      ]
    }
    // 객체의 값들을 옵션으로 변환
    return Object.entries(options).map(([key, value]) => ({
      id: key,
      text: String(value),
    }))
  }

  // 파싱 불가능한 경우 빈 배열 반환
  console.warn('[normalizeOptions] 알 수 없는 options 형식:', typeof options)
  return []
}

/**
 * 문항을 정규화된 형태로 변환
 */
export function normalizeQuestion(question: any): NormalizedQuestion {
  const normalizedOptions = normalizeOptions(question.options)

  return {
    id: question.id,
    orderNo: question.order_no || 0,
    body: question.body || '',
    type: question.type || 'text',
    options: normalizedOptions,
    rawOptions: question.options, // 원본 보관 (디버깅용)
  }
}

/**
 * 문항 배열을 정규화
 */
export function normalizeQuestions(questions: any[]): NormalizedQuestion[] {
  return questions.map((q) => normalizeQuestion(q))
}

/**
 * 문항 역할(Role) 추정 모듈
 * 문항의 의미적 역할을 자동 추정하거나 수동 override 지원
 */

export type QuestionRole = 'timeframe' | 'project_type' | 'followup_intent' | 'budget_status' | 'authority_level' | 'other'

export type RoleSource = 'override' | 'heuristic' | 'unknown'

export interface QuestionWithRole {
  id: string
  body: string
  type: 'single' | 'multiple' | 'text'
  options?: Array<{ id: string; text: string }>
  role: QuestionRole
  roleSource: RoleSource
}

/**
 * Heuristic 규칙: 키워드 기반 역할 추정
 */
const ROLE_KEYWORDS: Record<QuestionRole, { body: string[]; options: string[] }> = {
  timeframe: {
    body: ['언제', '시기', '계획', '기간', '도입', '구매', '예정', '타임라인'],
    options: ['1주', '2주', '1개월', '3개월', '6개월', '올해', '내년', '즉시', '당장'],
  },
  project_type: {
    body: ['프로젝트', '분야', '영역', '종류', '유형', '적용', '용도', '사용', '구축'],
    options: ['데이터센터', '보안', '네트워크', '클라우드', '스위치', '라우터', '무선', '서버'],
  },
  followup_intent: {
    body: ['의향', '요청', '연락', '미팅', '데모', '상담', '제안', '자료', '방문', '컨택'],
    options: ['방문', '전화', '온라인', '데모', '자료', '관심 없음', '추후', '연락 원함'],
  },
  budget_status: {
    body: ['예산', '확보', '예산이', '예산은', '예산이 있', '예산이 없', '예산 확보', '예산 준비'],
    options: ['예', '아니오', '확보', '미확보', '있', '없'],
  },
  authority_level: {
    body: ['권한', '담당자', '의사결정', '구매', 'Authorized Buyer', '결정권', '결정', '권한이 있', '권한이 없'],
    options: ['예', '아니오', '권한', '담당자', '의사결정'],
  },
  other: {
    body: [],
    options: [],
  },
}

/**
 * 문항 본문과 옵션 텍스트에서 역할 추정
 */
function inferRoleFromHeuristic(
  body: string,
  options: Array<{ id: string; text: string }> = []
): QuestionRole {
  const bodyLower = body.toLowerCase()
  const optionsText = options.map((opt) => opt.text.toLowerCase()).join(' ')

  // 각 역할별 점수 계산
  const scores: Record<QuestionRole, number> = {
    timeframe: 0,
    project_type: 0,
    followup_intent: 0,
    budget_status: 0,
    authority_level: 0,
    other: 0,
  }

  // 본문 키워드 매칭
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (role === 'other') continue

    for (const keyword of keywords.body) {
      if (bodyLower.includes(keyword.toLowerCase())) {
        scores[role as QuestionRole] += 0.6
      }
    }
  }

  // 옵션 키워드 매칭
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (role === 'other') continue

    for (const keyword of keywords.options) {
      if (optionsText.includes(keyword.toLowerCase())) {
        scores[role as QuestionRole] += 0.4
      }
    }
  }

  // 최고 점수 역할 선택
  let maxScore = 0
  let bestRole: QuestionRole = 'other'

  for (const [role, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      bestRole = role as QuestionRole
    }
  }

  // 임계값 미달이면 other 처리 (오판 방지)
  return maxScore >= 0.5 ? bestRole : 'other'
}

/**
 * 문항에 역할 부여 (override 우선)
 */
export function inferQuestionRole(
  question: {
    id: string
    body: string
    type: 'single' | 'multiple' | 'text'
    options?: Array<{ id: string; text: string }> | any
    analysis_role_override?: string | null
  }
): QuestionWithRole {
  // 1. Override가 있으면 우선 사용
  if (question.analysis_role_override) {
    const overrideRole = question.analysis_role_override as QuestionRole
    if (['timeframe', 'project_type', 'followup_intent', 'budget_status', 'authority_level', 'other'].includes(overrideRole)) {
      return {
        id: question.id,
        body: question.body,
        type: question.type,
        options: Array.isArray(question.options)
          ? question.options.map((opt: any) => ({
              id: opt.id || String(opt),
              text: opt.text || String(opt),
            }))
          : undefined,
        role: overrideRole,
        roleSource: 'override',
      }
    }
  }

  // 2. Heuristic 추정
  const normalizedOptions = Array.isArray(question.options)
    ? question.options.map((opt: any) => ({
        id: opt.id || String(opt),
        text: opt.text || String(opt),
      }))
    : []

  const inferredRole = inferRoleFromHeuristic(question.body, normalizedOptions)

  return {
    id: question.id,
    body: question.body,
    type: question.type,
    options: normalizedOptions.length > 0 ? normalizedOptions : undefined,
    role: inferredRole,
    roleSource: inferredRole === 'other' ? 'unknown' : 'heuristic',
  }
}

/**
 * 문항 배열에 역할 부여
 */
export function inferQuestionRoles(
  questions: Array<{
    id: string
    body: string
    type: 'single' | 'multiple' | 'text'
    options?: any
    analysis_role_override?: string | null
  }>
): QuestionWithRole[] {
  return questions.map((q) => inferQuestionRole(q))
}

/**
 * Guideline Compile 모듈
 * roleKey/logicalKey → 실제 questionId로 resolve하는 컴파일 단계
 * 
 * 명세서 기반: Compile 단계 구현
 */

import type { GuidelinePack, QuestionMapItem } from './guidelinePackSchema'
import type { QuestionWithRole } from './roleInference'

export interface CompiledGuideline {
  version: string
  formId: string
  formFingerprint: string
  formRevision: number
  
  // Resolved question map (questionId 기반)
  questionMap: Array<{
    questionId: string
    logicalKey?: string
    role: string
    importance: string
    [key: string]: any
  }>
  
  // Resolved crosstab plan
  crosstabPlan: Array<{
    rowQuestionId: string
    colQuestionId: string
    minCellN: number
    topKRows: number
    topKCols: number
    note?: string
  }>
  
  // Resolved lead scoring components
  leadScoring: {
    enabled: boolean
    components: Array<{
      questionId: string
      role: string
      weight: number
    }>
    tierThresholds: Record<string, number>
    recommendedActionsByTier: Record<string, string>
  }
  
  warnings: string[]
}

export interface CompileResult {
  success: boolean
  compiled?: CompiledGuideline
  warnings: string[]
  errors: string[]
}

/**
 * Guideline Pack을 컴파일하여 실행 가능한 형태로 변환
 * 
 * @param guideline 원본 Guideline Pack
 * @param currentQuestions 현재 폼의 문항 목록
 * @param currentFormRevision 현재 폼의 revision
 */
export function compileGuideline(
  guideline: GuidelinePack,
  currentQuestions: QuestionWithRole[],
  currentFormRevision: number = 1
): CompileResult {
  const warnings: string[] = []
  const errors: string[] = []

  // 1. Question Map 컴파일 (roleKey/logicalKey → questionId)
  const compiledQuestionMap: CompiledGuideline['questionMap'] = []
  const questionIdMap = new Map<string, QuestionWithRole>()
  const logicalKeyMap = new Map<string, QuestionWithRole>()
  const roleMap = new Map<string, QuestionWithRole[]>()

  // 현재 문항 인덱싱
  currentQuestions.forEach((q) => {
    questionIdMap.set(q.id, q)
    
    // logical_key가 있으면 매핑 (향후 form_questions.logical_key 사용)
    // 현재는 questionId 기반으로만 매칭
  })

  // Role별로 그룹화
  currentQuestions.forEach((q) => {
    const role = q.role
    if (!roleMap.has(role)) {
      roleMap.set(role, [])
    }
    roleMap.get(role)!.push(q)
  })

  // Guideline의 questionMap을 컴파일
  for (const guidelineItem of guideline.questionMap) {
    let matchedQuestion: QuestionWithRole | null = null

    // 1. questionId로 직접 매칭
    if (guidelineItem.questionId) {
      matchedQuestion = questionIdMap.get(guidelineItem.questionId) || null
    }

    // 2. logicalKey로 매칭 (questionId 매칭 실패 시)
    if (!matchedQuestion && guidelineItem.logicalKey) {
      // 향후 form_questions.logical_key와 매칭
      // 현재는 questionId 기반으로만 처리
      warnings.push(
        `문항 "${guidelineItem.questionId}"의 logicalKey "${guidelineItem.logicalKey}"로 매칭 시도했으나 현재 구현에서는 questionId만 사용합니다.`
      )
    }

    // 3. role로 매칭 (logicalKey 매칭 실패 시)
    if (!matchedQuestion) {
      const roleQuestions = roleMap.get(guidelineItem.role) || []
      if (roleQuestions.length > 0) {
        // 같은 role의 첫 번째 문항 선택 (향후 더 정교한 매칭 가능)
        matchedQuestion = roleQuestions[0]
        warnings.push(
          `문항 "${guidelineItem.questionId}"는 role "${guidelineItem.role}" 기반으로 매칭되었습니다.`
        )
      }
    }

    if (matchedQuestion) {
      compiledQuestionMap.push({
        questionId: matchedQuestion.id,
        logicalKey: guidelineItem.logicalKey,
        role: guidelineItem.role,
        importance: guidelineItem.importance,
        orderNo: guidelineItem.orderNo,
        questionType: guidelineItem.questionType,
        label: guidelineItem.label,
        optionMap: guidelineItem.optionMap,
        groups: guidelineItem.groups,
        multiSelectStrategy: guidelineItem.multiSelectStrategy,
        optionGroups: guidelineItem.optionGroups,
        scoring: guidelineItem.scoring,
      })
    } else {
      errors.push(
        `문항 "${guidelineItem.questionId}" (role: ${guidelineItem.role})를 현재 폼에서 찾을 수 없습니다.`
      )
    }
  }

  // 2. Crosstab Plan 컴파일
  const compiledCrosstabPlan: CompiledGuideline['crosstabPlan'] = []

  // pinned 교차표 컴파일
  if (guideline.crosstabs?.pinned) {
    for (const pinned of guideline.crosstabs.pinned) {
      const rowQuestion = findQuestionByRoleOrLogicalKey(
        currentQuestions,
        pinned.rowRole,
        compiledQuestionMap
      )
      const colQuestion = findQuestionByRoleOrLogicalKey(
        currentQuestions,
        pinned.colRole,
        compiledQuestionMap
      )

      if (rowQuestion && colQuestion) {
        compiledCrosstabPlan.push({
          rowQuestionId: rowQuestion.id,
          colQuestionId: colQuestion.id,
          minCellN: pinned.minCellCount,
          topKRows: guideline.crosstabs.autoPick?.topK || 5,
          topKCols: guideline.crosstabs.autoPick?.topK || 5,
        })
      } else {
        warnings.push(
          `교차표 계획 (${pinned.rowRole} × ${pinned.colRole})을 컴파일할 수 없습니다.`
        )
      }
    }
  }

  // 레거시 crosstabPlan 컴파일
  if (guideline.crosstabPlan) {
    for (const plan of guideline.crosstabPlan) {
      const rowQuestion = findQuestionByRoleOrLogicalKey(
        currentQuestions,
        plan.rowRole,
        compiledQuestionMap
      )
      const colQuestion = findQuestionByRoleOrLogicalKey(
        currentQuestions,
        plan.colRole,
        compiledQuestionMap
      )

      if (rowQuestion && colQuestion) {
        compiledCrosstabPlan.push({
          rowQuestionId: rowQuestion.id,
          colQuestionId: colQuestion.id,
          minCellN: plan.minCellN,
          topKRows: plan.topKRows,
          topKCols: plan.topKCols,
          note: plan.note,
        })
      } else {
        warnings.push(
          `교차표 계획 (${plan.rowRole} × ${plan.colRole})을 컴파일할 수 없습니다.`
        )
      }
    }
  }

  // 3. Lead Scoring 컴파일
  const compiledComponents: CompiledGuideline['leadScoring']['components'] = []

  if (guideline.leadScoring.enabled) {
    for (const component of guideline.leadScoring.components) {
      const question = findQuestionByRoleOrLogicalKey(
        currentQuestions,
        component.role,
        compiledQuestionMap
      )

      if (question) {
        compiledComponents.push({
          questionId: question.id,
          role: component.role,
          weight: component.weight,
        })
      } else {
        warnings.push(
          `리드 스코어링 컴포넌트 (role: ${component.role})를 현재 폼에서 찾을 수 없습니다.`
        )
      }
    }
  }

  const compiled: CompiledGuideline = {
    version: guideline.version,
    formId: guideline.formId,
    formFingerprint: guideline.formFingerprint,
    formRevision: currentFormRevision,
    questionMap: compiledQuestionMap,
    crosstabPlan: compiledCrosstabPlan,
    leadScoring: {
      enabled: guideline.leadScoring.enabled && compiledComponents.length > 0,
      components: compiledComponents,
      tierThresholds: guideline.leadScoring.tierThresholds,
      recommendedActionsByTier: guideline.leadScoring.recommendedActionsByTier,
    },
    warnings,
  }

  return {
    success: errors.length === 0,
    compiled: errors.length === 0 ? compiled : undefined,
    warnings,
    errors,
  }
}

/**
 * Role 또는 LogicalKey로 문항 찾기
 */
function findQuestionByRoleOrLogicalKey(
  questions: QuestionWithRole[],
  roleOrLogicalKey: string,
  compiledQuestionMap: CompiledGuideline['questionMap']
): QuestionWithRole | null {
  // 1. compiledQuestionMap에서 logicalKey로 찾기
  const mapItem = compiledQuestionMap.find(
    (item) => item.logicalKey === roleOrLogicalKey
  )
  if (mapItem) {
    const question = questions.find((q) => q.id === mapItem.questionId)
    if (question) return question
  }

  // 2. Role로 찾기 (레거시 Role 매핑 포함)
  const roleMap: Record<string, string> = {
    timeline: 'timeframe',
    intent_followup: 'followup_intent',
    usecase_project_type: 'project_type',
    budget_status: 'budget_status',
    authority: 'authority_level',
  }

  const legacyRole = roleMap[roleOrLogicalKey] || roleOrLogicalKey

  const question = questions.find((q) => q.role === legacyRole)
  if (question) return question

  // 3. 표준 Role로 직접 찾기 (향후 확장)
  return null
}

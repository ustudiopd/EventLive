/**
 * Guideline 적용 유틸리티
 * Guideline Pack을 Analysis Pack 생성에 적용
 */

import type { GuidelinePack, Role } from './guidelinePackSchema'
import type { QuestionWithRole, QuestionRole } from './roleInference'

/**
 * Guideline Role을 QuestionRole로 변환
 */
function mapGuidelineRoleToQuestionRole(role: Role): QuestionRole {
  // Guideline의 Role은 'timeline', 'need_area', 'budget_status', 'authority_level', 'engagement_intent', 'other'
  // QuestionRole은 'timeframe', 'project_type', 'followup_intent', 'budget_status', 'authority_level', 'other'
  const roleMap: Record<Role, QuestionRole> = {
    timeline: 'timeframe',
    need_area: 'project_type',
    budget_status: 'budget_status',
    authority_level: 'authority_level',
    engagement_intent: 'followup_intent',
    other: 'other',
  }
  return roleMap[role] || 'other'
}

/**
 * Guideline의 questionMap을 기반으로 문항 역할 매핑 적용
 */
export function applyGuidelineRoleMapping(
  questions: Array<{ id: string; body?: string; type?: string; options?: any }>,
  guideline: GuidelinePack
): QuestionWithRole[] {
  return questions.map((q) => {
    const mapping = guideline.questionMap.find((qm) => qm.questionId === q.id)
    
    if (mapping) {
      return {
        id: q.id,
        body: q.body || '',
        type: (q.type || 'other') as 'single' | 'multiple' | 'text',
        options: q.options,
        role: mapGuidelineRoleToQuestionRole(mapping.role),
        roleSource: 'override', // Guideline은 수동 override로 간주
      }
    }

    // 매핑이 없으면 기본값
    return {
      id: q.id,
      body: q.body || '',
      type: (q.type || 'other') as 'single' | 'multiple' | 'text',
      options: q.options,
      role: 'other',
      roleSource: 'unknown',
    }
  })
}

/**
 * Guideline의 crosstabPlan을 기반으로 교차표 계획 반환
 */
export function getCrosstabPlanFromGuideline(guideline: GuidelinePack) {
  return guideline.crosstabPlan || []
}

/**
 * Guideline의 leadScoring 설정 반환
 */
export function getLeadScoringFromGuideline(guideline: GuidelinePack) {
  return guideline.leadScoring
}

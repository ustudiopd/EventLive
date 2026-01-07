/**
 * Guideline Pack (GP-1.0) Zod 스키마
 * 설문조사 AI 분석을 위한 구조화된 지침 정의
 * 
 * 명세서 기반 보완: 옵션 매핑, 다중선택 전략, Role Taxonomy 표준화
 */

import { z } from 'zod'

export const GP_VERSION = 'gp-1.0' as const

// 표준 Role Taxonomy (명세서 제안 기반)
export const RoleSchema = z.enum([
  'timeline',
  'intent_followup',      // engagement_intent의 표준화
  'usecase_project_type', // need_area의 표준화
  'budget_status',
  'authority',            // authority_level의 표준화
  'channel_preference',
  'need_pain',
  'barrier_risk',
  'company_profile',
  'free_text_voice',
  'other',
])

// 하위 호환성을 위한 레거시 Role (자동 매핑됨)
export const LegacyRoleSchema = z.enum([
  'timeline',
  'need_area',           // → usecase_project_type
  'budget_status',
  'authority_level',     // → authority
  'engagement_intent',   // → intent_followup
  'other',
])

export type Role = z.infer<typeof RoleSchema>
export type LegacyRole = z.infer<typeof LegacyRoleSchema>

// 옵션 매핑 구조 (명세서 제안: byOptionId/byOptionText)
export const OptionMapSchema = z.object({
  byOptionId: z.record(z.string(), z.object({
    groupKey: z.string(),
  })).optional(),
  byOptionText: z.record(z.string(), z.object({
    groupKey: z.string(),
  })).optional(),
})

// 옵션 그룹 정의 (스코어 포함)
export const OptionGroupDefinitionSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  score: z.number().optional(), // 0~100 또는 0~N
})

// 다중선택 전략
export const MultiSelectStrategySchema = z.enum(['max', 'sumCap', 'binaryAny'])

// 레거시 호환: 기존 optionGroups 구조
export const OptionGroupSchema = z.object({
  groupKey: z.string(),
  groupLabel: z.string(),
  choiceIds: z.array(z.string()),
})

export const QuestionScoringSchema = z.object({
  enabled: z.boolean(),
  weightsByGroupKey: z.record(z.string(), z.number()).optional(),
  weightsByChoiceId: z.record(z.string(), z.number()).optional(),
  defaultWeight: z.number().optional(),
})

export const QuestionMapItemSchema = z.object({
  questionId: z.string(),
  logicalKey: z.string().optional(), // 안정 키 (문항 유동성 대응)
  orderNo: z.number(),
  role: RoleSchema,
  importance: z.enum(['core', 'supporting', 'ignore']),
  questionType: z.enum(['single', 'multiple', 'text']).optional(), // 자동 추론 가능하지만 명시 가능
  label: z.string().optional(),
  
  // 새로운 옵션 매핑 구조 (명세서 제안)
  optionMap: OptionMapSchema.optional(),
  groups: z.record(z.string(), OptionGroupDefinitionSchema).optional(),
  
  // 다중선택 전략
  multiSelectStrategy: MultiSelectStrategySchema.optional(),
  
  // 레거시 호환: 기존 구조 (하위 호환성)
  optionGroups: z.array(OptionGroupSchema).optional(),
  scoring: QuestionScoringSchema.optional(),
})

export const ObjectivesSchema = z.object({
  primaryDecisionQuestions: z.array(z.string()),
  reportLensDefault: z.enum(['general', 'sales', 'marketing']),
})

// 교차표 계획 (명세서 제안: pinned + autoPick 구조)
export const CrosstabPlanItemSchema = z.object({
  rowRole: RoleSchema,
  colRole: RoleSchema,
  minCellN: z.number(), // minCellCount
  topKRows: z.number(),
  topKCols: z.number(),
  note: z.string().optional(),
})

// 교차표 설정 (명세서 제안 구조)
export const CrosstabsConfigSchema = z.object({
  pinned: z.array(z.object({
    rowRole: RoleSchema,
    colRole: RoleSchema,
    minCellCount: z.number(),
  })).optional(),
  autoPick: z.object({
    enabled: z.boolean(),
    topK: z.number(),
    minCellCount: z.number(),
  }).optional(),
})

export const LeadScoringComponentSchema = z.object({
  role: RoleSchema,
  weight: z.number(),
})

export const LeadScoringSchema = z.object({
  enabled: z.boolean(),
  normalize: z.enum(['weightedSumTo100']).optional().default('weightedSumTo100'),
  tierThresholds: z.object({
    P0: z.number(),
    P1: z.number(),
    P2: z.number(),
    P3: z.number(),
  }),
  components: z.array(LeadScoringComponentSchema),
  recommendedActionsByTier: z.record(
    z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
    z.string()
  ),
})

// Decision Cards 템플릿 설정 (명세서 제안)
export const DecisionCardsConfigSchema = z.object({
  preferredTemplates: z.array(z.string()).optional(), // CardTemplateId[]
  allowTemplates: z.array(z.string()).optional(),     // 제한하고 싶을 때
})

// 검증 규칙 (발행 게이트)
export const ValidationRulesSchema = z.object({
  minSampleCountToUseLeadScoring: z.number().optional(),
  requireRolesForLeadScoringAny: z.array(RoleSchema).optional(),
  warnIfFormFingerprintMismatch: z.boolean().optional().default(true),
})

export const GuidelinePackSchema = z.object({
  version: z.literal(GP_VERSION),
  formId: z.string(),
  formFingerprint: z.string(),
  objectives: ObjectivesSchema,
  questionMap: z.array(QuestionMapItemSchema),
  
  // 교차표: 레거시 crosstabPlan + 새로운 crosstabs 구조 모두 지원
  crosstabPlan: z.array(CrosstabPlanItemSchema).optional(), // 레거시 호환
  crosstabs: CrosstabsConfigSchema.optional(),              // 명세서 제안
  
  leadScoring: LeadScoringSchema,
  
  // Decision Cards 템플릿 연결
  decisionCards: DecisionCardsConfigSchema.optional(),
  
  // 검증 규칙
  validation: ValidationRulesSchema.optional(),
})

export type GuidelinePack = z.infer<typeof GuidelinePackSchema>
export type QuestionMapItem = z.infer<typeof QuestionMapItemSchema>
export type OptionGroup = z.infer<typeof OptionGroupSchema>
export type OptionMap = z.infer<typeof OptionMapSchema>
export type OptionGroupDefinition = z.infer<typeof OptionGroupDefinitionSchema>
export type CrosstabPlanItem = z.infer<typeof CrosstabPlanItemSchema>
export type CrosstabsConfig = z.infer<typeof CrosstabsConfigSchema>
export type LeadScoring = z.infer<typeof LeadScoringSchema>
export type Objectives = z.infer<typeof ObjectivesSchema>
export type DecisionCardsConfig = z.infer<typeof DecisionCardsConfigSchema>
export type ValidationRules = z.infer<typeof ValidationRulesSchema>
export type MultiSelectStrategy = z.infer<typeof MultiSelectStrategySchema>

/**
 * 레거시 Role을 표준 Role로 변환
 */
export function normalizeLegacyRole(role: string): Role {
  const roleMap: Record<string, Role> = {
    'timeline': 'timeline',
    'need_area': 'usecase_project_type',
    'budget_status': 'budget_status',
    'authority_level': 'authority',
    'engagement_intent': 'intent_followup',
    'other': 'other',
  }
  return roleMap[role] || 'other'
}

/**
 * 표준 Role을 레거시 Role로 변환 (하위 호환성)
 */
export function toLegacyRole(role: Role): LegacyRole {
  const reverseMap: Record<Role, LegacyRole> = {
    'timeline': 'timeline',
    'intent_followup': 'engagement_intent',
    'usecase_project_type': 'need_area',
    'budget_status': 'budget_status',
    'authority': 'authority_level',
    'channel_preference': 'other',
    'need_pain': 'other',
    'barrier_risk': 'other',
    'company_profile': 'other',
    'free_text_voice': 'other',
    'other': 'other',
  }
  return reverseMap[role] || 'other'
}
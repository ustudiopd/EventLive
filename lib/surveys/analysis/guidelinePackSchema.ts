/**
 * Guideline Pack (GP-1.0) Zod 스키마
 * 설문조사 AI 분석을 위한 구조화된 지침 정의
 */

import { z } from 'zod'

export const GP_VERSION = 'gp-1.0' as const

export const RoleSchema = z.enum([
  'timeline',
  'need_area',
  'budget_status',
  'authority_level',
  'engagement_intent',
  'other',
])

export type Role = z.infer<typeof RoleSchema>

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
  orderNo: z.number(),
  role: RoleSchema,
  importance: z.enum(['core', 'supporting']),
  label: z.string().optional(),
  optionGroups: z.array(OptionGroupSchema).optional(),
  scoring: QuestionScoringSchema.optional(),
})

export const ObjectivesSchema = z.object({
  primaryDecisionQuestions: z.array(z.string()),
  reportLensDefault: z.enum(['general', 'sales', 'marketing']),
})

export const CrosstabPlanItemSchema = z.object({
  rowRole: RoleSchema,
  colRole: RoleSchema,
  minCellN: z.number(),
  topKRows: z.number(),
  topKCols: z.number(),
  note: z.string().optional(),
})

export const LeadScoringComponentSchema = z.object({
  role: RoleSchema,
  weight: z.number(),
})

export const LeadScoringSchema = z.object({
  enabled: z.boolean(),
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

export const GuidelinePackSchema = z.object({
  version: z.literal(GP_VERSION),
  formId: z.string(),
  formFingerprint: z.string(),
  objectives: ObjectivesSchema,
  questionMap: z.array(QuestionMapItemSchema),
  crosstabPlan: z.array(CrosstabPlanItemSchema),
  leadScoring: LeadScoringSchema,
})

export type GuidelinePack = z.infer<typeof GuidelinePackSchema>
export type QuestionMapItem = z.infer<typeof QuestionMapItemSchema>
export type OptionGroup = z.infer<typeof OptionGroupSchema>
export type CrosstabPlanItem = z.infer<typeof CrosstabPlanItemSchema>
export type LeadScoring = z.infer<typeof LeadScoringSchema>
export type Objectives = z.infer<typeof ObjectivesSchema>

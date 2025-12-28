/**
 * Decision Pack Schema (dp-1.0)
 * LLM이 생성하는 의사결정 팩 스키마
 * 문항 독립적 구조
 */

import { z } from 'zod'

/**
 * Decision Card Option
 * 의사결정을 위한 선택지
 */
export const DecisionCardOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  title: z.string().min(5),
  description: z.string().min(10),
  expectedImpact: z.string().min(10),
  risks: z.string().optional(),
})

/**
 * Decision Card
 * 의사결정 지원을 위한 구조화된 카드
 */
export const DecisionCardSchema = z.object({
  question: z.string().min(10),
  options: z.array(DecisionCardOptionSchema).min(2).max(3),
  recommendation: z.enum(['A', 'B', 'C']),
  evidenceIds: z.array(z.string().regex(/^E\d+$/)).min(2), // E1, E2 등 Evidence Catalog 참조
  confidence: z.enum(['Confirmed', 'Directional', 'Hypothesis']),
  rationale: z.string().min(20),
})

/**
 * Action Item
 * 실행 가능한 액션 항목
 */
export const ActionItemSchema = z.object({
  owner: z.enum(['sales', 'marketing', 'ops']),
  title: z.string().min(5),
  targetCount: z.string().regex(/\d+(명|건)/), // "17명", "8건"
  kpi: z.string().min(5), // "미팅 전환율 40%", "PoC 신청 5건" 등
  steps: z.array(z.string().min(3)).min(1),
})

/**
 * Action Board
 * 시간대별 실행 계획
 */
export const ActionBoardSchema = z.object({
  d0: z.array(ActionItemSchema).optional(), // 24시간 내
  d7: z.array(ActionItemSchema).optional(), // 7일 내
  d14: z.array(ActionItemSchema).optional(), // 14일 내
})

/**
 * Playbook
 * 세그먼트별 세일즈/마케팅 플레이북
 */
export const PlaybookSchema = z.object({
  sales: z.array(z.string().min(5)).min(1),
  marketing: z.array(z.string().min(5)).min(1),
})

/**
 * Survey Next Questions
 * 추가 설문 개선 제안
 */
export const SurveyNextQuestionSchema = z.object({
  question: z.string().min(5),
  answerType: z.enum(['single', 'multiple', 'text']),
  why: z.string().min(10),
})

/**
 * Decision Pack (dp-1.0)
 * LLM이 생성하는 의사결정 팩
 */
export const DecisionPackSchema = z.object({
  version: z.literal('dp-1.0'),
  decisionCards: z.array(DecisionCardSchema).min(3).max(5),
  actionBoard: ActionBoardSchema,
  playbooks: PlaybookSchema,
  surveyNextQuestions: z.array(SurveyNextQuestionSchema).min(1),
})

export type DecisionPack = z.infer<typeof DecisionPackSchema>
export type DecisionCard = z.infer<typeof DecisionCardSchema>
export type ActionItem = z.infer<typeof ActionItemSchema>
export type ActionBoard = z.infer<typeof ActionBoardSchema>



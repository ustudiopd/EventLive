/**
 * Action Pack V2 JSON Schema (Zod)
 * 설문조사 AI 분석 보고서 v2의 구조화된 출력 형식
 */

import { z } from 'zod'

export const LensSchema = z.enum(['sales', 'marketing', 'general'])

export const ActionOwnerSchema = z.enum(['sales', 'marketing', 'ops'])

export const DueDateSchema = z.enum(['D+0', 'D+2', 'D+7', 'D+14'])

export const PriorityTierSchema = z.enum(['P0', 'P1', 'P2', 'P3', 'P4'])

export const DataQualityLevelSchema = z.enum(['info', 'warning'])

// Executive Summary
export const TopWinSchema = z.object({
  title: z.string().min(1),
  evidence: z.string().min(1), // regex 검증은 linter에서 처리
  soWhat: z.string().min(1),
  action: z.object({
    owner: ActionOwnerSchema,
    due: DueDateSchema,
    steps: z.array(z.string()).min(1),
  }),
})

export const ExecutiveSummarySchema = z.object({
  oneLiner: z.string().min(1),
  topWins: z.array(TopWinSchema).min(3),
})

// Priority Queue Summary
export const TierSummarySchema = z.object({
  tier: PriorityTierSchema,
  count: z.number().int().min(0),
  pct: z.number().min(0).max(100),
})

export const SLAPlanSchema = z.object({
  tier: PriorityTierSchema,
  targetResponseTime: z.string().min(1),
  recommendedChannel: z.string().min(1),
  script: z.string().min(1),
})

export const PriorityQueueSummarySchema = z.object({
  tiers: z.array(TierSummarySchema),
  slaPlan: z.array(SLAPlanSchema),
})

// Segment Playbooks
export const SegmentPlaybookSchema = z.object({
  segmentName: z.string().min(1),
  definition: z.string().min(1),
  size: z.object({
    count: z.number().int().min(0),
    pct: z.number().min(0).max(100),
  }),
  keyNeeds: z.array(z.string()),
  talkTrack: z.array(z.string()),
  nextBestOffer: z.array(z.string()),
  pitfalls: z.array(z.string()),
  evidence: z.array(z.string()),
})

// Correlation Findings
export const CorrelationFindingSchema = z.object({
  title: z.string().min(1),
  method: z.literal('crosstab_lift'),
  evidence: z.object({
    crosstabId: z.string(),
    highlight: z.string().min(1), // regex 검증은 linter에서 처리
  }),
  soWhat: z.string().min(1),
  actions: z.array(
    z.object({
      owner: z.enum(['sales', 'marketing']),
      due: DueDateSchema,
      steps: z.array(z.string()).min(1),
    })
  ),
})

// Marketing Pack
export const MarketingPackSchema = z.object({
  theme: z.string().min(1),
  targetSegment: z.string().min(1),
  suggestedAssets: z.array(z.string()),
  distribution: z.array(z.string()),
  rationale: z.string().min(1), // regex 검증은 linter에서 처리
})

// Survey Iteration Recommendations
export const SurveyIterationRecommendationSchema = z.object({
  gap: z.string().min(1),
  whyItMatters: z.string().min(1),
  suggestedQuestion: z.string().min(1),
  answerType: z.enum(['single', 'multiple', 'text']),
})

// Data Quality
export const DataQualitySchema = z.object({
  level: DataQualityLevelSchema,
  message: z.string().min(1),
})

// Campaign Info
export const CampaignInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  analyzedAtISO: z.string(),
  sampleCount: z.number().int().min(0),
  totalQuestions: z.number().int().min(0),
})

// Action Pack V2 전체 스키마
export const ActionPackV2Schema = z.object({
  version: z.literal('2.0'),
  lens: LensSchema,
  campaign: CampaignInfoSchema,
  executiveSummary: ExecutiveSummarySchema,
  priorityQueueSummary: PriorityQueueSummarySchema,
  segmentPlaybooks: z.array(SegmentPlaybookSchema),
  correlationFindings: z.array(CorrelationFindingSchema),
  marketingPack: z.array(MarketingPackSchema),
  surveyIterationRecommendations: z.array(SurveyIterationRecommendationSchema),
  dataQuality: z.array(DataQualitySchema),
})

export type ActionPackV2 = z.infer<typeof ActionPackV2Schema>
export type TopWin = z.infer<typeof TopWinSchema>
export type SegmentPlaybook = z.infer<typeof SegmentPlaybookSchema>
export type CorrelationFinding = z.infer<typeof CorrelationFindingSchema>
export type MarketingPack = z.infer<typeof MarketingPackSchema>

// ============================================================================
// Action Pack V0.9 Schema (단순화 버전 - LLM 통과율 최우선)
// ============================================================================

/**
 * Action Pack V0.9: 단순화된 스키마로 LLM이 쉽게 지킬 수 있도록 설계
 * - 중첩 구조 최소화
 * - campaign은 서버에서 주입 (LLM이 생성하지 않음)
 * - enum/숫자 타입 강제 약화 (문자열 허용 후 서버에서 정규화)
 */
export const ActionPackV09Schema = z.object({
  version: z.literal('0.9'),
  lens: z.enum(['sales', 'marketing', 'general']).default('general'),

  executiveSummary: z.object({
    oneLiner: z.string().min(10),
  }),

  insights: z.array(
    z.object({
      title: z.string().min(5),
      evidence: z.string().min(5), // "34% (17/50)" 같은 근거 문자열
      soWhat: z.string().min(10),
      nextActions: z
        .array(
          z.object({
            owner: z.enum(['sales', 'marketing', 'ops']),
            due: z.string().min(2), // "D+2", "48시간 내" 등 문자열 허용
            steps: z.array(z.string().min(3)).min(1),
          })
        )
        .min(1),
    })
  ).min(3),

  priorityQueue: z.array(
    z.object({
      tier: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
      count: z.number().int().nonnegative(),
      pct: z.number().min(0).max(100),
      sla: z.string().min(3),
      script: z.string().min(10),
    })
  ).min(3),

  segments: z
    .array(
      z.object({
        name: z.string().min(3),
        definition: z.string().min(5),
        size: z.object({
          count: z.number().int().nonnegative(),
          pct: z.number().min(0).max(100),
        }),
        playbook: z.array(z.string().min(5)).min(2),
        evidence: z.array(z.string().min(5)).min(1),
      })
    )
    .min(2)
    .optional(),

  marketingPack: z
    .array(
      z.object({
        theme: z.string().min(3),
        targetSegment: z.string().min(3),
        suggestedAssets: z.array(z.string().min(3)).min(1),
        distribution: z.array(z.string().min(3)).min(1),
        rationale: z.string().min(10),
        // 이메일 제목, CTA, 랜딩 훅은 suggestedAssets에 포함하거나 별도 필드로 추가 가능
        // 현재는 suggestedAssets에 포함하도록 프롬프트로 강제
      })
    )
    .optional(),

  surveyNextQuestions: z.array(
    z.object({
      question: z.string().min(5),
      answerType: z.enum(['single', 'multiple', 'text']),
      why: z.string().min(10),
    })
  ).min(1),

  dataQuality: z.array(z.string().min(5)).optional(),
})

export type ActionPackV09 = z.infer<typeof ActionPackV09Schema>

// ============================================================================
// Decision-grade AI Report v3 추가 스키마
// ============================================================================

/**
 * Decision Card Option
 * 의사결정을 위한 선택지
 */
export const DecisionCardOptionSchema = z.object({
  id: z.enum(['A', 'B', 'C']),
  title: z.string().min(5),
  description: z.string().min(10),
  expectedImpact: z.string().min(10),
  risks: z.string().min(5).optional(),
})/**
 * Decision Card
 * 의사결정 지원을 위한 구조화된 카드
 */
export const DecisionCardSchema = z.object({
  question: z.string().min(10),
  options: z.array(DecisionCardOptionSchema).min(2).max(3),
  recommendation: z.enum(['A', 'B', 'C']),
  evidenceIds: z.array(z.string()).min(2), // E1, E2 등 Evidence Catalog 참조
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
  targetCount: z.string().min(3), // "17명", "8건" 등
  kpi: z.string().min(5), // "미팅 전환율 40%", "PoC 신청 5건" 등
  steps: z.array(z.string().min(3)).min(1),
})/**
 * Action Board
 * 시간대별 실행 계획
 */
export const ActionBoardSchema = z.object({
  d0: z.array(ActionItemSchema), // 24시간 내
  d7: z.array(ActionItemSchema),  // 7일 내
  d14: z.array(ActionItemSchema), // 14일 내
})

/**
 * Action Pack V0.9 확장 스키마 (Decision-grade v3)
 * 기존 V0.9에 Decision Cards와 Action Board 추가
 */
export const ActionPackV09ExtendedSchema = ActionPackV09Schema.extend({
  decisionCards: z.array(DecisionCardSchema).min(3).max(5).optional(),
  actionBoard: ActionBoardSchema.optional(),
})

export type DecisionCard = z.infer<typeof DecisionCardSchema>
export type DecisionCardOption = z.infer<typeof DecisionCardOptionSchema>
export type ActionItem = z.infer<typeof ActionItemSchema>
export type ActionBoard = z.infer<typeof ActionBoardSchema>
export type ActionPackV09Extended = z.infer<typeof ActionPackV09ExtendedSchema>
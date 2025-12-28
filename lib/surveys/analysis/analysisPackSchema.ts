/**
 * Analysis Pack Schema (ap-1.0)
 * 서버에서 생성하는 기초 분석팩 스키마
 * 문항이 바뀌어도 변하지 않는 계약(Contract)
 */

import { z } from 'zod'

/**
 * Evidence Item
 * 모든 수치의 원천을 ID로 관리
 */
export const EvidenceItemSchema = z.object({
  id: z.string().regex(/^E\d+$/), // E1, E2, ...
  title: z.string().min(5),
  metric: z.enum(['분포', '교차표', '리드 스코어', '데이터 품질']),
  valueText: z.string().min(3), // "34% (17/50)"
  n: z.number().int().positive(),
  source: z.enum(['qStats', 'crosstab', 'derived', 'dataQuality']),
  notes: z.string().optional(),
})

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>

/**
 * Crosstab Highlight
 * 교차표 분석 하이라이트
 */
export const CrosstabHighlightSchema = z.object({
  id: z.string().regex(/^H\d+$/), // H1, H2, ...
  title: z.string().min(10),
  evidenceIds: z.array(z.string().regex(/^E\d+$/)).min(2),
  statement: z.string().min(20),
  confidence: z.enum(['Confirmed', 'Directional', 'Hypothesis']),
})

export type CrosstabHighlight = z.infer<typeof CrosstabHighlightSchema>

/**
 * Question Stats
 * 문항별 통계
 */
export const QuestionStatsSchema = z.object({
  questionId: z.string().uuid(),
  questionBody: z.string(),
  questionType: z.enum(['single', 'multiple', 'text']),
  responseCount: z.number().int().nonnegative(),
  topChoices: z.array(
    z.object({
      text: z.string(),
      count: z.number().int().nonnegative(),
      percentage: z.number().min(0).max(100),
    })
  ).optional(),
})

/**
 * Crosstab
 * 교차표 데이터
 */
export const CrosstabSchema = z.object({
  id: z.string(),
  rowQuestionId: z.string().uuid(),
  rowQuestionBody: z.string(),
  colQuestionId: z.string().uuid(),
  colQuestionBody: z.string(),
  rowTotals: z.record(z.string(), z.number().int().nonnegative()),
  colTotals: z.record(z.string(), z.number().int().nonnegative()),
  cells: z.array(
    z.object({
      rowKey: z.string(),
      colKey: z.string(),
      count: z.number().int().nonnegative(),
      rowPct: z.number().min(0).max(100),
      colPct: z.number().min(0).max(100),
      lift: z.number(),
    })
  ),
  minCellCount: z.number().int().nonnegative(),
})

/**
 * Data Quality Message
 * 데이터 품질 메시지
 */
export const DataQualityMessageSchema = z.object({
  level: z.enum(['info', 'warning']),
  message: z.string().min(5),
})

/**
 * Lead Queue (Optional)
 * 리드 우선순위 큐 (태그가 있을 때만 생성)
 */
export const LeadQueueSchema = z.object({
  distribution: z.array(
    z.object({
      tier: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
      count: z.number().int().nonnegative(),
      pct: z.number().min(0).max(100),
    })
  ),
}).optional()

/**
 * Analysis Pack (ap-1.0)
 * 기초 분석팩 - 서버에서 생성하는 표준 형식
 */
export const AnalysisPackSchema = z.object({
  version: z.literal('ap-1.0'),
  campaign: z.object({
    id: z.string().uuid(),
    title: z.string(),
    analyzedAtISO: z.string().datetime(),
    sampleCount: z.number().int().positive(),
    totalQuestions: z.number().int().positive(),
  }),
  questions: z.array(QuestionStatsSchema),
  evidenceCatalog: z.array(EvidenceItemSchema).min(3),
  crosstabs: z.array(CrosstabSchema),
  highlights: z.array(CrosstabHighlightSchema).max(5),
  dataQuality: z.array(DataQualityMessageSchema),
  leadQueue: LeadQueueSchema,
})

export type AnalysisPack = z.infer<typeof AnalysisPackSchema>


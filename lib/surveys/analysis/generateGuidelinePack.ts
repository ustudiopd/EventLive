/**
 * Guideline Pack 생성 함수
 * LLM을 사용하여 Survey Blueprint로부터 Guideline Pack 생성
 */

import { z } from 'zod'
import type { SurveyBlueprint } from './buildSurveyBlueprint'
import {
  GuidelinePackSchema,
  GP_VERSION,
  type GuidelinePack,
} from './guidelinePackSchema'
import { inferQuestionRoles } from './roleInference'
import type { QuestionWithRole } from './roleInference'

/**
 * Guideline Pack 생성 (재시도 포함)
 */
export async function generateGuidelinePackWithRetry(
  blueprint: SurveyBlueprint,
  formFingerprint: string,
  maxRetries = 3
): Promise<GuidelinePack> {
  let lastError: Error | null = null
  let retryIssues: z.ZodIssue[] | undefined = undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const guidelinePack = await generateGuidelinePack(
        blueprint,
        formFingerprint,
        retryIssues
      )
      return guidelinePack
    } catch (error: any) {
      lastError = error

      if (error.issues && Array.isArray(error.issues) && error.issues.length > 0) {
        retryIssues = error.issues as z.ZodIssue[]
        console.log(
          `[Guideline Pack] 스키마 검증 실패. 다음 재시도에서 ${retryIssues.length}개 오류 수정 요청`
        )
      } else {
        retryIssues = undefined
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        console.log(`[Guideline Pack] 재시도 ${attempt + 1}/${maxRetries}...`)
      }
    }
  }

  throw lastError || new Error('Guideline Pack 생성 실패: 최대 재시도 횟수 초과')
}

/**
 * Guideline Pack 생성
 */
async function generateGuidelinePack(
  blueprint: SurveyBlueprint,
  formFingerprint: string,
  retryIssues?: z.ZodIssue[]
): Promise<GuidelinePack> {
  const retryPrompt = retryIssues
    ? `\n\n**이전 시도에서 발견된 오류 (반드시 수정하세요):**\n${retryIssues
        .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`
    : ''

  // 1차 역할 추정 (규칙 기반)
  const questionsWithRoles = inferQuestionRoles(
    blueprint.questions.map((q) => ({
      id: q.id,
      body: q.body,
      type: q.type,
      options: q.options,
    }))
  )

  const systemPrompt = `당신은 설문 설계 및 세일즈 운영 분석 전문가입니다. 설문조사 폼 구조를 분석하여 AI 분석을 위한 구조화된 지침(Guideline Pack)을 생성합니다.

**핵심 원칙:**
1. **역할 분류**: 각 문항을 표준 Role Taxonomy로 분류 (timeline, intent_followup, usecase_project_type, budget_status, authority 등)
2. **옵션 매핑**: 모든 선택지를 optionMap (byOptionId/byOptionText)로 매핑하고, groups에 스코어 정의
3. **다중선택 전략**: multiple 문항에는 multiSelectStrategy 명시 (max/sumCap/binaryAny)
4. **교차표 계획**: pinned 교차표 + autoPick 설정 포함
5. **리드 스코어링**: 최소 3개 이상의 역할 기반 컴포넌트 포함 (권장: timeline, intent_followup, authority, budget_status)
6. **디시전 질문**: 비즈니스 의사결정에 도움이 되는 질문 후보 제시

**표준 Role Taxonomy (필수 준수):**
- \`timeline\`: 프로젝트/구매 시기 관련 (예: "언제", "계획", "시기")
- \`intent_followup\`: 접촉/연락 의향 (예: "의향", "요청", "연락", "미팅") - 레거시: engagement_intent
- \`usecase_project_type\`: 프로젝트 분야/영역 (예: "프로젝트", "분야", "영역") - 레거시: need_area
- \`budget_status\`: 예산 확보 여부 (예: "예산", "확보")
- \`authority\`: 의사결정 권한 (예: "권한", "담당자", "의사결정") - 레거시: authority_level
- \`channel_preference\`: 선호 채널
- \`need_pain\`: 니즈/페인 포인트
- \`barrier_risk\`: 장벽/리스크
- \`company_profile\`: 회사 프로필
- \`free_text_voice\`: 자유 텍스트 의견
- \`other\`: 위에 해당하지 않는 문항

**옵션 매핑 구조 (필수):**
- optionMap: byOptionId (옵션 ID 기준) 또는 byOptionText (옵션 텍스트 기준)로 매핑
- groups: 각 groupKey에 대해 title, description, score (0~100) 정의
- 예시: 
  \`\`\`json
  "optionMap": {
    "byOptionText": {
      "1주일 이내": { "groupKey": "immediate" },
      "1개월 - 3개월": { "groupKey": "short" }
    }
  },
  "groups": {
    "immediate": { "title": "즉시", "score": 100 },
    "short": { "title": "단기", "score": 80 }
  }
  \`\`\`

**다중선택 전략 (multiple 문항 필수):**
- \`max\`: 선택된 옵션 중 최고 스코어 사용
- \`sumCap\`: 선택된 옵션 스코어 합계 (최대 100)
- \`binaryAny\`: 하나라도 선택되면 1, 아니면 0

**교차표 계획 필수 요구사항:**
- crosstabs.pinned: 고정 교차표 목록 (최소 2개 이상 권장)
  - 각 pinned는 rowRole, colRole, minCellCount 포함
- crosstabs.autoPick: 자동 선택 설정
  - enabled: true/false
  - topK: 상위 K개 (권장: 5)
  - minCellCount: 최소 셀 수 (권장: 5)

**리드 스코어링 필수 요구사항:**
- enabled: true
- components: 최소 3개 이상 (권장: timeline, engagement, authority, budget)
- 각 component는 role과 weight 포함
- tierThresholds: P0, P1, P2, P3 임계값 설정
- recommendedActionsByTier: 각 티어별 추천 액션

**디시전 질문 예시:**
- "지금 바로 컨택해야 하는 리드는 몇 명인가?"
- "영업 리소스가 제한될 때, 어느 채널에 몇 슬롯을 배정해야 하나?"
- "마케팅은 어떤 메시지/오퍼로 어떤 세그먼트를 먼저 치면 되나?"

${retryPrompt}

위 원칙을 엄격히 따라 Guideline Pack JSON을 생성하세요. 모든 필수 필드를 반드시 포함해야 합니다.`

  const userPrompt = buildUserPrompt(blueprint, questionsWithRoles, formFingerprint)

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다.')
  }

  try {
    // Gemini API 호출 (JSON mode 사용)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt + '\n\n' + userPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Gemini API 오류: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''

    console.log('[generateGuidelinePack] LLM 응답 길이:', responseText.length)
    console.log('[generateGuidelinePack] LLM 응답 일부:', responseText.substring(0, 500))

    // JSON 추출 유틸리티
    function extractJsonText(text: string): string {
      const t = (text || '').trim()

      // 1) fenced code block (```json ... ```)
      const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
      if (fenced?.[1]) return fenced[1].trim()

      // 2) already looks like JSON
      if (
        (t.startsWith('{') && t.endsWith('}')) ||
        (t.startsWith('[') && t.endsWith(']'))
      ) {
        return t
      }

      // 3) try best-effort slice between first { and last }
      const firstObj = t.indexOf('{')
      const lastObj = t.lastIndexOf('}')
      if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
        return t.slice(firstObj, lastObj + 1).trim()
      }

      return t // fallback
    }

    const jsonText = extractJsonText(responseText)
    const parsed = JSON.parse(jsonText)

    // version 필드 자동 보정
    if (!parsed.version || parsed.version !== GP_VERSION) {
      parsed.version = GP_VERSION
    }

    // formId, formFingerprint 자동 설정
    parsed.formId = blueprint.formId
    parsed.formFingerprint = formFingerprint

    // Zod 검증
    const validated = GuidelinePackSchema.parse(parsed)

    return validated
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('[generateGuidelinePack] Zod 검증 실패:', error.issues)
      throw error
    }
    console.error('[generateGuidelinePack] 생성 실패:', error)
    throw new Error(`Guideline Pack 생성 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * User Prompt 생성
 */
function buildUserPrompt(
  blueprint: SurveyBlueprint,
  questionsWithRoles: QuestionWithRole[],
  formFingerprint: string
): string {
  const questionsText = blueprint.questions
    .map((q, idx) => {
      const roleInfo = questionsWithRoles.find((qr) => qr.id === q.id)
      const role = roleInfo?.role || 'other'
      const roleSource = roleInfo?.roleSource || 'unknown'

      let optionsText = ''
      if (q.options && q.options.length > 0) {
        optionsText = `\n  선택지:\n${q.options.map((opt) => `    - ${opt.id}: ${opt.text}`).join('\n')}`
      }

      return `문항 ${idx + 1}:
  ID: ${q.id}
  순서: ${q.orderNo}
  본문: ${q.body}
  유형: ${q.type}
  추정 역할: ${role} (${roleSource})${optionsText}`
    })
    .join('\n\n')

  return `다음 설문조사 폼 구조를 분석하여 Guideline Pack을 생성하세요:

**폼 정보:**
- Form ID: ${blueprint.formId}
- Form Fingerprint: ${formFingerprint}
- 총 문항 수: ${blueprint.questions.length}

**문항 목록:**
${questionsText}

**요구사항:**
1. 각 문항에 적절한 역할(role) 할당 (1차 추정 결과를 참고하되, 필요시 수정)
2. timeline 문항의 경우 옵션 그룹핑 생성 (단기/중기/장기)
3. 교차표 계획 최소 2개 이상 생성
4. 리드 스코어링 컴포넌트 최소 3개 이상 포함
5. 디시전 질문 후보 최소 3개 이상 제시

**출력 형식:**
다음 JSON 형식을 정확히 따라주세요:

\`\`\`json
{
  "version": "${GP_VERSION}",
  "formId": "${blueprint.formId}",
  "formFingerprint": "${formFingerprint}",
  "objectives": {
    "primaryDecisionQuestions": ["질문1", "질문2", "질문3"],
    "reportLensDefault": "general"
  },
  "questionMap": [
    {
      "questionId": "문항ID",
      "orderNo": 1,
      "role": "timeline",
      "importance": "core",
      "label": "선택적 라벨",
      "optionGroups": [
        {
          "groupKey": "short_term",
          "groupLabel": "단기(≤3개월)",
          "choiceIds": ["선택지ID1", "선택지ID2"]
        }
      ],
      "scoring": {
        "enabled": true,
        "weightsByGroupKey": {
          "short_term": 30,
          "medium_term": 20,
          "long_term": 10
        }
      }
    }
  ],
  "crosstabPlan": [
    {
      "rowRole": "timeline",
      "colRole": "engagement_intent",
      "minCellN": 5,
      "topKRows": 5,
      "topKCols": 5,
      "note": "타임라인과 접촉 의향의 상관관계 분석"
    }
  ],
  "leadScoring": {
    "enabled": true,
    "tierThresholds": {
      "P0": 80,
      "P1": 60,
      "P2": 40,
      "P3": 20
    },
    "components": [
      {
        "role": "timeline",
        "weight": 1.0
      },
      {
        "role": "engagement_intent",
        "weight": 1.0
      },
      {
        "role": "authority_level",
        "weight": 1.0
      }
    ],
    "recommendedActionsByTier": {
      "P0": "즉시 컨택 (48시간 이내)",
      "P1": "우선 컨택 (1주일 이내)",
      "P2": "일반 컨택 (2주일 이내)",
      "P3": "낮은 우선순위 (1개월 이내)",
      "P4": "자동 nurture 또는 제외"
    }
  }
}
\`\`\`

반드시 유효한 JSON만 출력하고, 코드 블록 마크다운은 사용하지 마세요.`
}

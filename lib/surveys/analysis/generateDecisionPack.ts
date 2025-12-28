/**
 * Decision Pack 생성 함수
 * LLM을 사용하여 Analysis Pack을 Decision Pack으로 변환
 */

import { z } from 'zod'
import type { AnalysisPack } from './analysisPackSchema'
import { DecisionPackSchema, type DecisionPack } from './decisionPackSchema'
import { lintDecisionPack, buildQualityPrompt, type LinterWarning } from './lintDecisionPack'

/**
 * Decision Pack 생성 (재시도 포함 + Linter 통합)
 */
export async function generateDecisionPackWithRetry(
  analysisPack: AnalysisPack,
  maxRetries = 2
): Promise<{ decisionPack: DecisionPack; warnings: LinterWarning[] }> {
  let lastError: Error | null = null
  let retryIssues: z.ZodIssue[] | undefined = undefined
  let linterWarnings: LinterWarning[] | undefined = undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const decisionPack = await generateDecisionPack(analysisPack, retryIssues, linterWarnings)

      // Linter 품질 검증
      const linterResult = lintDecisionPack(decisionPack, analysisPack)

      if (!linterResult.isValid && attempt < maxRetries) {
        // 에러 레벨 경고가 있으면 재시도
        const hasErrors = linterResult.warnings.some((w) => w.level === 'error')
        if (hasErrors) {
          linterWarnings = linterResult.warnings
          const qualityPrompt = buildQualityPrompt(linterResult.warnings)
          console.log(
            `[Decision Pack] 품질 검증 실패. 다음 재시도에서 ${linterResult.warnings.length}개 오류 수정 요청`
          )
          const delay = Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
          console.log(`[Decision Pack] 재시도 ${attempt + 1}/${maxRetries} (품질 검증 실패)...`)
          continue
        }
      }

      return {
        decisionPack,
        warnings: linterResult.warnings,
      }
    } catch (error: any) {
      lastError = error

      if (error.issues && Array.isArray(error.issues) && error.issues.length > 0) {
        retryIssues = error.issues as z.ZodIssue[]
        console.log(
          `[Decision Pack] 스키마 검증 실패. 다음 재시도에서 ${retryIssues.length}개 오류 수정 요청`
        )
      } else {
        retryIssues = undefined
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        console.log(`[Decision Pack] 재시도 ${attempt + 1}/${maxRetries}...`)
      }
    }
  }

  throw lastError || new Error('Decision Pack 생성 실패: 최대 재시도 횟수 초과')
}

/**
 * Decision Pack 생성
 */
async function generateDecisionPack(
  analysisPack: AnalysisPack,
  retryIssues?: z.ZodIssue[],
  linterWarnings?: LinterWarning[]
): Promise<DecisionPack> {
  const retryPrompt = retryIssues
    ? `\n\n**이전 시도에서 발견된 오류 (반드시 수정하세요):**\n${retryIssues
        .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`
    : ''

  const qualityPrompt = linterWarnings ? buildQualityPrompt(linterWarnings) : ''

  const systemPrompt = `당신은 B2B 세일즈/마케팅 의사결정 지원 전문가입니다. 설문조사 분석 데이터를 바탕으로 실행 가능한 의사결정 카드와 액션 플랜을 제공합니다.

**핵심 원칙:**
1. **Evidence 기반**: 모든 결론은 반드시 Evidence Catalog의 ID를 참조해야 합니다 (예: "E1", "E2")
2. **구체적 액션**: 각 액션은 담당자, 대상 수량, 목표 KPI를 포함해야 합니다
3. **명확한 추천**: Decision Cards는 A/B/C 옵션을 비교하고 명확한 추천을 제시해야 합니다
4. **실행 가능성**: Action Board는 24시간/7일/14일 단위로 구체적인 실행 계획을 포함해야 합니다

**출력 형식:**
- Decision Cards: 최소 3개, 최대 5개
- Action Board: d0 (24시간), d7 (7일), d14 (14일) 각각 최소 1개 이상
- Playbooks: 세일즈/마케팅 각각 최소 3개 이상
- Survey Next Questions: 최소 2개 이상

**중요 규칙:**
- 숫자/카운트는 반드시 Evidence Catalog에서만 인용 (예: "E1에 따르면 34% (17/50)")
- 없는 숫자는 "Unknown" 처리
- 모든 액션은 owner, targetCount, kpi를 포함해야 함
- Decision Cards의 evidenceIds는 최소 2개 이상 포함

${retryPrompt}
${qualityPrompt}

위 원칙을 따라 Decision Pack JSON을 생성하세요.`

  const userPrompt = buildUserPrompt(analysisPack)

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다.')
  }

  try {
    // Gemini API 호출 (JSON mode 사용)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 8192,
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

    console.log('[generateDecisionPack] LLM 응답 길이:', responseText.length)
    console.log('[generateDecisionPack] LLM 응답 일부:', responseText.substring(0, 500))

    // JSON 추출 유틸리티 (코드블록 + raw JSON 모두 처리)
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

      // 4) or slice between first [ and last ]
      const firstArr = t.indexOf('[')
      const lastArr = t.lastIndexOf(']')
      if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
        return t.slice(firstArr, lastArr + 1).trim()
      }

      return t // fallback
    }

    const jsonText = extractJsonText(responseText)
    
    if (!jsonText || jsonText.length === 0) {
      console.error('[generateDecisionPack] JSON을 추출할 수 없음. 응답:', responseText.substring(0, 1000))
      throw new Error('JSON을 추출할 수 없습니다. LLM 응답을 확인하세요.')
    }

    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseError: any) {
      console.error('[generateDecisionPack] JSON 파싱 실패:', parseError.message)
      console.error('[generateDecisionPack] 파싱 시도한 JSON:', jsonText.substring(0, 1000))
      throw new Error(`JSON 파싱 실패: ${parseError.message}`)
    }

    // Zod 검증
    console.log('[generateDecisionPack] 파싱된 데이터 구조:', {
      hasDecisionCards: !!parsed.decisionCards,
      decisionCardsCount: parsed.decisionCards?.length || 0,
      hasActionBoard: !!parsed.actionBoard,
      hasPlaybooks: !!parsed.playbooks,
      hasSurveyNextQuestions: !!parsed.surveyNextQuestions,
    })

    const validated = DecisionPackSchema.safeParse(parsed)

    if (!validated.success) {
      console.error('[generateDecisionPack] 스키마 검증 실패:', {
        issuesCount: validated.error.issues.length,
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
        parsedData: {
          hasDecisionCards: !!parsed.decisionCards,
          decisionCardsCount: parsed.decisionCards?.length || 0,
          hasActionBoard: !!parsed.actionBoard,
          hasPlaybooks: !!parsed.playbooks,
          hasSurveyNextQuestions: !!parsed.surveyNextQuestions,
        },
      })
      const errorMessages = validated.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ')
      const error = new Error(`스키마 검증 실패: ${errorMessages}`) as any
      error.issues = validated.error.issues
      throw error
    }

    console.log('[generateDecisionPack] 스키마 검증 성공')
    return validated.data
  } catch (error: any) {
    if (error.issues) {
      throw error
    }
    console.error('[Decision Pack] 생성 오류:', error)
    throw new Error(`Decision Pack 생성 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * User Prompt 생성
 */
function buildUserPrompt(analysisPack: AnalysisPack): string {
  return `다음 Analysis Pack을 바탕으로 Decision Pack을 생성하세요.

## 캠페인 정보
- 제목: ${analysisPack.campaign.title}
- 응답 수: ${analysisPack.campaign.sampleCount}명
- 문항 수: ${analysisPack.campaign.totalQuestions}개
- 분석 시점: ${new Date(analysisPack.campaign.analyzedAtISO).toLocaleString('ko-KR')}

## 📊 Evidence Catalog (반드시 참조하세요)
${analysisPack.evidenceCatalog
  .map((e) => `- **${e.id}**: ${e.title} - ${e.valueText} (N=${e.n}, Source: ${e.source})`)
  .join('\n')}

## 🔥 교차표 하이라이트
${analysisPack.highlights
  .map((h) => `- **${h.id}**: ${h.title}\n  - 발견: ${h.statement}\n  - 근거: ${h.evidenceIds.join(', ')}\n  - 신뢰도: ${h.confidence}`)
  .join('\n\n')}

## 📈 문항별 통계
${analysisPack.questions
  .map((q, index) => {
    let content = `### Q${index + 1}: ${q.questionBody}\n- 유형: ${q.questionType}\n- 응답 수: ${q.responseCount}명`
    if (q.topChoices && q.topChoices.length > 0) {
      content += `\n- 상위 선택지:\n${q.topChoices
        .map((c) => `  - ${c.text}: ${c.percentage}% (${c.count}명)`)
        .join('\n')}`
    }
    return content
  })
  .join('\n\n')}

## ⚠️ 데이터 품질
${analysisPack.dataQuality
  .map((dq) => `${dq.level === 'warning' ? '⚠️' : 'ℹ️'} ${dq.message}`)
  .join('\n')}

${analysisPack.leadQueue
  ? `## 🎯 리드 우선순위 분포
${analysisPack.leadQueue.distribution
  .map((dist) => `- ${dist.tier}: ${dist.count}명 (${dist.pct}%)`)
  .join('\n')}`
  : ''}

---

## 생성 요구사항

### 1. Decision Cards (최소 3개, 최대 5개)
다음과 같은 핵심 의사결정 질문에 대한 카드를 생성하세요:
- "지금 바로 컨택해야 하는 리드가 몇 명인가?"
- "영업 리소스가 제한될 때, 어느 채널에 몇 슬롯을 배정해야 하나?"
- "마케팅은 어떤 메시지/오퍼로 어떤 세그먼트를 먼저 치면 되나?"
- "다음 설문에서 어떤 질문을 추가해야 하나?"

각 카드는:
- question: 명확한 의사결정 질문
- options: A/B/C 옵션 (각각 title, description, expectedImpact 포함)
- recommendation: A/B/C 중 하나
- evidenceIds: Evidence Catalog ID 참조 (최소 2개)
- confidence: Confirmed/Directional/Hypothesis
- rationale: 추천 이유 (최소 20자)

### 2. Action Board
시간대별 실행 계획을 생성하세요:
- **d0** (24시간 내): 즉시 실행 항목, P0 리드 우선
- **d7** (7일 내): 단기 실행 항목, P1 리드 포함
- **d14** (14일 내): 중기 실행 항목, P2 리드 포함

각 Action Item은:
- owner: sales/marketing/ops
- title: 액션 제목
- targetCount: 대상 수량 (예: "17명", "8건")
- kpi: 목표 KPI (예: "미팅 전환율 40%")
- steps: 실행 단계 (최소 1개)

### 3. Playbooks
세일즈/마케팅 플레이북을 생성하세요:
- sales: 세일즈팀이 사용할 구체적인 접근 방법 (최소 3개)
- marketing: 마케팅팀이 사용할 구체적인 캠페인/메시지 (최소 3개)

### 4. Survey Next Questions
다음 설문에서 추가할 질문을 제안하세요 (최소 2개):
- question: 구체적인 질문 문항
- answerType: single/multiple/text
- why: 이 질문이 필요한 이유

---

위 요구사항을 모두 충족하는 Decision Pack JSON을 생성하세요. 반드시 유효한 JSON만 출력하고, 코드 블록이나 마크다운 형식은 사용하지 마세요.`
}


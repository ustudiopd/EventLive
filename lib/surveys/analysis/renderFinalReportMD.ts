/**
 * 최종 보고서를 Markdown으로 렌더링
 * Analysis Pack + Decision Pack을 병합하여 최종 보고서 생성
 */

import type { MergedReport } from './mergeAnalysisAndDecisionPack'
import { TRUST_STATEMENT, SURVEY_ANALYSIS_REFERENCES } from '@/lib/references/survey-analysis-references'

/**
 * 최종 보고서를 Markdown으로 렌더링
 */
export function renderFinalReportMD(mergedReport: MergedReport): string {
  const { analysisPack, decisionPack } = mergedReport
  const analyzedAt = new Date(analysisPack.campaign.analyzedAtISO).toLocaleString('ko-KR')

  // Decision Cards 렌더링
  let decisionCardsSection = 'Decision Cards가 생성되지 않았습니다.'
  if (decisionPack.decisionCards && decisionPack.decisionCards.length > 0) {
    decisionCardsSection = decisionPack.decisionCards
      .map((card, index) => {
        const confidenceBadge =
          card.confidence === 'Confirmed'
            ? '✅ 확정'
            : card.confidence === 'Directional'
              ? '⚠️ 방향성'
              : '❓ 가설'
        const optionsSection = card.options
          .map((opt) => {
            const isRecommended = opt.id === card.recommendation
            const riskLine = opt.risks ? `- 리스크: ${opt.risks}` : ''
            const recommendedText = isRecommended ? '**👉 추천**' : ''
            const riskSection = riskLine ? `\n${riskLine}` : ''
            return `${recommendedText} **옵션 ${opt.id}**: ${opt.title}
- 설명: ${opt.description}
- 기대 효과: ${opt.expectedImpact}${riskSection}`
          })
          .join('\n\n')
        return `### ${index + 1}. ${card.question}

**추천**: 옵션 ${card.recommendation}  
**신뢰도**: ${confidenceBadge}

#### 선택지 비교

${optionsSection}

**추천 이유**: ${card.rationale}  
**근거 참조**: ${card.evidenceIds.join(', ')}

---`
      })
      .join('\n\n')
  }

  // Evidence Catalog 추가 메시지
  const evidenceCatalogNote =
    analysisPack.evidenceCatalog.length > 10
      ? `\n*총 ${analysisPack.evidenceCatalog.length}개의 Evidence 항목 (상위 10개만 표시)*`
      : ''

  // Action Board 섹션들
  const actionBoardD0 =
    decisionPack.actionBoard.d0 && decisionPack.actionBoard.d0.length > 0
      ? decisionPack.actionBoard.d0
          .map((action) => {
            const ownerText =
              action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
            return `- **${ownerText}**: ${action.title}
  - 대상: ${action.targetCount}
  - 목표 KPI: ${action.kpi}
  - 실행 단계:
${action.steps.map((step) => `    - ${step}`).join('\n')}`
          })
          .join('\n\n')
      : '24시간 내 실행 항목이 없습니다.'

  const actionBoardD7 =
    decisionPack.actionBoard.d7 && decisionPack.actionBoard.d7.length > 0
      ? decisionPack.actionBoard.d7
          .map((action) => {
            const ownerText =
              action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
            return `- **${ownerText}**: ${action.title}
  - 대상: ${action.targetCount}
  - 목표 KPI: ${action.kpi}
  - 실행 단계:
${action.steps.map((step) => `    - ${step}`).join('\n')}`
          })
          .join('\n\n')
      : '7일 내 실행 항목이 없습니다.'

  const actionBoardD14 =
    decisionPack.actionBoard.d14 && decisionPack.actionBoard.d14.length > 0
      ? decisionPack.actionBoard.d14
          .map((action) => {
            const ownerText =
              action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
            return `- **${ownerText}**: ${action.title}
  - 대상: ${action.targetCount}
  - 목표 KPI: ${action.kpi}
  - 실행 단계:
${action.steps.map((step) => `    - ${step}`).join('\n')}`
          })
          .join('\n\n')
      : '14일 내 실행 항목이 없습니다.'

  // Playbooks 섹션들
  const salesPlaybook =
    decisionPack.playbooks?.sales && decisionPack.playbooks.sales.length > 0
      ? decisionPack.playbooks.sales.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : '세일즈 플레이북이 생성되지 않았습니다.'

  const marketingPlaybook =
    decisionPack.playbooks?.marketing && decisionPack.playbooks.marketing.length > 0
      ? decisionPack.playbooks.marketing.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : '마케팅 플레이북이 생성되지 않았습니다.'

  // Survey Next Questions
  const surveyNextQuestionsSection =
    decisionPack.surveyNextQuestions && decisionPack.surveyNextQuestions.length > 0
      ? decisionPack.surveyNextQuestions
          .map((q, index) => {
            const answerTypeText =
              q.answerType === 'single' ? '단일 선택' : q.answerType === 'multiple' ? '복수 선택' : '텍스트'
            return `${index + 1}. **${q.question}**
   - 유형: ${answerTypeText}
   - 이유: ${q.why}`
          })
          .join('\n\n')
      : '설문 개선 제안이 생성되지 않았습니다.'

  // Crosstabs 섹션
  const crosstabsSection =
    analysisPack.crosstabs.length > 0
      ? analysisPack.crosstabs
          .map((ct) => {
            const cellWarning = ct.minCellCount < 5 ? '⚠️ 일부 셀의 표본 수가 5 미만입니다.' : ''
            const tableRows = Object.entries(ct.rowTotals)
              .map(([rowKey, rowTotal]) => {
                const cells = ct.cells.filter((c) => c.rowKey === rowKey)
                const cellValues = Object.keys(ct.colTotals).map((colKey) => {
                  const cell = cells.find((c) => c.colKey === colKey)
                  return cell ? `${cell.count} (${cell.rowPct.toFixed(1)}%)` : '0'
                })
                return `| ${rowKey} | ${cellValues.join(' | ')} | ${rowTotal} |`
              })
              .join('\n')
            return `### ${ct.rowQuestionBody} × ${ct.colQuestionBody}

| ${ct.colQuestionBody} | ${Object.keys(ct.colTotals).join(' | ')} | 합계 |
|${' --- |'.repeat(Object.keys(ct.colTotals).length + 2)}|
${tableRows}
| 합계 | ${Object.values(ct.colTotals).join(' | ')} | ${analysisPack.campaign.sampleCount} |

**최소 셀 크기**: ${ct.minCellCount}명
${cellWarning}`
          })
          .join('\n\n')
      : '교차표 데이터가 없습니다.'

  // References 섹션
  const referencesSection = SURVEY_ANALYSIS_REFERENCES.map((ref) => `- **${ref.title}**: ${ref.summary}`).join('\n')

  // Questions 섹션
  const questionsSection = analysisPack.questions
    .slice(0, 6)
    .map((q, index) => {
      if (q.questionType === 'text' || !q.topChoices || q.topChoices.length === 0) {
        return `### Q${index + 1}: ${q.questionBody}
- 유형: 텍스트 응답
- 응답 수: ${q.responseCount}명`
      }
      const top3 = q.topChoices.slice(0, 3)
      const top3Text = top3.map((c) => `- ${c.text}: ${c.percentage}% (${c.count}명)`).join('\n')
      return `### Q${index + 1}: ${q.questionBody}
${top3Text}`
    })
    .join('\n\n')

  // Evidence Catalog 섹션
  const evidenceCatalogSection = analysisPack.evidenceCatalog
    .slice(0, 10)
    .map((e) => {
      const sourceText =
        e.source === 'qStats'
          ? '문항 통계'
          : e.source === 'crosstab'
            ? '교차표'
            : e.source === 'derived'
              ? '파생 지표'
              : '데이터 품질'
      return `- **${e.id}**: ${e.title} - ${e.valueText} (N=${e.n}, Source: ${sourceText})`
    })
    .join('\n')

  // Data Quality 섹션
  const dataQualitySection = analysisPack.dataQuality
    .map((dq) => `${dq.level === 'warning' ? '⚠️' : 'ℹ️'} ${dq.message}`)
    .join('\n')

  let md = `${TRUST_STATEMENT}

# 설문조사 AI 분석 보고서

## 🎯 분석 대상
- **캠페인**: ${analysisPack.campaign.title}
- **분석 시점**: ${analyzedAt}
- **총 응답 수**: ${analysisPack.campaign.sampleCount}명
- **분석 문항 수**: ${analysisPack.campaign.totalQuestions}개

## 📚 관련 레퍼런스 요약
${referencesSection}

---

## 📊 도넛 차트 요약 (상위 문항)

${questionsSection}

---

## 🔍 Evidence Catalog

${evidenceCatalogSection}

${evidenceCatalogNote}

---

## 🎯 Decision Cards (의사결정 지원)

${decisionCardsSection}

---

## 📋 Action Board (실행 계획)

### 24시간 내 실행 (D+0)

${actionBoardD0}

### 7일 내 실행 (D+7)

${actionBoardD7}

### 14일 내 실행 (D+14)

${actionBoardD14}

---

## 📖 Playbooks

### 세일즈 플레이북

${salesPlaybook}

### 마케팅 플레이북

${marketingPlaybook}

---

## 🔮 다음 설문 개선 제안

${surveyNextQuestionsSection}

---

## ⚠️ 데이터 품질 & 제한사항

${dataQualitySection}

---

## 부록: 교차표 상세

${crosstabsSection}

---

*보고서 생성 시점: ${analyzedAt}*
`

  return md
}


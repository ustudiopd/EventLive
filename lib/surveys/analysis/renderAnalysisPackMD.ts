/**
 * Analysis Pack을 Markdown으로 렌더링
 * 기초 분석팩을 MD 형식으로 변환 (다운로드 가능)
 */

import type { AnalysisPack } from './analysisPackSchema'
import { TRUST_STATEMENT, SURVEY_ANALYSIS_REFERENCES } from '@/lib/references/survey-analysis-references'

/**
 * Analysis Pack을 Markdown으로 렌더링
 */
export function renderAnalysisPackMD(analysisPack: AnalysisPack): string {
  const analyzedAt = new Date(analysisPack.campaign.analyzedAtISO).toLocaleString('ko-KR')

  let md = `${TRUST_STATEMENT}

# Survey Analysis Pack (Base)

## 📊 분석 대상 요약
- **캠페인**: ${analysisPack.campaign.title}
- **분석 시점**: ${analyzedAt}
- **총 응답 수**: ${analysisPack.campaign.sampleCount}명
- **분석 문항 수**: ${analysisPack.campaign.totalQuestions}개

## 📚 관련 레퍼런스 요약
${SURVEY_ANALYSIS_REFERENCES.map((ref) => `- **${ref.title}**: ${ref.summary}`).join('\n')}

---

## 📈 문항별 통계

${analysisPack.questions
  .map((q, index) => {
    let content = `### Q${index + 1}: ${q.questionBody}
- **유형**: ${q.questionType === 'single' ? '단일 선택' : q.questionType === 'multiple' ? '복수 선택' : '텍스트'}
- **응답 수**: ${q.responseCount}명`

    if (q.topChoices && q.topChoices.length > 0) {
      content += `\n- **상위 선택지**:\n${q.topChoices
        .map((c) => `  - ${c.text}: ${c.percentage}% (${c.count}명)`)
        .join('\n')}`
    }

    return content
  })
  .join('\n\n')}

---

## 🔍 Evidence Catalog

모든 수치의 원천을 Evidence ID로 관리합니다. LLM은 이 ID를 참조하여 의사결정을 내립니다.

${analysisPack.evidenceCatalog
  .map((e) => {
    const sourceText =
      e.source === 'qStats'
        ? '문항 통계'
        : e.source === 'crosstab'
          ? '교차표'
          : e.source === 'derived'
            ? '파생 지표'
            : '데이터 품질'
    return `- **${e.id}**: ${e.title}
  - 값: ${e.valueText}
  - 샘플 수: ${e.n}명
  - 메트릭: ${e.metric}
  - 출처: ${sourceText}
  ${e.notes ? `- 참고: ${e.notes}` : ''}`
  })
  .join('\n\n')}

---

## 🔥 교차표 하이라이트

${analysisPack.highlights.length > 0
  ? analysisPack.highlights
      .map((h) => {
        const confidenceText =
          h.confidence === 'Confirmed'
            ? '✅ 확정'
            : h.confidence === 'Directional'
              ? '⚠️ 방향성'
              : '❓ 가설'
        return `### ${h.id}: ${h.title}
- **발견**: ${h.statement}
- **근거**: ${h.evidenceIds.join(', ')}
- **신뢰도**: ${confidenceText}`
      })
      .join('\n\n')
  : '교차표 하이라이트가 없습니다.'}

---

## ⚠️ 데이터 품질

${analysisPack.dataQuality
  .map((dq) => `${dq.level === 'warning' ? '⚠️' : 'ℹ️'} ${dq.message}`)
  .join('\n')}

${analysisPack.leadQueue
  ? `---

## 🎯 리드 우선순위 분포

${analysisPack.leadQueue.distribution
  .map((dist) => `- **${dist.tier}**: ${dist.count}명 (${dist.pct}%)`)
  .join('\n')}`
  : ''}

---

## BEGIN_ANALYSIS_PACK_JSON

\`\`\`json
${JSON.stringify(analysisPack, null, 2)}
\`\`\`

## END_ANALYSIS_PACK_JSON

---

## 부록: 교차표 상세

${analysisPack.crosstabs.length > 0
  ? analysisPack.crosstabs
      .map((ct) => {
        return `### ${ct.rowQuestionBody} × ${ct.colQuestionBody}

| ${ct.colQuestionBody} | ${Object.keys(ct.colTotals).join(' | ')} | 합계 |
|${' --- |'.repeat(Object.keys(ct.colTotals).length + 2)}|
${Object.entries(ct.rowTotals)
  .map(([rowKey, rowTotal]) => {
    const cells = ct.cells.filter((c) => c.rowKey === rowKey)
    const cellValues = Object.keys(ct.colTotals).map((colKey) => {
      const cell = cells.find((c) => c.colKey === colKey)
      return cell ? `${cell.count} (${cell.rowPct.toFixed(1)}%)` : '0'
    })
    return `| ${rowKey} | ${cellValues.join(' | ')} | ${rowTotal} |`
  })
  .join('\n')}
| 합계 | ${Object.values(ct.colTotals).join(' | ')} | ${analysisPack.campaign.sampleCount} |

**최소 셀 크기**: ${ct.minCellCount}명
${ct.minCellCount < 5 ? '⚠️ 일부 셀의 표본 수가 5 미만입니다. 세부 결론은 가설로만 사용하세요.' : ''}`
      })
      .join('\n\n')
  : '교차표 데이터가 없습니다.'}
`

  return md
}

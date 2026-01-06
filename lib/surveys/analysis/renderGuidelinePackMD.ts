/**
 * Guideline Pack을 Markdown 형식으로 렌더링
 */

import type { GuidelinePack } from './guidelinePackSchema'

export function renderGuidelinePackMD(
  guideline: {
    id: string
    title: string | null
    description: string | null
    status: string
    version_int: number
    created_at: string
    published_at: string | null
    guideline_pack: GuidelinePack
  },
  questionsMap?: Map<string, { body: string; type: string; options: Array<{ id: string; text: string }> }>
): string {
  const pack = guideline.guideline_pack
  const roleLabels: Record<string, string> = {
    timeline: '타임라인',
    need_area: '니즈 영역',
    budget_status: '예산 상태',
    authority_level: '권한 수준',
    engagement_intent: '참여 의향',
    other: '기타',
  }

  const importanceLabels: Record<string, string> = {
    core: '핵심',
    supporting: '보조',
  }

  let md = `# ${guideline.title || '분석 지침'}\n\n`
  
  md += `**상태**: ${guideline.status === 'published' ? 'Published' : guideline.status === 'draft' ? 'Draft' : 'Archived'}\n`
  md += `**버전**: ${guideline.version_int}\n`
  md += `**생성일**: ${new Date(guideline.created_at).toLocaleString('ko-KR')}\n`
  if (guideline.published_at) {
    md += `**Published일**: ${new Date(guideline.published_at).toLocaleString('ko-KR')}\n`
  }
  md += `**Form Fingerprint**: \`${pack.formFingerprint}\`\n\n`

  if (guideline.description) {
    md += `## 설명\n\n${guideline.description}\n\n`
  }

  md += `---\n\n`

  // Objectives
  md += `## 분석 목적\n\n`
  md += `**기본 렌즈**: ${pack.objectives.reportLensDefault}\n\n`
  md += `**주요 의사결정 질문**:\n\n`
  pack.objectives.primaryDecisionQuestions.forEach((q, idx) => {
    md += `${idx + 1}. ${q}\n`
  })
  md += `\n`

  // Question Map
  md += `## 문항 매핑\n\n`
  pack.questionMap.forEach((qm, idx) => {
    const questionInfo = questionsMap?.get(qm.questionId)
    const questionBody = questionInfo?.body || qm.label || qm.questionId
    
    md += `### 문항 ${idx + 1}: ${questionBody}\n\n`
    md += `- **ID**: \`${qm.questionId}\`\n`
    md += `- **순서**: ${qm.orderNo}\n`
    md += `- **유형**: ${questionInfo?.type === 'single' ? '단일 선택' : questionInfo?.type === 'multiple' ? '다중 선택' : questionInfo?.type === 'text' ? '텍스트' : '알 수 없음'}\n`
    md += `- **역할**: ${roleLabels[qm.role] || qm.role} (${qm.role})\n`
    md += `- **중요도**: ${importanceLabels[qm.importance] || qm.importance}\n\n`

    // 선택지 목록 표시
    if (questionInfo?.options && questionInfo.options.length > 0) {
      md += `**선택지**:\n\n`
      questionInfo.options.forEach((opt) => {
        md += `- \`${opt.id}\`: ${opt.text}\n`
      })
      md += `\n`
    }

    // 옵션 그룹 표시 (선택지 텍스트 포함)
    if (qm.optionGroups && qm.optionGroups.length > 0) {
      md += `**옵션 그룹**:\n\n`
      qm.optionGroups.forEach((og) => {
        const choiceTexts: string[] = []
        if (questionInfo?.options) {
          og.choiceIds.forEach((choiceId) => {
            const option = questionInfo.options.find((opt) => opt.id === choiceId)
            if (option) {
              choiceTexts.push(`${option.text} (\`${choiceId}\`)`)
            } else {
              choiceTexts.push(`\`${choiceId}\``)
            }
          })
        } else {
          choiceTexts.push(...og.choiceIds.map((id) => `\`${id}\``))
        }
        md += `- **${og.groupLabel}** (\`${og.groupKey}\`): ${choiceTexts.length > 0 ? choiceTexts.join(', ') : '(없음)'}\n`
      })
      md += `\n`
    }

    if (qm.scoring && qm.scoring.enabled) {
      md += `**스코어링**: 활성화됨\n`
      if (qm.scoring.weightsByGroupKey) {
        md += `- 그룹별 가중치:\n`
        Object.entries(qm.scoring.weightsByGroupKey).forEach(([key, weight]) => {
          md += `  - \`${key}\`: ${weight}\n`
        })
      }
      if (qm.scoring.weightsByChoiceId) {
        md += `- 선택지별 가중치:\n`
        Object.entries(qm.scoring.weightsByChoiceId).forEach(([id, weight]) => {
          md += `  - \`${id}\`: ${weight}\n`
        })
      }
      md += `\n`
    }
  })

  // Crosstab Plan
  md += `## 교차표 계획\n\n`
  if (pack.crosstabPlan.length === 0) {
    md += `교차표 계획이 없습니다.\n\n`
  } else {
    pack.crosstabPlan.forEach((plan, idx) => {
      md += `### 교차표 ${idx + 1}\n\n`
      md += `- **행 역할**: ${roleLabels[plan.rowRole] || plan.rowRole} (\`${plan.rowRole}\`)\n`
      md += `- **열 역할**: ${roleLabels[plan.colRole] || plan.colRole} (\`${plan.colRole}\`)\n`
      md += `- **최소 셀 수**: ${plan.minCellN}\n`
      md += `- **상위 행 수**: ${plan.topKRows}\n`
      md += `- **상위 열 수**: ${plan.topKCols}\n`
      if (plan.note) {
        md += `- **참고**: ${plan.note}\n`
      }
      md += `\n`
    })
  }

  // Lead Scoring
  md += `## 리드 스코어링 설정\n\n`
  if (!pack.leadScoring.enabled) {
    md += `리드 스코어링이 비활성화되어 있습니다.\n\n`
  } else {
    md += `**티어 임계값**:\n`
    md += `- P0: ${pack.leadScoring.tierThresholds.P0} 이상\n`
    md += `- P1: ${pack.leadScoring.tierThresholds.P1} 이상\n`
    md += `- P2: ${pack.leadScoring.tierThresholds.P2} 이상\n`
    md += `- P3: ${pack.leadScoring.tierThresholds.P3} 이상\n`
    md += `- P4: ${pack.leadScoring.tierThresholds.P3} 미만\n\n`

    md += `**컴포넌트**:\n\n`
    pack.leadScoring.components.forEach((comp) => {
      md += `- ${roleLabels[comp.role] || comp.role} (\`${comp.role}\`): 가중치 ${comp.weight}\n`
    })
    md += `\n`

    md += `**티어별 추천 액션**:\n\n`
    Object.entries(pack.leadScoring.recommendedActionsByTier).forEach(([tier, action]) => {
      md += `- **${tier}**: ${action}\n`
    })
    md += `\n`
  }

  md += `---\n\n`
  md += `*생성일: ${new Date().toLocaleString('ko-KR')}*\n`

  return md
}

'use client'

import { useState, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface PublicDashboardClientProps {
  campaign: any
}

interface PublicReport {
  id: string
  analyzed_at: string
  sample_count: number
  total_questions: number
  report_title: string
  summary: string
  lens: string
  created_at: string
}

interface PublicReportDetail extends PublicReport {
  report_content_md: string
  report_content_full_md: string
  report_md?: string
  action_pack?: any // Action Pack 추가
  analysis_pack?: any // Analysis Pack 추가
  decision_pack?: any // Decision Pack 추가
  statistics_snapshot: any
  references_used: any
}

// 컬러풀한 도넛 차트 색상 팔레트
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

// Action Pack 렌더러 컴포넌트 (AnalysisReportSection.tsx에서 복사)
function ActionPackRenderer({ actionPack }: { actionPack: any }) {
  if (!actionPack) return null

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Decision Cards (Decision-grade v3) */}
      {actionPack.decisionCards && actionPack.decisionCards.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            🎯 Decision Cards (의사결정 지원)
          </h2>
          <div className="space-y-6">
            {actionPack.decisionCards.map((card: any, index: number) => {
              const confidenceBadge = card.confidence === 'Confirmed' 
                ? '✅ 확정' 
                : card.confidence === 'Directional' 
                ? '⚠️ 방향성' 
                : '❓ 가설'
              const confidenceColor = card.confidence === 'Confirmed'
                ? 'bg-green-100 text-green-800 border-green-300'
                : card.confidence === 'Directional'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'bg-gray-100 text-gray-800 border-gray-300'
              
              return (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 flex-1">{index + 1}. {card.question}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${confidenceColor}`}>
                      {confidenceBadge}
                    </span>
                  </div>
                  
                  {/* 선택지 비교 */}
                  <div className="mb-4 space-y-3">
                    <h4 className="font-semibold text-slate-900 mb-2">선택지 비교</h4>
                    {card.options && card.options.map((opt: any) => {
                      const isRecommended = opt.id === card.recommendation
                      return (
                        <div
                          key={opt.id}
                          className={`p-4 rounded-lg border-2 ${
                            isRecommended
                              ? 'bg-blue-50 border-blue-400 shadow-md'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-bold text-slate-900">옵션 {opt.id}: {opt.title}</h5>
                            {isRecommended && (
                              <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                                👉 추천
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{opt.description}</p>
                          <p className="text-sm text-slate-600"><strong>기대 효과:</strong> {opt.expectedImpact}</p>
                          {opt.risks && (
                            <p className="text-sm text-orange-700 mt-2"><strong>리스크:</strong> {opt.risks}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* 추천 이유 및 근거 */}
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-semibold text-blue-900 mb-2">추천 이유</p>
                    <p className="text-sm text-blue-800 mb-2">{card.rationale}</p>
                    <p className="text-xs text-blue-700">
                      <strong>근거 참조:</strong> {card.evidenceIds?.join(', ') || '없음'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Board (Decision-grade v3) */}
      {actionPack.actionBoard && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            📋 Action Board (실행 계획)
          </h2>
          <div className="space-y-6">
            {/* 24시간 내 실행 */}
            {actionPack.actionBoard.d0 && actionPack.actionBoard.d0.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">24시간 내 실행 (D+0)</h3>
                <div className="space-y-4">
                  {actionPack.actionBoard.d0.map((action: any, index: number) => {
                    const ownerText = action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
                    return (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-900">{ownerText}: {action.title}</h4>
                        </div>
                        <div className="text-sm text-slate-700 space-y-1">
                          <p><strong>대상:</strong> {action.targetCount}</p>
                          <p><strong>목표 KPI:</strong> {action.kpi}</p>
                          {action.steps && action.steps.length > 0 && (
                            <div className="mt-2">
                              <p className="font-semibold mb-1">실행 단계:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {action.steps.map((step: string, stepIndex: number) => (
                                  <li key={stepIndex}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 7일 내 실행 */}
            {actionPack.actionBoard.d7 && actionPack.actionBoard.d7.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">7일 내 실행 (D+7)</h3>
                <div className="space-y-4">
                  {actionPack.actionBoard.d7.map((action: any, index: number) => {
                    const ownerText = action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
                    return (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-900">{ownerText}: {action.title}</h4>
                        </div>
                        <div className="text-sm text-slate-700 space-y-1">
                          <p><strong>대상:</strong> {action.targetCount}</p>
                          <p><strong>목표 KPI:</strong> {action.kpi}</p>
                          {action.steps && action.steps.length > 0 && (
                            <div className="mt-2">
                              <p className="font-semibold mb-1">실행 단계:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {action.steps.map((step: string, stepIndex: number) => (
                                  <li key={stepIndex}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 14일 내 실행 */}
            {actionPack.actionBoard.d14 && actionPack.actionBoard.d14.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">14일 내 실행 (D+14)</h3>
                <div className="space-y-4">
                  {actionPack.actionBoard.d14.map((action: any, index: number) => {
                    const ownerText = action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
                    return (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-900">{ownerText}: {action.title}</h4>
                        </div>
                        <div className="text-sm text-slate-700 space-y-1">
                          <p><strong>대상:</strong> {action.targetCount}</p>
                          <p><strong>목표 KPI:</strong> {action.kpi}</p>
                          {action.steps && action.steps.length > 0 && (
                            <div className="mt-2">
                              <p className="font-semibold mb-1">실행 단계:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {action.steps.map((step: string, stepIndex: number) => (
                                  <li key={stepIndex}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Playbooks */}
      {actionPack.playbooks && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            📖 Playbooks
          </h2>
          <div className="space-y-6">
            {actionPack.playbooks.sales && actionPack.playbooks.sales.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">세일즈 플레이북</h3>
                <ul className="list-decimal list-inside space-y-2 text-slate-700">
                  {actionPack.playbooks.sales.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {actionPack.playbooks.marketing && actionPack.playbooks.marketing.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">마케팅 플레이북</h3>
                <ul className="list-decimal list-inside space-y-2 text-slate-700">
                  {actionPack.playbooks.marketing.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Executive Summary */}
      {actionPack.executiveSummary && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            📊 Executive Summary
          </h2>
          {actionPack.executiveSummary.oneLiner && (
            <p className="text-base sm:text-lg text-gray-700 mb-3 sm:mb-4 md:mb-6 font-medium">{actionPack.executiveSummary.oneLiner}</p>
          )}
        </div>
      )}

      {/* Insights (V0.9) */}
      {actionPack.insights && actionPack.insights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            💡 주요 인사이트
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.insights.map((insight: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-gray-900 text-base sm:text-lg mb-2">{index + 1}. {insight.title}</h4>
                <div className="text-sm text-gray-700 space-y-1 sm:space-y-2">
                  <p><strong>근거:</strong> {insight.evidence}</p>
                  <p><strong>해석:</strong> {insight.soWhat}</p>
                  {insight.nextActions && insight.nextActions.length > 0 && (
                    <div className="mt-2 sm:mt-3 space-y-2">
                      {insight.nextActions.map((action: any, actionIndex: number) => (
                        <div key={actionIndex} className="p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="font-semibold text-blue-900 mb-1">
                            {action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'} ({action.due})
                          </p>
                          {action.steps && action.steps.length > 0 && (
                            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                              {action.steps.map((step: string, stepIndex: number) => (
                                <li key={stepIndex}>{step}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Queue & SLA */}
      {actionPack.priorityQueue && actionPack.priorityQueue.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            🎯 Priority Queue & SLA
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.priorityQueue.map((queue: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-gray-900 mb-2">{queue.tier}</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>수량:</strong> {queue.count}명</p>
                  <p><strong>비율:</strong> {queue.pct}%</p>
                  <p><strong>SLA:</strong> {queue.sla}</p>
                  <p className="mt-2"><strong>토크트랙:</strong> {queue.script}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marketing Pack */}
      {actionPack.marketingPack && actionPack.marketingPack.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            📢 Marketing Pack
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.marketingPack.map((pack: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-gray-900 text-base sm:text-lg mb-2">{index + 1}. {pack.theme}</h4>
                <div className="text-sm text-gray-700 space-y-2">
                  <p><strong>타겟 세그먼트:</strong> {pack.targetSegment}</p>
                  
                  {pack.suggestedAssets && pack.suggestedAssets.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">제안 자산:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {pack.suggestedAssets.map((asset: string, assetIndex: number) => (
                          <li key={assetIndex}>{asset}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pack.distribution && pack.distribution.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">배포 채널:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {pack.distribution.map((channel: string, channelIndex: number) => (
                          <li key={channelIndex}>{channel}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p><strong>근거:</strong> {pack.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 설문 개선 제안 */}
      {actionPack.surveyNextQuestions && actionPack.surveyNextQuestions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            🔧 설문 개선 제안
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.surveyNextQuestions.map((rec: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-gray-900 mb-2">{index + 1}. {rec.question}</h4>
                <div className="text-sm text-gray-700 space-y-2">
                  <p><strong>중요성:</strong> {rec.why}</p>
                  <p><strong>답변 유형:</strong> {rec.answerType === 'single' ? '단일 선택' : rec.answerType === 'multiple' ? '다중 선택' : '텍스트'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 데이터 품질 */}
      {actionPack.dataQuality && actionPack.dataQuality.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            ⚠️ 데이터 품질
          </h2>
          <div className="space-y-2">
            {actionPack.dataQuality
              .filter((quality: any) => {
                if (typeof quality === 'string') {
                  return !quality.includes('ℹ️ 정보:') && !quality.includes('ℼ 정보:') && quality.trim().length > 0
                }
                if (quality && typeof quality === 'object' && quality.message) {
                  return !quality.message.includes('ℹ️ 정보:') && !quality.message.includes('ℼ 정보:') && quality.message.trim().length > 0
                }
                return false
              })
              .map((quality: any, index: number) => {
                if (typeof quality === 'string') {
                  return (
                    <div key={index} className="p-2 sm:p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm text-blue-800">{quality}</p>
                    </div>
                  )
                }
                if (quality && typeof quality === 'object' && quality.message) {
                  return (
                    <div
                      key={index}
                      className={`p-2 sm:p-3 rounded-lg ${
                        quality.level === 'warning' ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <p className={`text-sm ${quality.level === 'warning' ? 'text-yellow-800' : 'text-blue-800'}`}>
                        <strong>{quality.level === 'warning' ? '⚠️ 경고' : 'ℹ️ 정보'}:</strong> {quality.message}
                      </p>
                    </div>
                  )
                }
                return null
              })}
          </div>
        </div>
      )}
    </div>
  )
}

// 마크다운 렌더러 컴포넌트 (주요 발견사항 및 권장사항 카드화)
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  const sections: Array<{ title: string; content: string; isKeyFindings: boolean; isRecommendations: boolean }> = []
  let currentTitle = ''
  let currentContent: string[] = []

  const processSection = () => {
    if (currentContent.length > 0 || currentTitle) {
      const sectionContent = currentContent.join('\n')
      const isKeyFindings =
        currentTitle.includes('주요 발견사항') ||
        currentTitle.includes('주요 발견') ||
        currentTitle.includes('Key Findings') ||
        currentTitle.includes('주요 인사이트')
      
      const isRecommendations =
        currentTitle.includes('권장사항') ||
        currentTitle.includes('권장') ||
        currentTitle.includes('Recommendations') ||
        currentTitle.includes('제안사항')

      sections.push({
        title: currentTitle.replace(/^##\s*/, ''),
        content: sectionContent,
        isKeyFindings,
        isRecommendations,
      })
      currentContent = []
      currentTitle = ''
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('##')) {
      processSection()
      currentTitle = trimmed
    } else {
      currentContent.push(line)
    }
  })

  processSection()

  if (sections.length === 0) {
    return <MarkdownContent content={content} isCardMode={false} isRecommendations={false} />
  }

  return (
    <div>
      {sections.map((section, index) => (
        <div key={index} className={index > 0 ? 'mt-6' : ''}>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
            {section.title && (
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                {section.title}
              </h2>
            )}
            <MarkdownContent 
              content={section.content} 
              isCardMode={section.isKeyFindings} 
              isRecommendations={section.isRecommendations}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// 마크다운 콘텐츠 렌더러
function MarkdownContent({ content, isCardMode, isRecommendations = false }: { content: string; isCardMode: boolean; isRecommendations?: boolean }) {
  if (isRecommendations) {
    // 권장사항 모드: 깔끔한 카드 디자인
    const RecommendationCard = ({ blockContent, index }: { blockContent: string; index: number }) => {
      const lines = blockContent.split('\n')
      if (lines.length === 0) return null

      let title = ''
      let category = ''
      let contentWithoutTitle = blockContent

      // 제목 추출 (###)
      const titleMatch = lines[0].match(/^###\s*(.+)$/)
      if (titleMatch) {
        title = titleMatch[1].trim()
        contentWithoutTitle = lines.slice(1).join('\n')
      }

      const categoryMatch = (contentWithoutTitle + ' ' + title).match(/(performance|content|marketing|sales|기술|콘텐츠|마케팅|영업|성능|컨텐츠)/i)
      if (categoryMatch) {
        const matched = categoryMatch[1].toLowerCase()
        const categoryMap: Record<string, string> = {
          performance: 'performance',
          content: 'content',
          marketing: 'marketing',
          sales: 'sales',
          기술: 'performance',
          성능: 'performance',
          콘텐츠: 'content',
          컨텐츠: 'content',
          마케팅: 'marketing',
          영업: 'sales',
        }
        category = categoryMap[matched] || matched
      }

      const getCategoryTag = (cat: string) => {
        const categoryMap: Record<string, { label: string; bg: string; text: string }> = {
          performance: { label: 'performance', bg: 'bg-blue-100', text: 'text-blue-700' },
          content: { label: 'content', bg: 'bg-blue-100', text: 'text-blue-700' },
          marketing: { label: 'marketing', bg: 'bg-blue-100', text: 'text-blue-700' },
          sales: { label: 'sales', bg: 'bg-blue-100', text: 'text-blue-700' },
        }
        return categoryMap[cat] || { label: cat, bg: 'bg-blue-100', text: 'text-blue-700' }
      }

      const categoryTag = category ? getCategoryTag(category) : null

      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            {title && (
              <h4 className="font-bold text-gray-900 text-lg flex-1 pr-4">{title}</h4>
            )}
            {categoryTag && (
              <span className={`px-3 py-1 text-xs rounded ${categoryTag.bg} ${categoryTag.text} whitespace-nowrap font-medium`}>
                {categoryTag.label}
              </span>
            )}
          </div>
          <div className="text-gray-700">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="text-gray-700 mb-4 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 pl-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-2 pl-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-gray-700 mb-1 leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-gray-900">{children}</strong>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold text-gray-900 mt-4 mb-2">{children}</h4>
                ),
              }}
            >
              {contentWithoutTitle.trim()}
            </ReactMarkdown>
          </div>
        </div>
      )
    }

    const blocks = content.split(/(?=^###\s)/m).filter((b) => b.trim())
    
    return (
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <RecommendationCard key={index} blockContent={block} index={index} />
        ))}
      </div>
    )
  }

  if (isCardMode) {
    // 주요 발견사항 카드 모드
    const blocks = content.split(/(?=^###\s)/m).filter((b) => b.trim())
    const cards: JSX.Element[] = []

    if (blocks.length === 0) {
      // ### 제목이 없으면 일반 단락으로 처리
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim())
      paragraphs.forEach((para, index) => {
        if (para.trim()) {
          cards.push(
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4">
              <div className="text-sm text-gray-700">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-3 leading-relaxed">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-2 mb-3 pl-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-2 mb-3 pl-2">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-gray-900">{children}</strong>
                    ),
                  }}
                >
                  {para.trim()}
                </ReactMarkdown>
              </div>
            </div>
          )
        }
      })
    } else {
      blocks.forEach((block, index) => {
        const lines = block.split('\n')
        if (lines.length === 0) return

        let title = ''
        let priority = ''
        let contentWithoutTitle = block

        // 제목 추출 (###)
        const titleMatch = lines[0].match(/^###\s*(.+)$/)
        if (titleMatch) {
          title = titleMatch[1].trim()
          contentWithoutTitle = lines.slice(1).join('\n')
        }

        // 우선순위 추출
        const priorityMatch = contentWithoutTitle.match(/(높음|중간|낮음)/)
        if (priorityMatch) {
          priority = priorityMatch[1]
        }

        // 카드 배경색 결정
        const bgColor =
          priority === '높음'
            ? 'bg-red-50 border-red-200'
            : priority === '중간'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'

        cards.push(
          <div key={index} className={`rounded-lg border p-5 mb-4 ${bgColor}`}>
            <div className="flex items-start justify-between mb-3">
              {title && <h4 className="font-bold text-gray-900 text-base flex-1">{title}</h4>}
              {priority && (
                <span
                  className={`px-2 py-1 text-xs rounded ml-2 whitespace-nowrap ${
                    priority === '높음'
                      ? 'bg-red-100 text-red-700'
                      : priority === '중간'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {priority}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-700">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-3 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-2 mb-3 pl-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 mb-3 pl-2">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-bold text-gray-900">{children}</strong>
                  ),
                }}
              >
                {contentWithoutTitle.trim()}
              </ReactMarkdown>
            </div>
          </div>
        )
      })
    }

    return <div className="space-y-4">{cards}</div>
  }

  // 일반 모드: 박스로 감싼 표준 마크다운 렌더링
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
      <div className="text-gray-700">
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <h2 className="text-xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b border-gray-200">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-bold text-gray-900 mt-5 mb-3">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-base font-semibold text-gray-900 mt-4 mb-2">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="text-gray-700 mb-4 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 pl-2">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-2 pl-2">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-700 mb-1 leading-relaxed">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-gray-900">{children}</strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4 bg-gray-50 py-2 rounded">
                {children}
              </blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export default function PublicDashboardClient({ campaign }: PublicDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'reports' | 'qr-check' | 'manual-management'>('stats' as 'stats' | 'reports' | 'qr-check' | 'manual-management')
  const [loadingStats, setLoadingStats] = useState(false)
  const [questionStats, setQuestionStats] = useState<any[]>([])
  const [publicReports, setPublicReports] = useState<PublicReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [selectedReport, setSelectedReport] = useState<PublicReportDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  // QR 체크인 관련 상태
  const [qrCode, setQrCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [verifiedEntries, setVerifiedEntries] = useState<any[]>([])
  const [loadingVerifiedEntries, setLoadingVerifiedEntries] = useState(false)
  const [totalRegistered, setTotalRegistered] = useState(0)
  const [totalVerified, setTotalVerified] = useState(0)
  const [isScanningMode, setIsScanningMode] = useState(false)
  const qrInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 통계 상태 (클라이언트에서 업데이트 가능)
  const [campaignStats, setCampaignStats] = useState(campaign.stats || {
    total_completed: 0,
    total_verified: 0,
    total_prize_recorded: 0,
  })
  const [refreshingStats, setRefreshingStats] = useState(false)
  
  // 수동 관리 관련 상태
  const [manualEntries, setManualEntries] = useState<any[]>([])
  const [loadingManualEntries, setLoadingManualEntries] = useState(false)
  const [updatingPrize, setUpdatingPrize] = useState<string | null>(null)
  
  useEffect(() => {
    if (campaign.form_id) {
      loadQuestionStats()
    }
    loadPublicReports()
    if (activeTab === 'qr-check') {
      loadVerifiedEntries()
    }
    if (activeTab === 'manual-management') {
      loadManualEntries()
    }
  }, [campaign.id, campaign.form_id, activeTab])

  // 스캔 모드가 열릴 때 입력 필드에 포커스
  useEffect(() => {
    if (isScanningMode && qrInputRef.current) {
      setTimeout(() => {
        qrInputRef.current?.focus()
      }, 100)
    }
  }, [isScanningMode])

  // ESC 키로 스캔 모드 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isScanningMode) {
        setIsScanningMode(false)
        setQrCode('')
        setScanResult(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isScanningMode])

  // QR 코드 입력 완료 감지 (자동 스캔)
  useEffect(() => {
    if (!isScanningMode || !qrCode.trim() || scanning) return

    // 기존 타이머 클리어
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // 입력이 멈춘 후 500ms 후 자동 스캔
    scanTimeoutRef.current = setTimeout(async () => {
      if (qrCode.trim() && !scanning) {
        await performScan(qrCode)
      }
    }, 500)

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [qrCode, isScanningMode, scanning])
  
  const loadVerifiedEntries = async () => {
    setLoadingVerifiedEntries(true)
    try {
      const response = await fetch(`/api/public/event-survey/${campaign.id}/verified-entries`)
      const result = await response.json()
      
      if (result.success) {
        setVerifiedEntries(result.entries || [])
        setTotalRegistered(result.total_registered || 0)
        setTotalVerified(result.total_verified || 0)
      }
    } catch (error) {
      console.error('체크인 목록 로드 오류:', error)
    } finally {
      setLoadingVerifiedEntries(false)
    }
  }
  
  const performScan = async (code: string) => {
    if (!code.trim()) {
      setScanResult({ error: 'QR 코드를 입력해주세요.' })
      return
    }
    
    setScanning(true)
    setScanResult(null)
    
    try {
      const response = await fetch(`/api/public/event-survey/${campaign.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code6: code.trim() }),
      })
      
      const result = await response.json()
      
      if (result.found && result.completed) {
        setScanResult({
          success: true,
          survey_no: result.survey_no,
          name: result.name,
          company: result.company,
          isNewVerification: result.isNewVerification,
          message: result.isNewVerification ? '체크인 완료!' : result.message || '이미 체크인되었습니다.',
        })
        // QR 코드 입력 필드 초기화
        setQrCode('')
        // 체크인 목록 새로고침
        await loadVerifiedEntries()
        
        // 성공 후 다음 스캔 대기 (2초 후 입력 필드에 포커스)
        setTimeout(() => {
          if (isScanningMode && qrInputRef.current) {
            qrInputRef.current.focus()
          }
        }, 2000)
      } else {
        setScanResult({
          success: false,
          error: result.message || 'QR 코드를 찾을 수 없습니다.',
        })
        // 실패 후 입력 필드 초기화 및 포커스
        setTimeout(() => {
          setQrCode('')
          if (isScanningMode && qrInputRef.current) {
            qrInputRef.current.focus()
          }
        }, 2000)
      }
    } catch (error: any) {
      console.error('QR 스캔 오류:', error)
      setScanResult({
        success: false,
        error: 'QR 스캔 중 오류가 발생했습니다. 다시 시도해주세요.',
      })
      // 에러 후 입력 필드 초기화 및 포커스
      setTimeout(() => {
        setQrCode('')
        if (isScanningMode && qrInputRef.current) {
          qrInputRef.current.focus()
        }
      }, 2000)
    } finally {
      setScanning(false)
    }
  }

  const handleQRScan = async (e: React.FormEvent) => {
    e.preventDefault()
    await performScan(qrCode)
  }
  
  const loadQuestionStats = async () => {
    if (!campaign.form_id) return
    
    setLoadingStats(true)
    try {
      const response = await fetch(`/api/public/event-survey/campaigns/${campaign.id}/question-stats`)
      const result = await response.json()
      
      if (result.success && result.questionStats) {
        setQuestionStats(result.questionStats)
      }
    } catch (error) {
      console.error('문항별 통계 로드 오류:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const refreshStats = async () => {
    setRefreshingStats(true)
    try {
      // 통계 카드 데이터 새로고침
      const statsResponse = await fetch(`/api/public/event-survey/campaigns/${campaign.id}/stats`)
      const statsResult = await statsResponse.json()
      
      if (statsResult.success && statsResult.stats) {
        setCampaignStats(statsResult.stats)
      }

      // 문항별 통계도 함께 새로고침
      if (campaign.form_id) {
        await loadQuestionStats()
      }
    } catch (error) {
      console.error('통계 새로고침 오류:', error)
    } finally {
      setRefreshingStats(false)
    }
  }

  const loadManualEntries = async () => {
    setLoadingManualEntries(true)
    try {
      const response = await fetch(`/api/public/event-survey/campaigns/${campaign.id}/entries`)
      const result = await response.json()
      
      if (result.success && result.entries) {
        setManualEntries(result.entries)
      }
    } catch (error) {
      console.error('참여자 목록 로드 오류:', error)
    } finally {
      setLoadingManualEntries(false)
    }
  }

  const updatePrize = async (entryId: string, prizeLabel: string | null) => {
    // Optimistic update: UI를 먼저 업데이트
    setManualEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, prize_label: prizeLabel } : entry
      )
    )
    
    setUpdatingPrize(entryId)
    try {
      const response = await fetch(`/api/public/event-survey/campaigns/${campaign.id}/entries/${entryId}/prize`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prize_label: prizeLabel }),
      })

      const result = await response.json()

      if (result.success) {
        // 통계만 새로고침 (목록은 이미 업데이트됨)
        await refreshStats()
      } else {
        // 실패 시 원래대로 되돌리기
        await loadManualEntries()
        alert('경품 기록 업데이트에 실패했습니다: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('경품 기록 업데이트 오류:', error)
      // 실패 시 원래대로 되돌리기
      await loadManualEntries()
      alert('경품 기록 업데이트 중 오류가 발생했습니다.')
    } finally {
      setUpdatingPrize(null)
    }
  }

  const loadPublicReports = async () => {
    setLoadingReports(true)
    try {
      const response = await fetch(`/api/public/event-survey/campaigns/${campaign.id}/analysis/reports`)
      const result = await response.json()
      
      if (result.success && result.reports) {
        setPublicReports(result.reports)
      }
    } catch (error) {
      console.error('공개 보고서 목록 로드 오류:', error)
    } finally {
      setLoadingReports(false)
    }
  }

  const handleViewReport = async (reportId: string) => {
    setLoadingDetail(true)
    try {
      const response = await fetch(
        `/api/public/event-survey/campaigns/${campaign.id}/analysis/reports/${reportId}`
      )
      const result = await response.json()

      if (result.success && result.report) {
        setSelectedReport(result.report)
      }
    } catch (error) {
      console.error('보고서 상세 로드 오류:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const renderDonutCharts = () => {
    // 새 파이프라인 (analysis_pack) 또는 기존 파이프라인 (statistics_snapshot.questions) 지원
    let questions: any[] = []
    
    if (selectedReport?.analysis_pack?.questions) {
      // 새 파이프라인: analysis_pack.questions 사용
      questions = selectedReport.analysis_pack.questions
    } else if (selectedReport?.statistics_snapshot?.questions) {
      // 기존 파이프라인: statistics_snapshot.questions 사용
      questions = selectedReport.statistics_snapshot.questions
    }
    
    if (questions.length === 0) return null

    // 새 파이프라인은 topChoices를 사용, 기존 파이프라인은 choiceDistribution 사용
    const summaryQuestions = questions
      .filter((q: any) => {
        // 새 파이프라인: topChoices가 있고 questionType이 text가 아닌 경우
        if (q.topChoices && q.topChoices.length > 0 && q.questionType !== 'text') {
          return true
        }
        // 기존 파이프라인: analysis?.summary_chart가 있는 경우
        if (q.analysis?.summary_chart && q.questionType !== 'text') {
          return true
        }
        return false
      })
      .slice(0, 6)

    if (summaryQuestions.length === 0) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {summaryQuestions.map((question: any) => {
          // 새 파이프라인: topChoices를 사용하여 데이터 생성
          let data: any[] = []
          
          if (question.topChoices && question.topChoices.length > 0) {
            // 새 파이프라인: topChoices를 차트 데이터로 변환
            data = question.topChoices.map((choice: any) => ({
              name: choice.text,
              value: choice.count,
            }))
          } else if (question.choiceDistribution) {
            // 기존 파이프라인: choiceDistribution 사용
            data = Object.entries(question.choiceDistribution).map(([key, value]) => {
              const option = question.options?.find((opt: any) => (opt.id || opt) === key)
              return {
                name: option ? (option.text || option) : key,
                value: value as number,
              }
            })
          }
          
          if (data.length === 0) return null

          return (
            <div key={question.questionId} className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 line-clamp-2">{question.questionBody}</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => {
                      if (percent && percent < 0.05) return ''
                      return `${percent ? (percent * 100).toFixed(0) : 0}%`
                    }}
                    outerRadius={70}
                    innerRadius={30}
                    fill="#8884d8"
                    dataKey="value"
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {data.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                    formatter={(value: number, name: string, props: any) => {
                      const percent = props.payload.percent
                      return [`${value}명 (${percent ? (percent * 100).toFixed(1) : 0}%)`, props.payload.name]
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: '11px',
                      paddingTop: '8px',
                    }}
                    formatter={(value: string) => {
                      if (value.length > 15) {
                        return value.substring(0, 15) + '...'
                      }
                      return value
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>
    )
  }
  
  // 옵션별 색상 결정 함수 (문항별로 컬러풀하고 대비가 뚜렷한 색상 팔레트 사용)
  const getColorForOption = (orderNo: number, optionText: string, optionIndex: number, totalOptions: number) => {
    // 문항 1: 빨강/주황/노랑/초록 계열 (긴박도) - 컬러풀
    if (orderNo === 1) {
      const urgencyColors = [
        '#dc2626', // 진한 빨강
        '#ea580c', // 주황
        '#f59e0b', // 노랑
        '#84cc16', // 연두
        '#22c55e', // 초록
        '#10b981', // 청록
        '#d1d5db', // 연한 회색
      ]
      // 텍스트 매칭 시도
      const textMatch: Record<string, number> = {
        '1주일 이내': 0,
        '1개월 이내': 1,
        '1개월 - 3개월': 2,
        '3개월 - 6개월': 3,
        '6개월 - 12개월': 4,
        '1년 이후': 5,
        '계획없음': 6,
        '계획 없음': 6,
      }
      const matchedIndex = textMatch[optionText]
      if (matchedIndex !== undefined) {
        return urgencyColors[matchedIndex] || urgencyColors[optionIndex % urgencyColors.length]
      }
      return urgencyColors[optionIndex % urgencyColors.length]
    }
    
    // 문항 2: 다양한 색상 팔레트 (파란톤 대신 컬러풀하게)
    if (orderNo === 2) {
      const projectColors = [
        '#3b82f6', // 파랑
        '#10b981', // 초록
        '#f59e0b', // 주황
        '#ef4444', // 빨강
        '#8b5cf6', // 보라
        '#ec4899', // 핑크
        '#06b6d4', // 청록
        '#84cc16', // 연두
        '#f97316', // 오렌지
        '#6366f1', // 인디고
        '#14b8a6', // 틸
        '#d1d5db', // 회색
      ]
      return projectColors[optionIndex % projectColors.length]
    }
    
    // 문항 3: 다양한 색상 팔레트 (보라톤 대신 컬러풀하게)
    if (orderNo === 3) {
      const actionColors = [
        '#10b981', // 초록
        '#3b82f6', // 파랑
        '#f59e0b', // 주황
        '#ef4444', // 빨강
        '#8b5cf6', // 보라
        '#ec4899', // 핑크
        '#06b6d4', // 청록
        '#84cc16', // 연두
        '#f97316', // 오렌지
        '#6366f1', // 인디고
        '#14b8a6', // 틸
        '#9ca3af', // 회색 (관심 없음용)
      ]
      // 텍스트 매칭 시도
      const textMatch: Record<string, number> = {
        '방문 요청': 0,
        'HPE 네트워크 전문가의 방문 요청': 0,
        '온라인 미팅': 1,
        'HPE 네트워크 전문가의 온라인 미팅 요청': 1,
        '전화 상담': 2,
        'HPE 네트워크 전문가의 전화 상담 요청': 2,
        '관심 없음': 11,
      }
      const matchedIndex = textMatch[optionText]
      if (matchedIndex !== undefined) {
        return actionColors[matchedIndex] || actionColors[optionIndex % actionColors.length]
      }
      return actionColors[optionIndex % actionColors.length]
    }
    
    // 기본: 컬러풀한 색상 팔레트
    const defaultPalettes = [
      ['#dc2626', '#ea580c', '#f59e0b', '#84cc16', '#22c55e', '#10b981'], // 빨강/주황/초록 계열
      ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'], // 다양한 색상
      ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'], // 다양한 색상
    ]
    const palette = defaultPalettes[(orderNo - 1) % defaultPalettes.length]
    return palette[optionIndex % palette.length]
  }
  
  // 문항별 차트 렌더링
  const renderQuestionChart = (stat: any) => {
    const chartData = stat.options.map((option: any, index: number) => {
      const optionId = typeof option === 'string' ? option : option.id
      const optionText = typeof option === 'string' ? option : option.text
      const count = stat.choiceDistribution[optionId] || 0
      const percentage = stat.totalAnswers > 0 
        ? (count / stat.totalAnswers * 100) 
        : 0
      const fill = getColorForOption(stat.orderNo, optionText, index, stat.options.length)
      return { name: optionText, value: count, percentage, fill }
    })
    
    // 모든 문항: Donut Chart
    const displayData = stat.orderNo === 3 
      ? [...chartData].sort((a, b) => b.value - a.value)
      : chartData
    
    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 10, right: 10, bottom: 60, left: 10 }}>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={false}
              outerRadius={80}
              innerRadius={40}
              fill="#8884d8"
              dataKey="value"
            >
              {displayData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                `${value}명 (${props.payload.percentage.toFixed(1)}%)`,
                props.payload.name
              ]}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '12px' }}
            />
            <Legend
              verticalAlign="bottom"
              height={50}
              formatter={(value, entry: any) => `${entry.payload.name}: ${entry.payload.value}명`}
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-2 sm:py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{campaign.title}</h1>
          {campaign.host && (
            <p className="text-gray-600 text-sm">주최: {campaign.host}</p>
          )}
        </div>
        
        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-xl shadow-lg mb-4 sm:mb-6 md:mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                  activeTab === 'stats'
                    ? 'border-[#00B388] text-[#00B388]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                통계
              </button>
              {publicReports.length > 0 && (
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                    activeTab === 'reports'
                      ? 'border-[#00B388] text-[#00B388]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  AI 분석 보고서
                </button>
              )}
              <button
                onClick={() => {
                  setActiveTab('qr-check')
                  loadVerifiedEntries()
                }}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                  activeTab === 'qr-check'
                    ? 'border-[#00B388] text-[#00B388]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                QR 체크인
              </button>
              <button
                onClick={() => {
                  setActiveTab('manual-management')
                  loadManualEntries()
                }}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                  activeTab === 'manual-management'
                    ? 'border-[#00B388] text-[#00B388]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                수동 관리
              </button>
            </nav>
          </div>
        </div>
        
        {/* QR 체크인 탭 */}
        {activeTab === 'qr-check' && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm text-gray-600 mb-1">전체 등록자</div>
                <div className="text-3xl font-bold text-gray-900">{totalRegistered}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-sm text-gray-600 mb-1">QR 체크인</div>
                <div className="text-3xl font-bold text-[#00B388]">{totalVerified}</div>
                {totalRegistered > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    ({((totalVerified / totalRegistered) * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
            </div>
            
            {/* 스캔받기 버튼 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">QR 코드 스캔</h3>
              <button
                onClick={() => {
                  setIsScanningMode(true)
                  setQrCode('')
                  setScanResult(null)
                }}
                className="w-full px-6 py-4 bg-[#00B388] text-white rounded-lg font-bold text-lg hover:bg-[#008f6d] transition-colors shadow-md"
              >
                스캔받기
              </button>
            </div>
            
            {/* 체크인 목록 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">체크인 목록</h3>
              {loadingVerifiedEntries ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : verifiedEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">아직 체크인된 참여자가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">순번</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">이름</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">회사</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">체크인 시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifiedEntries.map((entry, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900 font-medium">{entry.survey_no}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{entry.name}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{entry.company || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {entry.verified_at
                              ? new Date(entry.verified_at).toLocaleString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR 스캔 모드 팝업 */}
        {isScanningMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">QR 스캔 모드</h2>
                <p className="text-gray-600">스캔 대기 중입니다...</p>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    ref={qrInputRef}
                    type="text"
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    placeholder="QR 코드를 스캔하세요"
                    className="w-full px-4 py-4 border-2 border-[#00B388] rounded-lg focus:border-[#008f6d] outline-none transition-colors text-lg text-center font-mono tracking-wider"
                    disabled={scanning}
                    autoFocus
                  />
                </div>

                {scanning && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#00B388]"></div>
                    <p className="mt-2 text-gray-600">스캔 중...</p>
                  </div>
                )}

                {scanResult && !scanning && (
                  <div className={`p-4 rounded-lg ${
                    scanResult.success
                      ? scanResult.isNewVerification
                        ? 'bg-green-50 border-2 border-green-400'
                        : 'bg-blue-50 border-2 border-blue-400'
                      : 'bg-red-50 border-2 border-red-400'
                  }`}>
                    {scanResult.success ? (
                      <div className="text-center">
                        <p className={`text-lg font-bold mb-3 ${
                          scanResult.isNewVerification ? 'text-green-800' : 'text-blue-800'
                        }`}>
                          {scanResult.message}
                        </p>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p><span className="font-semibold">순번:</span> {scanResult.survey_no}</p>
                          <p><span className="font-semibold">이름:</span> {scanResult.name}</p>
                          {scanResult.company && (
                            <p><span className="font-semibold">회사:</span> {scanResult.company}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-red-800 font-semibold">{scanResult.error}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsScanningMode(false)
                      setQrCode('')
                      setScanResult(null)
                    }}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div>
            {/* 통계 헤더 및 새로고침 버튼 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">통계</h2>
              <button
                onClick={refreshStats}
                disabled={refreshingStats}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className={`w-5 h-5 ${refreshingStats ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {refreshingStats ? '새로고침 중...' : '새로고침'}
              </button>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">총 참여자</div>
            <div className="text-3xl font-bold text-gray-900">{campaignStats.total_completed || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">스캔 완료</div>
            <div className="text-3xl font-bold text-blue-600">{campaignStats.total_verified || 0}</div>
            {campaignStats.total_completed > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                ({((campaignStats.total_verified || 0) / campaignStats.total_completed * 100).toFixed(1)}%)
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">경품 기록</div>
            <div className="text-3xl font-bold text-green-600">{campaignStats.total_prize_recorded || 0}</div>
            {campaignStats.total_completed > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                ({((campaignStats.total_prize_recorded || 0) / campaignStats.total_completed * 100).toFixed(1)}%)
              </div>
            )}
          </div>
        </div>
        
        {/* 문항별 통계 */}
        {campaign.form_id && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">문항별 통계</h3>
            
            {loadingStats ? (
              <div className="text-center py-8 text-gray-500">통계를 불러오는 중...</div>
            ) : questionStats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>아직 응답이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {questionStats.map((stat, index) => (
                  <div key={stat.questionId} className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex flex-col">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-500">문항 {stat.orderNo}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {stat.questionType === 'single' ? '단일 선택' : stat.questionType === 'multiple' ? '다중 선택' : '텍스트'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{stat.questionBody}</h4>
                      <div className="text-xs text-gray-500">
                        총 {stat.totalAnswers}명 응답
                      </div>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center">
                      {stat.questionType === 'text' ? (
                        <div className="w-full">
                          {stat.textAnswers.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {stat.textAnswers.map((answer: string, idx: number) => (
                                <div key={idx} className="bg-white rounded p-2 text-xs text-gray-700">
                                  {answer}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 text-center">응답이 없습니다.</p>
                          )}
                        </div>
                      ) : (
                        <div className="w-full">
                          {stat.options && stat.options.length > 0 ? (
                            <div>
                              {renderQuestionChart(stat)}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 text-center">선택지가 없습니다.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </div>
        )}

        {/* 수동 관리 탭 */}
        {activeTab === 'manual-management' && (
          <div>
            {/* 헤더 및 새로고침 버튼 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">수동 관리</h2>
              <button
                onClick={loadManualEntries}
                disabled={loadingManualEntries}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className={`w-5 h-5 ${loadingManualEntries ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {loadingManualEntries ? '새로고침 중...' : '새로고침'}
              </button>
            </div>

            {/* 통계 카드 */}
            {!loadingManualEntries && manualEntries.length > 0 && (() => {
              const totalParticipants = manualEntries.length
              const umbrellaCount = manualEntries.filter((e: any) => e.prize_label === '우산').length
              const washbagCount = manualEntries.filter((e: any) => e.prize_label === '워시백').length
              const totalPrizeGiven = umbrellaCount + washbagCount
              const umbrellaMax = 50
              const washbagMax = 250
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* 총 참여자 */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">총 참여자</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{totalParticipants}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 경품 지급 */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">경품 지급</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{totalPrizeGiven}</p>
                        <p className="text-xs text-gray-500 mt-1">우산 {umbrellaCount}개 / 워시백 {washbagCount}개</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 우산 현황 */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">우산</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {umbrellaCount} / {umbrellaMax}
                        </p>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              umbrellaCount >= umbrellaMax ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min((umbrellaCount / umbrellaMax) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {umbrellaMax - umbrellaCount}개 남음
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 워시백 현황 */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">워시백</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {washbagCount} / {washbagMax}
                        </p>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              washbagCount >= washbagMax ? 'bg-red-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.min((washbagCount / washbagMax) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {washbagMax - washbagCount}개 남음
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 참여자 목록 테이블 */}
            {loadingManualEntries ? (
              <div className="text-center py-12 text-gray-500">데이터를 불러오는 중...</div>
            ) : manualEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>참여자가 없습니다.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          완료번호
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          확인코드
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          이름
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          회사명
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          전화번호
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          완료일시
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          경품
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {manualEntries.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {entry.survey_no}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                            {entry.code6}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {entry.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.company || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.phone_norm && entry.phone_norm.length >= 4
                              ? `****-****-${entry.phone_norm.slice(-4)}`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.completed_at
                              ? new Date(entry.completed_at).toLocaleString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`prize-${entry.id}`}
                                  checked={entry.prize_label === '우산'}
                                  onChange={() => updatePrize(entry.id, '우산')}
                                  disabled={updatingPrize === entry.id}
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">우산</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`prize-${entry.id}`}
                                  checked={entry.prize_label === '워시백'}
                                  onChange={() => updatePrize(entry.id, '워시백')}
                                  disabled={updatingPrize === entry.id}
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">워시백</span>
                              </label>
                              <span className="text-xs text-gray-500 w-20 text-right">
                                {updatingPrize === entry.id ? '저장 중...' : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI 분석 보고서 탭 */}
        {activeTab === 'reports' && publicReports.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI 분석 보고서</h3>
              {selectedReport && (
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  ← 대시보드 돌아가기
                </button>
              )}
            </div>
            
            {loadingReports ? (
              <div className="text-center py-8 text-gray-500">보고서 목록을 불러오는 중...</div>
            ) : selectedReport ? (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                  {/* 고정 신뢰 문구 */}
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 italic">
                      본 보고서는 캠페인 설문 응답을 기반으로, 리서치/방법론 공개 원칙(AAPOR Transparency)과 시장조사 품질/윤리 가이드라인(ISO 20252, ICC/ESOMAR Code)을 참고하여 작성되었습니다. 또한 리드 우선순위와 후속 액션 제안은 BANT 및 MEDDIC 프레임워크 관점으로 구조화했습니다.
                    </p>
                  </div>

                  {/* 분석 대상 요약 */}
                  <div className="border-b border-gray-200 pb-4 sm:pb-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">🎯 분석 대상</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                      <div className="p-2 sm:p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">분석 시점</div>
                        <div className="text-base sm:text-lg font-bold text-gray-900">
                          <div>{new Date(selectedReport.analyzed_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}</div>
                          <div className="text-sm sm:text-base">{new Date(selectedReport.analyzed_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}</div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">총 응답 수</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {selectedReport.sample_count.toLocaleString()}명
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">분석 문항 수</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {selectedReport.total_questions}개
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">분석 관점</div>
                        <div className="text-lg font-bold text-gray-900">
                          {selectedReport.lens === 'general'
                            ? '일반'
                            : selectedReport.lens === 'sales'
                              ? '영업'
                              : '마케팅'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 레퍼런스 요약 */}
                  {selectedReport.references_used?.references && (
                    <div className="border-b border-gray-200 pb-4 sm:pb-6">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">📚 관련 레퍼런스 요약</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                        {selectedReport.references_used.references.map((ref: any) => (
                          <div key={ref.id} className="bg-gray-50 border border-gray-200 p-3 sm:p-4 rounded-lg">
                            <h4 className="font-semibold text-sm text-gray-900 mb-1">{ref.title}</h4>
                            <p className="text-xs text-gray-600">{ref.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 도넛 차트 요약 */}
                  {renderDonutCharts()}

                {/* AI 분석 본문 */}
                <div className="prose prose-slate max-w-none">
                  {selectedReport.decision_pack || selectedReport.action_pack ? (
                    <ActionPackRenderer actionPack={selectedReport.decision_pack || selectedReport.action_pack} />
                  ) : (
                    <MarkdownRenderer content={selectedReport.report_md || selectedReport.report_content_md || selectedReport.report_content_full_md} />
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => handleViewReport(report.id)}
                  >
                    <h4 className="text-lg font-bold text-gray-900 mb-3">{report.report_title}</h4>
                    <div className="text-sm text-gray-600 space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">분석 시점:</span>
                        <span className="font-medium text-gray-700">
                          {new Date(report.analyzed_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">응답 수:</span>
                        <span className="font-semibold text-gray-900">{report.sample_count.toLocaleString()}명</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">문항 수:</span>
                        <span className="font-semibold text-gray-900">{report.total_questions}개</span>
                      </div>
                    </div>
                    {report.summary && (
                      <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{report.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


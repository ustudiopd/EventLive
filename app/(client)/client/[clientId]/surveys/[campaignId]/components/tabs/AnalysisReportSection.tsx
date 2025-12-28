'use client'

import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface AnalysisReportSectionProps {
  campaignId: string
}

interface Report {
  id: string
  analyzed_at: string
  sample_count: number
  total_questions: number
  report_title: string
  summary: string
  lens: string
  created_at: string
  is_public?: boolean
}

interface ReportDetail extends Report {
  report_content_md: string
  report_content_full_md: string
  report_md?: string
  statistics_snapshot: any
  references_used: any
  action_pack?: any
  analysis_pack?: any
  decision_pack?: any
  generation_warnings?: any[]
}

// 컬러풀한 도넛 차트 색상 팔레트 (프로젝트 일관성 유지)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

// Action Pack V2 렌더러
function ActionPackRenderer({ actionPack }: { actionPack: any }) {
  if (!actionPack) return null

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Executive Summary */}
      {actionPack.executiveSummary && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3 md:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            📊 Executive Summary
          </h2>
          {actionPack.executiveSummary.oneLiner && (
            <p className="text-base sm:text-lg text-slate-700 mb-3 sm:mb-4 md:mb-6 font-medium">{actionPack.executiveSummary.oneLiner}</p>
          )}
          
          {actionPack.executiveSummary.topWins && actionPack.executiveSummary.topWins.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-slate-900 mb-4">주요 발견사항</h3>
              <div className="space-y-4">
                {actionPack.executiveSummary.topWins.map((win: any, index: number) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <h4 className="font-bold text-slate-900 text-lg mb-2">{index + 1}. {win.title}</h4>
                    <div className="text-sm text-slate-700 space-y-2">
                      <p><strong>근거:</strong> {win.evidence}</p>
                      <p><strong>해석:</strong> {win.soWhat}</p>
                      {win.action && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="font-semibold text-blue-900 mb-2">액션:</p>
                          <p className="text-sm text-blue-800 mb-1">
                            <strong>담당:</strong> {win.action.owner === 'sales' ? '영업' : win.action.owner === 'marketing' ? '마케팅' : '운영'} | 
                            <strong> 기한:</strong> {win.action.due}
                          </p>
                          {win.action.steps && win.action.steps.length > 0 && (
                            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                              {win.action.steps.map((step: string, stepIndex: number) => (
                                <li key={stepIndex}>{step}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
            🎯 Action Board (실행 계획)
          </h2>
          
          {/* 24시간 내 실행 */}
          {actionPack.actionBoard.d0 && actionPack.actionBoard.d0.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-semibold">긴급</span>
                24시간 내 실행 (D+0)
              </h3>
              <div className="space-y-3">
                {actionPack.actionBoard.d0.map((action: any, index: number) => {
                  const ownerText = action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
                  return (
                    <div key={index} className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-slate-900">{action.title}</h4>
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded">
                          {ownerText}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 space-y-1 mb-3">
                        <p><strong>대상:</strong> {action.targetCount}</p>
                        <p><strong>목표 KPI:</strong> <span className="font-semibold text-blue-700">{action.kpi}</span></p>
                      </div>
                      {action.steps && action.steps.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1">실행 단계:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                            {action.steps.map((step: string, stepIndex: number) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 7일 내 실행 */}
          {actionPack.actionBoard.d7 && actionPack.actionBoard.d7.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-semibold">단기</span>
                7일 내 실행 (D+7)
              </h3>
              <div className="space-y-3">
                {actionPack.actionBoard.d7.map((action: any, index: number) => {
                  const ownerText = action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
                  return (
                    <div key={index} className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-slate-900">{action.title}</h4>
                        <span className="px-2 py-1 bg-orange-600 text-white text-xs font-semibold rounded">
                          {ownerText}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 space-y-1 mb-3">
                        <p><strong>대상:</strong> {action.targetCount}</p>
                        <p><strong>목표 KPI:</strong> <span className="font-semibold text-blue-700">{action.kpi}</span></p>
                      </div>
                      {action.steps && action.steps.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1">실행 단계:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                            {action.steps.map((step: string, stepIndex: number) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 14일 내 실행 */}
          {actionPack.actionBoard.d14 && actionPack.actionBoard.d14.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">중기</span>
                14일 내 실행 (D+14)
              </h3>
              <div className="space-y-3">
                {actionPack.actionBoard.d14.map((action: any, index: number) => {
                  const ownerText = action.owner === 'sales' ? '영업' : action.owner === 'marketing' ? '마케팅' : '운영'
                  return (
                    <div key={index} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-slate-900">{action.title}</h4>
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                          {ownerText}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 space-y-1 mb-3">
                        <p><strong>대상:</strong> {action.targetCount}</p>
                        <p><strong>목표 KPI:</strong> <span className="font-semibold text-blue-700">{action.kpi}</span></p>
                      </div>
                      {action.steps && action.steps.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1">실행 단계:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                            {action.steps.map((step: string, stepIndex: number) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights (V0.9) */}
      {actionPack.insights && actionPack.insights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            💡 주요 인사이트
          </h2>
          <div className="space-y-4">
            {actionPack.insights.map((insight: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h4 className="font-bold text-slate-900 text-lg mb-2">{index + 1}. {insight.title}</h4>
                <div className="text-sm text-slate-700 space-y-2">
                  <p><strong>근거:</strong> {insight.evidence}</p>
                  <p><strong>해석:</strong> {insight.soWhat}</p>
                  {insight.nextActions && insight.nextActions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {insight.nextActions.map((action: any, actionIndex: number) => (
                        <div key={actionIndex} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
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

      {/* Priority Queue & SLA (V0.9) */}
      {actionPack.priorityQueue && actionPack.priorityQueue.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            🎯 Priority Queue & SLA
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.priorityQueue.map((queue: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-slate-900 mb-2">{queue.tier}</h4>
                <div className="text-sm text-slate-700 space-y-1">
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

      {/* Priority Queue & SLA (V2) */}
      {actionPack.priorityQueueSummary && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            🎯 Priority Queue & SLA
          </h2>
          
          {actionPack.priorityQueueSummary.tiers && actionPack.priorityQueueSummary.tiers.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-slate-900 mb-4">티어별 분포</h3>
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">티어</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">수량</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionPack.priorityQueueSummary.tiers.map((tier: any, index: number) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2 font-semibold">{tier.tier}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{tier.count}명</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{tier.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {actionPack.priorityQueueSummary.slaPlan && actionPack.priorityQueueSummary.slaPlan.length > 0 && (
            <>
              <h3 className="text-lg font-bold text-slate-900 mb-4">SLA 계획</h3>
              <div className="space-y-4">
                {actionPack.priorityQueueSummary.slaPlan.map((sla: any, index: number) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <h4 className="font-bold text-slate-900 mb-2">{sla.tier}</h4>
                    <div className="text-sm text-slate-700 space-y-1">
                      <p><strong>목표 응답 시간:</strong> {sla.targetResponseTime}</p>
                      <p><strong>권장 채널:</strong> {sla.recommendedChannel}</p>
                      <p className="mt-2"><strong>토크트랙:</strong> {sla.script}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Correlation Findings */}
      {actionPack.correlationFindings && actionPack.correlationFindings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            🔍 Correlation Findings
          </h2>
          <div className="space-y-4">
            {actionPack.correlationFindings.map((finding: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h4 className="font-bold text-slate-900 text-lg mb-2">{index + 1}. {finding.title}</h4>
                <div className="text-sm text-slate-700 space-y-2">
                  {finding.evidence?.highlight && <p><strong>근거:</strong> {finding.evidence.highlight}</p>}
                  <p><strong>해석:</strong> {finding.soWhat}</p>
                  {finding.actions && finding.actions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {finding.actions.map((action: any, actionIndex: number) => (
                        <div key={actionIndex} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="font-semibold text-blue-900 mb-1">
                            {action.owner === 'sales' ? '영업' : '마케팅'} ({action.due})
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

      {/* Segment Playbooks */}
      {actionPack.segmentPlaybooks && actionPack.segmentPlaybooks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
            📋 Segment Playbooks
          </h2>
          <div className="space-y-6">
            {actionPack.segmentPlaybooks.map((playbook: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h4 className="font-bold text-slate-900 text-lg mb-2">{index + 1}. {playbook.segmentName}</h4>
                <div className="text-sm text-slate-700 space-y-3">
                  <p><strong>정의:</strong> {playbook.definition}</p>
                  <p><strong>크기:</strong> {playbook.size?.count}명 ({playbook.size?.pct}%)</p>
                  
                  {playbook.keyNeeds && playbook.keyNeeds.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">핵심 니즈:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {playbook.keyNeeds.map((need: string, needIndex: number) => (
                          <li key={needIndex}>{need}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {playbook.talkTrack && playbook.talkTrack.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">토크트랙:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {playbook.talkTrack.map((track: string, trackIndex: number) => (
                          <li key={trackIndex}>{track}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {playbook.nextBestOffer && playbook.nextBestOffer.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">제안 자료:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {playbook.nextBestOffer.map((offer: string, offerIndex: number) => (
                          <li key={offerIndex}>{offer}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {playbook.pitfalls && playbook.pitfalls.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1 text-orange-700">주의사항:</p>
                      <ul className="list-disc list-inside space-y-1 text-orange-700">
                        {playbook.pitfalls.map((pitfall: string, pitfallIndex: number) => (
                          <li key={pitfallIndex}>{pitfall}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {playbook.evidence && playbook.evidence.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">근거:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {playbook.evidence.map((ev: string, evIndex: number) => (
                          <li key={evIndex}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marketing Pack */}
      {actionPack.marketingPack && actionPack.marketingPack.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            📢 Marketing Pack
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.marketingPack.map((pack: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-slate-900 text-base sm:text-lg mb-2">{index + 1}. {pack.theme}</h4>
                <div className="text-sm text-slate-700 space-y-2">
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
      {actionPack.surveyIterationRecommendations && actionPack.surveyIterationRecommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            🔧 설문 개선 제안
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {actionPack.surveyIterationRecommendations.map((rec: any, index: number) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 md:p-5">
                <h4 className="font-bold text-slate-900 mb-2">{index + 1}. {rec.gap}</h4>
                <div className="text-sm text-slate-700 space-y-2">
                  <p><strong>중요성:</strong> {rec.whyItMatters}</p>
                  <p><strong>제안 문항:</strong> {rec.suggestedQuestion}</p>
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
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200">
            ⚠️ 데이터 품질
          </h2>
          <div className="space-y-2">
            {actionPack.dataQuality
              .filter((quality: any) => {
                // 플레이스홀더 제거
                if (typeof quality === 'string') {
                  return !quality.includes('ℹ️ 정보:') && !quality.includes('ℼ 정보:') && quality.trim().length > 0
                }
                if (quality && typeof quality === 'object' && quality.message) {
                  return !quality.message.includes('ℹ️ 정보:') && !quality.message.includes('ℼ 정보:') && quality.message.trim().length > 0
                }
                return false
              })
              .map((quality: any, index: number) => {
                // V0.9: 문자열 배열인 경우
                if (typeof quality === 'string') {
                  return (
                    <div key={index} className="p-2 sm:p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm text-blue-800">
                        {quality}
                      </p>
                    </div>
                  )
                }
                // V2: 객체 배열인 경우
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
  // 마크다운을 파싱하여 섹션별로 처리
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
      // 이전 섹션 저장
      processSection()
      // 새 섹션 시작
      currentTitle = trimmed
    } else {
      currentContent.push(line)
    }
  })

  // 마지막 섹션 처리
  processSection()

  // 섹션이 없으면 전체를 일반 렌더링
  if (sections.length === 0) {
    return <MarkdownContent content={content} isCardMode={false} />
  }

  return (
    <div>
      {sections.map((section, index) => (
        <div key={index} className={index > 0 ? 'mt-6' : ''}>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
            {section.title && (
              <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-gray-200">
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
    // 권장사항 모드: 깔끔한 카드 디자인 + ReactMarkdown으로 번호 목록 렌더링
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

      // 카테고리 추출 (설명이나 제목에서)
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
              <h4 className="font-bold text-slate-900 text-lg flex-1 pr-4">{title}</h4>
            )}
            {categoryTag && (
              <span className={`px-3 py-1 text-xs rounded ${categoryTag.bg} ${categoryTag.text} whitespace-nowrap font-medium`}>
                {categoryTag.label}
              </span>
            )}
          </div>
          <div className="text-slate-700">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="text-slate-700 mb-4 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 pl-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-slate-700 mb-4 space-y-2 pl-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-slate-700 mb-1 leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-slate-900">{children}</strong>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold text-slate-900 mt-4 mb-2">{children}</h4>
                ),
              }}
            >
              {contentWithoutTitle.trim()}
            </ReactMarkdown>
          </div>
        </div>
      )
    }

    // ### 제목으로 구분된 블록들 파싱
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
    // 주요 발견사항 카드 모드: 마크다운 렌더링 적용
    const blocks = content.split(/(?=^###\s)/m).filter((b) => b.trim())
    const cards: JSX.Element[] = []

    if (blocks.length === 0) {
      // ### 제목이 없으면 일반 단락으로 처리
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim())
      paragraphs.forEach((para, index) => {
        if (para.trim()) {
          cards.push(
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4">
              <div className="text-sm text-slate-700">
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
                      <strong className="font-bold text-slate-900">{children}</strong>
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
              {title && <h4 className="font-bold text-slate-900 text-base flex-1">{title}</h4>}
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
            <div className="text-sm text-slate-700">
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
                    <strong className="font-bold text-slate-900">{children}</strong>
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
      <div className="text-slate-700">
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <h2 className="text-xl font-bold text-slate-900 mt-6 mb-4 pb-2 border-b border-gray-200">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-bold text-slate-900 mt-5 mb-3">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-base font-semibold text-slate-900 mt-4 mb-2">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="text-slate-700 mb-4 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside text-slate-700 mb-4 space-y-2 pl-2">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside text-slate-700 mb-4 space-y-2 pl-2">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-slate-700 mb-1 leading-relaxed">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-slate-900">{children}</strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-4 bg-slate-50 py-2 rounded">
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

export default function AnalysisReportSection({ campaignId }: AnalysisReportSectionProps) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0) // 초시계 카운터 (초 단위)
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    loadReports()
  }, [campaignId])

  // 초시계 카운터 (generating이 true일 때만 작동)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (generating) {
      setElapsedTime(0) // 시작 시 0으로 초기화
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000) // 1초마다 증가
    } else {
      if (interval) {
        clearInterval(interval)
      }
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [generating])

  // 초를 분:초 형식으로 변환
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const loadReports = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/analysis/reports`)
      const result = await response.json()

      if (result.success && result.reports) {
        setReports(result.reports)
      }
    } catch (error) {
      console.error('보고서 목록 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!confirm('AI 분석 보고서를 생성하시겠습니까?\n\n이 작업은 몇 분 정도 소요될 수 있습니다.')) {
      return
    }

    const startTime = Date.now()
    setGenerating(true)
    setElapsedTime(0) // 시작 시 0으로 초기화
    
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaignId}/analysis/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lens: 'general' }),
      })

      const result = await response.json()
      const endTime = Date.now()
      const totalSeconds = Math.floor((endTime - startTime) / 1000)
      const formattedTime = formatTime(totalSeconds)

      if (!response.ok) {
        throw new Error(result.error || '보고서 생성 실패')
      }

      alert(`보고서가 성공적으로 생성되었습니다!\n\n생성 시간: ${formattedTime}`)
      loadReports()
    } catch (error: any) {
      const endTime = Date.now()
      const totalSeconds = Math.floor((endTime - startTime) / 1000)
      const formattedTime = formatTime(totalSeconds)
      console.error('보고서 생성 오류:', error)
      alert(`보고서 생성 실패: ${error.message}\n\n경과 시간: ${formattedTime}`)
    } finally {
      setGenerating(false)
      setElapsedTime(0) // 완료 시 0으로 초기화
    }
  }

  const handleViewReport = async (reportId: string) => {
    setLoadingDetail(true)
    try {
      const response = await fetch(
        `/api/event-survey/campaigns/${campaignId}/analysis/reports/${reportId}`
      )
      const result = await response.json()

      if (result.success && result.report) {
        setSelectedReport(result.report)
      } else {
        alert('보고서를 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('보고서 상세 로드 오류:', error)
      alert('보고서를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('이 보고서를 삭제하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(
        `/api/event-survey/campaigns/${campaignId}/analysis/reports/${reportId}`,
        {
          method: 'DELETE',
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '삭제 실패')
      }

      alert('보고서가 삭제되었습니다.')
      if (selectedReport?.id === reportId) {
        setSelectedReport(null)
      }
      loadReports()
    } catch (error: any) {
      console.error('보고서 삭제 오류:', error)
      alert(`삭제 실패: ${error.message}`)
    }
  }

  const handleDownloadMD = async (reportId: string) => {
    window.open(`/api/event-survey/campaigns/${campaignId}/analysis/reports/${reportId}/download.md`)
  }

  const handleTogglePublic = async (reportId: string, currentPublic: boolean) => {
    try {
      const response = await fetch(
        `/api/event-survey/campaigns/${campaignId}/analysis/reports/${reportId}/toggle-public`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isPublic: !currentPublic }),
        }
      )

      // 응답이 JSON인지 확인
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text.substring(0, 200))
        throw new Error('서버 응답 오류가 발생했습니다. 페이지를 새로고침해주세요.')
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '공개 상태 변경 실패')
      }

      // 보고서 목록 새로고침
      loadReports()
      
      // 현재 보고서가 열려있으면 업데이트
      if (selectedReport?.id === reportId) {
        const detailResponse = await fetch(
          `/api/event-survey/campaigns/${campaignId}/analysis/reports/${reportId}`
        )
        if (detailResponse.ok) {
          const detailResult = await detailResponse.json()
          if (detailResult.success && detailResult.report) {
            setSelectedReport(detailResult.report)
          }
        }
      }

      alert(`보고서가 ${!currentPublic ? '공개' : '비공개'}로 변경되었습니다.`)
    } catch (error: any) {
      console.error('공개 상태 변경 오류:', error)
      alert(`공개 상태 변경 실패: ${error.message}`)
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

          if (data.length === 0) return null
          
          return (
            <div key={question.questionId || question.id} className="bg-white p-4 rounded-lg shadow border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 line-clamp-2">{question.questionBody || question.question}</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => {
                      // 작은 비율은 라벨 숨김 (5% 미만)
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
                    formatter={(value: string, entry: any) => {
                      // 긴 텍스트는 줄임
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

  if (selectedReport) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedReport(null)}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            ← 보고서 목록으로
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleTogglePublic(selectedReport.id, selectedReport.is_public || false)}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium min-h-[44px] flex items-center justify-center ${
                selectedReport.is_public
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {selectedReport.is_public ? '✓ 공개됨' : '공개하기'}
            </button>
            <button
              onClick={() => handleDownloadMD(selectedReport.id)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium min-h-[44px] flex items-center justify-center"
            >
              MD 다운로드
            </button>
            <button
              onClick={() => handleDeleteReport(selectedReport.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium min-h-[44px] flex items-center justify-center"
            >
              삭제
            </button>
          </div>
        </div>
          {/* 고정 신뢰 문구 */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 sm:p-4 rounded-lg">
            <p className="text-sm text-slate-700 italic">
              본 보고서는 캠페인 설문 응답을 기반으로, 리서치/방법론 공개 원칙(AAPOR Transparency)과 시장조사 품질/윤리 가이드라인(ISO 20252, ICC/ESOMAR Code)을 참고하여 작성되었습니다. 또한 리드 우선순위와 후속 액션 제안은 BANT 및 MEDDIC 프레임워크 관점으로 구조화했습니다.
            </p>
          </div>

          {/* 분석 대상 요약 */}
          <div className="border-b border-slate-200 pb-4 sm:pb-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4">🎯 분석 대상</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              <div className="p-2 sm:p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">분석 시점</div>
                <div className="text-base sm:text-lg font-bold text-slate-900">
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
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">총 응답 수</div>
                <div className="text-2xl font-bold text-slate-900">
                  {selectedReport.sample_count.toLocaleString()}명
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">분석 문항 수</div>
                <div className="text-2xl font-bold text-slate-900">
                  {selectedReport.total_questions}개
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">분석 관점</div>
                <div className="text-lg font-bold text-slate-900">
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
            <div className="border-b border-slate-200 pb-4 sm:pb-6">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4">📚 관련 레퍼런스 요약</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {selectedReport.references_used.references.map((ref: any) => (
                  <div key={ref.id} className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-lg">
                    <h4 className="font-semibold text-sm text-slate-900 mb-1">{ref.title}</h4>
                    <p className="text-xs text-slate-600">{ref.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 도넛 차트 요약 */}
          {renderDonutCharts()}

        {/* AI 분석 본문 */}
        <div className="prose prose-slate max-w-none">
          {/* 새 파이프라인 (decision_pack) 또는 기존 파이프라인 (action_pack) 지원 */}
          {selectedReport.decision_pack || selectedReport.action_pack ? (
            <ActionPackRenderer actionPack={selectedReport.decision_pack || selectedReport.action_pack} />
          ) : (
            <MarkdownRenderer content={selectedReport.report_md || selectedReport.report_content_md || selectedReport.report_content_full_md} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">AI 분석 보고서</h2>
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium min-h-[44px] flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>생성 중... {formatTime(elapsedTime)}</span>
            </>
          ) : (
            '새 보고서 생성'
          )}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto mb-4"></div>
          <p className="text-slate-600">보고서 목록을 불러오는 중...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow border border-slate-200">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-lg text-slate-700 mb-4 font-semibold">아직 생성된 보고서가 없습니다</p>
          <p className="text-sm text-slate-600">위의 "새 보고서 생성" 버튼을 클릭하여 첫 번째 보고서를 생성하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-lg shadow border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
              onClick={() => handleViewReport(report.id)}
            >
              <h3 className="text-lg font-bold text-slate-900 mb-3">{report.report_title}</h3>
              <div className="text-sm text-slate-600 space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">분석 시점:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(report.analyzed_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">응답 수:</span>
                  <span className="font-semibold text-slate-900">{report.sample_count.toLocaleString()}명</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">문항 수:</span>
                  <span className="font-semibold text-slate-900">{report.total_questions}개</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">관점:</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {report.lens === 'general' ? '일반' : report.lens === 'sales' ? '영업' : '마케팅'}
                  </span>
                </div>
              </div>
              {report.summary && (
                <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">{report.summary}</p>
              )}
              {report.is_public && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                    <span>✓</span>
                    <span>공개됨</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


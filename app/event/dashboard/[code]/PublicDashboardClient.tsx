'use client'

import { useState, useEffect } from 'react'
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

export default function PublicDashboardClient({ campaign }: PublicDashboardClientProps) {
  const [loadingStats, setLoadingStats] = useState(false)
  const [questionStats, setQuestionStats] = useState<any[]>([])
  
  useEffect(() => {
    if (campaign.form_id) {
      loadQuestionStats()
    }
  }, [campaign.id, campaign.form_id])
  
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{campaign.title}</h1>
          {campaign.host && (
            <p className="text-gray-600 text-sm">주최: {campaign.host}</p>
          )}
        </div>
        
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">총 참여자</div>
            <div className="text-3xl font-bold text-gray-900">{campaign.stats?.total_completed || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">스캔 완료</div>
            <div className="text-3xl font-bold text-blue-600">{campaign.stats?.total_verified || 0}</div>
            {campaign.stats?.total_completed > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                ({((campaign.stats?.total_verified || 0) / campaign.stats.total_completed * 100).toFixed(1)}%)
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-1">경품 기록</div>
            <div className="text-3xl font-bold text-green-600">{campaign.stats?.total_prize_recorded || 0}</div>
            {campaign.stats?.total_completed > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                ({((campaign.stats?.total_prize_recorded || 0) / campaign.stats.total_completed * 100).toFixed(1)}%)
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
    </div>
  )
}


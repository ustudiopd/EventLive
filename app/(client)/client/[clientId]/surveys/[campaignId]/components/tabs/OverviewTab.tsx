'use client'

import { useState } from 'react'

interface OverviewTabProps {
  campaign: any
  onCampaignUpdate?: (campaign: any) => void
}

export default function OverviewTab({ campaign, onCampaignUpdate }: OverviewTabProps) {
  const [updating, setUpdating] = useState(false)
  
  const handleStatusChange = async (newStatus: 'draft' | 'published' | 'closed') => {
    if (!confirm(`정말 상태를 "${newStatus === 'published' ? '발행됨' : newStatus === 'closed' ? '종료됨' : '초안'}"으로 변경하시겠습니까?`)) {
      return
    }
    
    setUpdating(true)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: '상태 변경 실패' }))
        throw new Error(result.error || '상태 변경 실패')
      }
      
      const result = await response.json()
      
      if (result.success && result.campaign && onCampaignUpdate) {
        onCampaignUpdate(result.campaign)
        alert('상태가 성공적으로 변경되었습니다')
      }
    } catch (error: any) {
      console.error('상태 변경 오류:', error)
      alert(error.message || '상태 변경 중 오류가 발생했습니다')
    } finally {
      setUpdating(false)
    }
  }
  
  return (
    <div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-600 mb-2">총 완료 수</div>
          <div className="text-3xl font-bold text-purple-600">{campaign.stats?.total_completed || 0}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-600 mb-2">스캔 수</div>
          <div className="text-3xl font-bold text-blue-600">{campaign.stats?.total_verified || 0}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-600 mb-2">경품 기록 수</div>
          <div className="text-3xl font-bold text-green-600">{campaign.stats?.total_prize_recorded || 0}</div>
        </div>
      </div>
      
      {/* 캠페인 정보 */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-700">상태:</span>
          <span className={`px-3 py-1 rounded-full text-sm ${
            campaign.status === 'published' 
              ? 'bg-green-100 text-green-800' 
              : campaign.status === 'closed'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {campaign.status === 'published' ? '발행됨' : campaign.status === 'closed' ? '종료됨' : '초안'}
          </span>
          {campaign.status === 'draft' && (
            <button
              onClick={() => handleStatusChange('published')}
              disabled={updating}
              className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              발행하기
            </button>
          )}
          {campaign.status === 'published' && (
            <button
              onClick={() => handleStatusChange('closed')}
              disabled={updating}
              className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              종료하기
            </button>
          )}
          {campaign.status === 'closed' && (
            <button
              onClick={() => handleStatusChange('published')}
              disabled={updating}
              className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              재발행하기
            </button>
          )}
        </div>
        {campaign.host && (
          <div>
            <span className="font-medium text-gray-700">호스트:</span> {campaign.host}
          </div>
        )}
        {campaign.forms && (
          <div>
            <span className="font-medium text-gray-700">연결된 폼:</span> {campaign.forms.title}
          </div>
        )}
        <div>
          <span className="font-medium text-gray-700">생성일:</span>{' '}
          {new Date(campaign.created_at).toLocaleString('ko-KR')}
        </div>
        {campaign.updated_at && (
          <div>
            <span className="font-medium text-gray-700">수정일:</span>{' '}
            {new Date(campaign.updated_at).toLocaleString('ko-KR')}
          </div>
        )}
      </div>
    </div>
  )
}


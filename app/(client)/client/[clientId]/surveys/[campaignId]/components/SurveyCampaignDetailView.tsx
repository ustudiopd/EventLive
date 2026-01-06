'use client'

import { useState } from 'react'
import Link from 'next/link'
import OverviewTab from './tabs/OverviewTab'
import FormManagementTab from './tabs/FormManagementTab'
import PublicPageSettingsTab from './tabs/PublicPageSettingsTab'
import ParticipantsTab from './tabs/ParticipantsTab'
import SettingsTab from './tabs/SettingsTab'
import AnalysisGuidelineTab from './tabs/AnalysisGuidelineTab'
import AnalysisReportSection from './tabs/AnalysisReportSection'

interface SurveyCampaignDetailViewProps {
  campaign: any
  clientId: string
}

export default function SurveyCampaignDetailView({ campaign, clientId }: SurveyCampaignDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'form' | 'publicSettings' | 'participants' | 'settings' | 'guidelines' | 'analysis'>('overview')
  const [campaignData, setCampaignData] = useState(campaign)
  
  const handleCampaignUpdate = (updatedCampaign: any) => {
    setCampaignData(updatedCampaign)
  }
  
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <Link
                  href={`/client/${clientId}/surveys`}
                  className="text-blue-600 hover:text-blue-700 hover:underline text-xs sm:text-sm flex-shrink-0"
                >
                  ← 설문조사 목록으로
                </Link>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  운영 콘솔
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600 truncate">{campaignData.title}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href={`/event${campaignData.public_path}`}
                target="_blank"
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium min-h-[44px] flex items-center justify-center"
              >
                공개 페이지 보기
              </Link>
            </div>
          </div>
        </div>
        
        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="border-b border-gray-200 flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              title="개요"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">📊</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">개요</span>
            </button>
            <button
              onClick={() => setActiveTab('form')}
              title="폼 관리"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'form'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">📋</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">폼 관리</span>
            </button>
            <button
              onClick={() => setActiveTab('publicSettings')}
              title="공개페이지 설정"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'publicSettings'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">🌐</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">공개페이지 설정</span>
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              title="참여자 관리"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'participants'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">👥</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">참여자 관리</span>
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              title="AI 분석"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'analysis'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">🤖</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">AI 분석</span>
            </button>
            <button
              onClick={() => setActiveTab('guidelines')}
              title="분석 지침"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'guidelines'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">📐</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">분석 지침</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              title="설정"
              className={`px-3 sm:px-6 py-3 sm:py-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl sm:text-2xl">⚙️</span>
              <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">설정</span>
            </button>
          </div>
        </div>
        
               {/* 탭 컨텐츠 */}
               <div className="bg-white rounded-xl shadow-lg p-6">
                 {activeTab === 'overview' && (
                   <div>
                     <h2 className="text-xl font-semibold mb-4">캠페인 개요</h2>
                     <OverviewTab campaign={campaignData} onCampaignUpdate={handleCampaignUpdate} />
                   </div>
                 )}
          
          {activeTab === 'form' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">폼 관리</h2>
              <FormManagementTab 
                campaignId={campaignData.id} 
                formId={campaignData.form_id}
                publicPath={campaignData.public_path}
                onFormUpdate={handleCampaignUpdate}
              />
            </div>
          )}
          
          {activeTab === 'publicSettings' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">공개페이지 설정</h2>
              <PublicPageSettingsTab 
                campaignId={campaignData.id}
                campaign={campaignData}
                onCampaignUpdate={handleCampaignUpdate}
              />
            </div>
          )}
          
          {activeTab === 'participants' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">참여자 관리</h2>
              <ParticipantsTab campaignId={campaignData.id} entries={campaignData.entries || []} />
            </div>
          )}
          
          {activeTab === 'analysis' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">AI 분석 보고서</h2>
              <AnalysisReportSection campaignId={campaignData.id} />
            </div>
          )}
          
          {activeTab === 'guidelines' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">분석 지침 관리</h2>
              <AnalysisGuidelineTab campaignId={campaignData.id} />
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">캠페인 설정</h2>
              <SettingsTab campaign={campaignData} onCampaignUpdate={handleCampaignUpdate} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


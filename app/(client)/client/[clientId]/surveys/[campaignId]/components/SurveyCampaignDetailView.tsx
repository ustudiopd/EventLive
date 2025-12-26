'use client'

import { useState } from 'react'
import Link from 'next/link'
import OverviewTab from './tabs/OverviewTab'
import FormManagementTab from './tabs/FormManagementTab'
import PublicPageSettingsTab from './tabs/PublicPageSettingsTab'
import ParticipantsTab from './tabs/ParticipantsTab'
import SettingsTab from './tabs/SettingsTab'

interface SurveyCampaignDetailViewProps {
  campaign: any
  clientId: string
}

export default function SurveyCampaignDetailView({ campaign, clientId }: SurveyCampaignDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'form' | 'publicSettings' | 'participants' | 'settings'>('overview')
  const [campaignData, setCampaignData] = useState(campaign)
  
  const handleCampaignUpdate = (updatedCampaign: any) => {
    setCampaignData(updatedCampaign)
  }
  
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href={`/client/${clientId}/surveys`}
                  className="text-blue-600 hover:text-blue-700 hover:underline text-sm"
                >
                  ← 설문조사 목록으로
                </Link>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  운영 콘솔
                </h1>
              </div>
              <p className="text-gray-600">{campaignData.title}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/event${campaignData.public_path}`}
                target="_blank"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                공개 페이지 보기
              </Link>
            </div>
          </div>
        </div>
        
        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="border-b border-gray-200 flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📊 개요
            </button>
            <button
              onClick={() => setActiveTab('form')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'form'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 폼 관리
            </button>
            <button
              onClick={() => setActiveTab('publicSettings')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'publicSettings'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⚙️ 공개페이지 설정
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'participants'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              👥 참여자 관리
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⚙️ 설정
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


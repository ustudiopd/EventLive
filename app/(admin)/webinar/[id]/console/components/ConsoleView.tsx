'use client'

import { useState } from 'react'
import Link from 'next/link'
import QAModeration from './QAModeration'
import ChatModeration from './ChatModeration'
import FormManagement from './FormManagement'
import FileManagement from './FileManagement'
import GiveawayManagement from './GiveawayManagement'
import SettingsTab from './SettingsTab'

interface Webinar {
  id: string
  slug?: string | null
  title: string
  description?: string
  youtube_url: string
  start_time?: string | null
  end_time?: string | null
  max_participants?: number | null
  is_public: boolean
  access_policy: string
  client_id: string
  clients?: {
    id: string
    name: string
    logo_url?: string
  }
}

interface ConsoleViewProps {
  webinar: Webinar
  userRole: string
}

/**
 * 운영 콘솔 메인 컴포넌트
 * Q&A 모더레이션, 퀴즈, 추첨 등을 관리하는 운영자 전용 페이지
 */
export default function ConsoleView({ webinar, userRole }: ConsoleViewProps) {
  const [activeTab, setActiveTab] = useState<'qa' | 'chat' | 'forms' | 'files' | 'giveaways' | 'settings'>('qa')
  const [webinarData, setWebinarData] = useState(webinar)
  // slug가 있으면 slug를 사용하고, 없으면 id를 사용 (URL용)
  const webinarSlug = webinarData.slug || webinarData.id
  
  const handleWebinarUpdate = (updatedWebinar: any) => {
    setWebinarData(updatedWebinar)
  }
  
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Link 
                    href={`/webinar/${webinarSlug}`}
                    className="text-blue-600 hover:text-blue-700 hover:underline text-sm"
                  >
                    ← 시청 페이지로
                  </Link>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    운영 콘솔
                  </h1>
                </div>
                <p className="text-gray-600">{webinarData.title}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/webinar/${webinarSlug}/stats`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  📊 통계
                </Link>
                <Link
                  href={`/webinar/${webinarSlug}/live?admin=true&from=console`}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  관리자 접속
                </Link>
                {webinarData.clients?.logo_url && (
                  <img 
                    src={webinarData.clients.logo_url} 
                    alt={webinarData.clients.name}
                    className="h-12 w-auto"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div>
        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <div className="border-b border-gray-200 flex">
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'qa'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ❓ Q&A 모더레이션
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              💬 채팅 관리
            </button>
            <button
              onClick={() => setActiveTab('forms')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'forms'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 설문/퀴즈
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'files'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📎 발표자료
            </button>
            <button
              onClick={() => setActiveTab('giveaways')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'giveaways'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🎁 추첨
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
          {activeTab === 'qa' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Q&A 모더레이션</h2>
              <QAModeration webinarId={webinarData.id} />
            </div>
          )}
          
          {activeTab === 'chat' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">채팅 관리</h2>
              <ChatModeration webinarId={webinarData.id} />
            </div>
          )}
          
          {activeTab === 'forms' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">설문/퀴즈 관리</h2>
              <FormManagement webinarId={webinarData.id} />
            </div>
          )}
          
          {activeTab === 'files' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">발표자료 관리</h2>
              <FileManagement webinarId={webinarData.id} />
            </div>
          )}
          
          {activeTab === 'giveaways' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">추첨 관리</h2>
              <GiveawayManagement webinarId={webinarData.id} />
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">웨비나 설정</h2>
              <SettingsTab webinar={webinarData} onWebinarUpdate={handleWebinarUpdate} />
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}


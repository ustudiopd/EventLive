'use client'

import { useState } from 'react'
import Link from 'next/link'
import QAModeration from './QAModeration'
import ChatModeration from './ChatModeration'

interface Webinar {
  id: string
  title: string
  description?: string
  youtube_url: string
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
  const [activeTab, setActiveTab] = useState<'qa' | 'chat' | 'quiz' | 'draw'>('qa')
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link 
                  href={`/webinar/${webinar.id}`}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  ← 시청 페이지로
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">운영 콘솔</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">{webinar.title}</p>
            </div>
            {webinar.clients?.logo_url && (
              <img 
                src={webinar.clients.logo_url} 
                alt={webinar.clients.name}
                className="h-12 w-auto"
              />
            )}
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
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
              onClick={() => setActiveTab('quiz')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'quiz'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🎯 퀴즈
            </button>
            <button
              onClick={() => setActiveTab('draw')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'draw'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🎁 추첨
            </button>
          </div>
        </div>
        
        {/* 탭 컨텐츠 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {activeTab === 'qa' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Q&A 모더레이션</h2>
              <QAModeration webinarId={webinar.id} />
            </div>
          )}
          
          {activeTab === 'chat' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">채팅 관리</h2>
              <ChatModeration webinarId={webinar.id} />
            </div>
          )}
          
          {activeTab === 'quiz' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">퀴즈 관리</h2>
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-lg">퀴즈 기능은 곧 추가될 예정입니다</p>
              </div>
            </div>
          )}
          
          {activeTab === 'draw' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">추첨 관리</h2>
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-4">🎁</div>
                <p className="text-lg">추첨 기능은 곧 추가될 예정입니다</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


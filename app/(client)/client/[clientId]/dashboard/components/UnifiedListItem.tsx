'use client'

import Link from 'next/link'

interface UnifiedListItemProps {
  item: {
    type: 'webinar' | 'survey'
    id: string
    slug?: string | null
    title: string
    start_time?: string | null
    public_path?: string
    created_at: string
  }
  clientId: string
}

export default function UnifiedListItem({ item, clientId }: UnifiedListItemProps) {
  const isWebinar = item.type === 'webinar'
  const webinarSlug = isWebinar ? (item.slug || item.id) : null
  
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 text-xs font-semibold rounded ${
          isWebinar 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-purple-100 text-purple-800'
        }`}>
          {isWebinar ? '웨비나' : '설문'}
        </span>
        <div>
          <div className="font-medium text-gray-800">{item.title}</div>
          <div className="text-sm text-gray-500 mt-1">
            {isWebinar 
              ? (item.start_time ? new Date(item.start_time).toLocaleString('ko-KR') : '일정 미정')
              : (item.public_path ? `경로: ${item.public_path}` : new Date(item.created_at).toLocaleString('ko-KR'))
            }
          </div>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        {isWebinar ? (
          <>
            <Link 
              href={`/webinar/${webinarSlug}`}
              target="_blank"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              공개페이지
            </Link>
            <Link 
              href={`/webinar/${webinarSlug}/console`}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              콘솔
            </Link>
            <Link 
              href={`/webinar/${webinarSlug}/stats`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              통계
            </Link>
            <Link 
              href={`/webinar/${webinarSlug}/live?admin=true`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              관리자 접속
            </Link>
          </>
        ) : (
          <>
            <Link 
              href={`/event${item.public_path}`}
              target="_blank"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              공개페이지
            </Link>
            <Link 
              href={`/client/${clientId}/surveys/${item.id}`}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              콘솔
            </Link>
            <Link 
              href={`/client/${clientId}/surveys/${item.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              통계
            </Link>
            <Link 
              href={`/event${item.public_path}`}
              target="_blank"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              관리자 접속
            </Link>
          </>
        )}
      </div>
    </div>
  )
}


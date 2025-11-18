'use client'

import Link from 'next/link'
import ShareLinkButton from '@/components/webinar/ShareLinkButton'

interface WebinarListItemProps {
  webinar: {
    id: string
    title: string
    start_time: string | null
  }
}

export default function WebinarListItem({ webinar }: WebinarListItemProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div>
        <div className="font-medium text-gray-800">{webinar.title}</div>
        <div className="text-sm text-gray-500 mt-1">
          {webinar.start_time ? new Date(webinar.start_time).toLocaleString('ko-KR') : '일정 미정'}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <ShareLinkButton 
          webinarId={webinar.id} 
          webinarTitle={webinar.title}
          className="flex-shrink-0"
        />
        <Link 
          href={`/webinar/${webinar.id}`}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
        >
          웨비나링크
        </Link>
        <Link 
          href={`/webinar/${webinar.id}/live?admin=true`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
        >
          관리자 접속
        </Link>
      </div>
    </div>
  )
}


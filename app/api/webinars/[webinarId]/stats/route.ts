import { NextRequest, NextResponse } from 'next/server'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'

/**
 * 통합 통계 API
 * GET /api/webinars/[webinarId]/stats?sections=chat,qa,forms,...&from=&to=&interval=
 * 
 * sections: 조회할 섹션 목록 (쉼표로 구분)
 * - chat: 채팅 통계
 * - qa: Q&A 통계
 * - forms: 폼/퀴즈 통계
 * - giveaways: 추첨 통계
 * - files: 파일 통계
 * - registrants: 등록자 통계
 * - access: 접속 통계
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { searchParams } = new URL(request.url)

    // 권한 확인
    const { hasPermission, webinar } = await checkWebinarStatsPermission(webinarId)
    if (!hasPermission || !webinar) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    // sections 파라미터 파싱
    const sectionsParam = searchParams.get('sections') || 'chat,qa,forms,giveaways,files,registrants,access'
    const sections = sectionsParam.split(',').map((s) => s.trim())

    // 각 섹션별 API 호출
    const baseUrl = request.nextUrl.origin
    const statsPromises: Record<string, Promise<any>> = {}

    if (sections.includes('chat')) {
      statsPromises.chat = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/chat?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    if (sections.includes('qa')) {
      statsPromises.qa = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/qa?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    if (sections.includes('forms')) {
      statsPromises.forms = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/forms?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    if (sections.includes('giveaways')) {
      statsPromises.giveaways = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/giveaways?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    if (sections.includes('files')) {
      statsPromises.files = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/files?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    if (sections.includes('registrants')) {
      statsPromises.registrants = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/registrants?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    if (sections.includes('access')) {
      statsPromises.access = fetch(
        `${baseUrl}/api/webinars/${webinarId}/stats/access?${searchParams.toString()}`
      ).then((res) => res.json())
    }

    // 모든 섹션 병렬 조회
    const results = await Promise.allSettled(Object.values(statsPromises))
    const sectionKeys = Object.keys(statsPromises)
    const stats: Record<string, any> = {}

    results.forEach((result, index) => {
      const sectionKey = sectionKeys[index]
      if (result.status === 'fulfilled' && result.value.success) {
        stats[sectionKey] = result.value.data
      } else {
        stats[sectionKey] = null
        console.error(`[Stats] ${sectionKey} 조회 실패:`, result)
      }
    })

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error: any) {
    console.error('[Stats] 통합 통계 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





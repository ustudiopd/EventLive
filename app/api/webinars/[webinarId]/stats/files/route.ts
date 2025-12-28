import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { checkWebinarStatsPermission } from '@/lib/stats/permissions'
import { parseStatsParams } from '@/lib/stats/utils'

/**
 * 파일 통계 API
 * GET /api/webinars/[webinarId]/stats/files?from=&to=&interval=
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

    const admin = createAdminSupabase()

    // 웨비나 정보 조회
    const { data: webinarInfo } = await admin
      .from('webinars')
      .select('start_time, end_time')
      .eq('id', webinarId)
      .single()

    // 쿼리 파라미터 파싱
    const { from, to } = parseStatsParams(
      searchParams,
      webinarInfo?.start_time,
      webinarInfo?.end_time
    )

    // 기본 파일 수
    const { count: totalFiles } = await admin
      .from('webinar_files')
      .select('*', { count: 'exact', head: true })
      .eq('webinar_id', webinarId)

    // 다운로드 요약
    const { data: downloads } = await admin
      .from('webinar_downloads')
      .select('id, user_id, file_id')
      .eq('webinar_id', webinarId)
      .gte('downloaded_at', from.toISOString())
      .lt('downloaded_at', to.toISOString())

    const totalDownloads = downloads?.length || 0
    const uniqueDownloaders = new Set(downloads?.map((d) => d.user_id)).size

    // 파일별 다운로드
    const fileDownloadCounts = new Map<number, number>()
    downloads?.forEach((d) => {
      fileDownloadCounts.set(d.file_id, (fileDownloadCounts.get(d.file_id) || 0) + 1)
    })

    const fileIds = Array.from(fileDownloadCounts.keys())
    const { data: files } =
      fileIds.length > 0
        ? await admin
            .from('webinar_files')
            .select('id, file_name, file_size')
            .in('id', fileIds)
        : { data: null }

    const fileDownloads = (files || [])
      .map((file) => ({
        file_id: file.id,
        file_name: file.file_name,
        file_size: file.file_size,
        download_count: fileDownloadCounts.get(file.id) || 0,
      }))
      .sort((a, b) => b.download_count - a.download_count)

    return NextResponse.json({
      success: true,
      data: {
        totalFiles: totalFiles || 0,
        totalDownloads,
        uniqueDownloaders,
        fileDownloads,
      },
    })
  } catch (error: any) {
    console.error('[Stats Files] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '통계 조회 실패' },
      { status: 500 }
    )
  }
}





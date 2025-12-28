import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getWebinarQuery } from '@/lib/utils/webinar'

export const runtime = 'nodejs'

/**
 * 웨비나의 Workspace 정보 조회 (client_id, agency_id 포함)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const admin = createAdminSupabase()

    // UUID 또는 slug로 웨비나 조회
    const query = getWebinarQuery(webinarId)

    // 웨비나 정보 조회 (client_id, agency_id 포함)
    const { data: webinar, error } = await admin
      .from('webinars')
      .select(`
        id,
        title,
        slug,
        client_id,
        clients:client_id (
          id,
          name,
          agency_id,
          agencies:agency_id (
            id,
            name
          )
        )
      `)
      .eq(query.column, query.value)
      .single()

    if (error || !webinar) {
      return NextResponse.json(
        { error: '웨비나를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const client = Array.isArray(webinar.clients) ? webinar.clients[0] : webinar.clients
    const agency = client?.agencies
    const agencyData = Array.isArray(agency) ? agency[0] : agency

    return NextResponse.json({
      webinar: {
        id: webinar.id,
        title: webinar.title,
        slug: webinar.slug,
      },
      client: client
        ? {
            id: client.id,
            name: client.name,
          }
        : null,
      agency: agencyData
        ? {
            id: agencyData.id,
            name: agencyData.name,
          }
        : null,
    })
  } catch (error: any) {
    console.error('Workspace 정보 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}





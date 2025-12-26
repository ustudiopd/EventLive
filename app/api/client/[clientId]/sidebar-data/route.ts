import { NextResponse } from 'next/server'
import { requireClientMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 클라이언트 사이드바 데이터 조회
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params
    await requireClientMember(clientId)
    const supabase = await createServerSupabase()

    const admin = createAdminSupabase()

    // 클라이언트 정보
    const { data: client } = await admin
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single()

    // 클라이언트 이름으로 웨비나/설문조사 구분
    // "HPE" 또는 "hpe"로 시작하는 클라이언트는 설문조사, 나머지는 웨비나
    const isSurveyClient = client?.name?.toLowerCase().includes('hpe') || false

    let events: any[] = []

    if (isSurveyClient) {
      // 설문조사 캠페인 목록 (최근 20개)
      const { data: campaigns } = await admin
        .from('event_survey_campaigns')
        .select('id, title, public_path, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20)

      events = (campaigns || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        slug: c.public_path, // 설문조사는 public_path를 slug로 사용
        type: 'survey',
      }))
    } else {
      // 웨비나 목록 (최근 20개)
      const { data: webinars } = await admin
        .from('webinars')
        .select('id, title, slug, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20)

      events = (webinars || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        slug: w.slug,
        type: 'webinar',
      }))
    }

    return NextResponse.json({
      workspace: {
        mode: 'client',
        currentClient: client ? { id: client.id, name: client.name } : null,
        events,
      },
    })
  } catch (error: any) {
    console.error('클라이언트 사이드바 데이터 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


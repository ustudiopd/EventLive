import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const agencyId = searchParams.get('agencyId')
    const clientId = searchParams.get('clientId')
    
    if (!agencyId) {
      return NextResponse.json(
        { error: 'agencyId is required' },
        { status: 400 }
      )
    }
    
    // 권한 확인
    await requireAgencyMember(agencyId)
    
    const supabase = await createServerSupabase()
    
    // 통계 조회
    let webinarQuery = supabase
      .from('webinars')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
    
    if (clientId) {
      webinarQuery = webinarQuery.eq('client_id', clientId)
    }
    
    const { count: webinarCount } = await webinarQuery
    
    // 웨비나 ID 목록 조회
    let webinarsQuery = supabase
      .from('webinars')
      .select('id')
      .eq('agency_id', agencyId)
    
    if (clientId) {
      webinarsQuery = webinarsQuery.eq('client_id', clientId)
    }
    
    const { data: webinars } = await webinarsQuery
    const webinarIds = webinars?.map(w => w.id) || []
    
    // 메시지 수
    let messagesQuery = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
    
    if (clientId) {
      messagesQuery = messagesQuery.eq('client_id', clientId)
    }
    
    const { count: totalMessages } = await messagesQuery
    
    // 질문 수
    let questionsQuery = supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
    
    if (clientId) {
      questionsQuery = questionsQuery.eq('client_id', clientId)
    }
    
    const { count: totalQuestions } = await questionsQuery
    
    // 참여자 수 (고유 사용자 수)
    let totalParticipants = 0
    if (webinarIds.length > 0) {
      const { data: registrations } = await supabase
        .from('registrations')
        .select('user_id')
        .in('webinar_id', webinarIds)
      
      // 고유 사용자 수 계산
      const uniqueUsers = new Set(registrations?.map(r => r.user_id) || [])
      totalParticipants = uniqueUsers.size
    }
    
    return NextResponse.json({
      webinarCount: webinarCount || 0,
      totalParticipants: totalParticipants || 0,
      totalMessages: totalMessages || 0,
      totalQuestions: totalQuestions || 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


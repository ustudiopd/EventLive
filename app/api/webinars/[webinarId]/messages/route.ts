import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 웨비나 메시지 목록 조회 (프로필 정보 포함)
 * 같은 웨비나에 등록된 사용자는 모두 조회 가능
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { searchParams } = new URL(req.url)
    const afterId = searchParams.get('after') // 증분 폴링을 위한 파라미터
    
    const { user } = await requireAuth()
    const admin = createAdminSupabase()
    
    // 웨비나 존재 확인
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 사용자가 웨비나에 등록되어 있는지 확인
    const { data: registration } = await admin
      .from('registrations')
      .select('webinar_id, user_id')
      .eq('webinar_id', webinarId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    // 등록되어 있지 않으면 자동 등록
    if (!registration) {
      const { error: regError } = await admin
        .from('registrations')
        .insert({
          webinar_id: webinarId,
          user_id: user.id,
          role: 'attendee',
        })
      
      // 이미 등록된 경우 무시 (에러는 로깅하지 않음)
      if (regError && !regError.message.includes('duplicate')) {
        console.warn('웨비나 자동 등록 실패:', regError)
      }
    }
    
    // 메시지 조회 쿼리 구성
    let query = admin
      .from('messages')
      .select(`
        id,
        user_id,
        content,
        created_at,
        hidden,
        client_msg_id,
        profiles:user_id (
          display_name,
          email
        )
      `)
      .eq('webinar_id', webinarId)
      .eq('hidden', false)
    
    // 증분 폴링: afterId가 있으면 해당 ID 이후 메시지만 조회
    if (afterId) {
      const afterIdNum = parseInt(afterId, 10)
      if (!isNaN(afterIdNum)) {
        query = query.gt('id', afterIdNum)
      }
    }
    
    query = query
      .order('created_at', { ascending: false })
      .limit(100)
    
    const { data: messages, error: messagesError } = await query
    
    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      messages: (messages || []).reverse().map((msg: any) => ({
        id: msg.id,
        user_id: msg.user_id,
        content: msg.content,
        created_at: msg.created_at,
        hidden: msg.hidden,
        client_msg_id: msg.client_msg_id,
        user: msg.profiles || null,
      }))
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


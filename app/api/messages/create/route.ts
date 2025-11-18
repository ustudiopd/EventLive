import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { broadcastChatMessage } from '@/lib/webinar/broadcast'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { webinarId, content, clientMsgId } = await req.json()
    
    if (!webinarId || !content) {
      return NextResponse.json(
        { success: false, error: 'webinarId and content are required' },
        { status: 400 }
      )
    }
    
    // clientMsgId 검증 (UUID 형식)
    if (clientMsgId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientMsgId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid client_msg_id format' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // 웨비나 정보 조회 (agency_id, client_id 가져오기)
    const admin = createAdminSupabase()
    const { data: webinar } = await admin
      .from('webinars')
      .select('agency_id, client_id')
      .eq('id', webinarId)
      .single()
    
    if (!webinar) {
      return NextResponse.json(
        { success: false, error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 메시지 내용 검증
    const trimmedContent = content.trim()
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message content must be between 1 and 500 characters' },
        { status: 400 }
      )
    }
    
    // 메시지 생성 (client_msg_id 포함)
    const { data: message, error: messageError } = await admin
      .from('messages')
      .insert({
        agency_id: webinar.agency_id,
        client_id: webinar.client_id,
        webinar_id: webinarId,
        user_id: user.id,
        content: trimmedContent,
        client_msg_id: clientMsgId || null,
      })
      .select('id, webinar_id, user_id, content, created_at, hidden, client_msg_id')
      .single()
    
    if (messageError) {
      // 중복 client_msg_id 에러 처리
      if (messageError.code === '23505' && messageError.message.includes('messages_client_msg_unique')) {
        return NextResponse.json(
          { success: false, error: 'Duplicate message detected' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: messageError.message },
        { status: 500 }
      )
    }
    
    // Phase 2: DB insert 성공 후 Broadcast 전파
    // 프로필 정보를 포함한 메시지 payload 생성
    const messagePayload = {
      id: message.id,
      webinar_id: message.webinar_id,
      user_id: message.user_id,
      content: message.content,
      created_at: message.created_at,
      hidden: message.hidden ?? false,
      client_msg_id: message.client_msg_id || undefined,
    }
    
    // Broadcast 전파 (비동기, 실패해도 응답은 성공)
    broadcastChatMessage(webinarId, messagePayload, user.id, clientMsgId || undefined)
      .catch((error) => {
        console.error('Broadcast 전파 실패 (응답은 성공):', error)
        // Broadcast 실패해도 DB insert는 성공했으므로 응답은 성공
      })
    
    // 성공 응답 (일관된 스키마)
    return NextResponse.json({ 
      success: true, 
      message 
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


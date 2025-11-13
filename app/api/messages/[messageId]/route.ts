import { NextResponse } from 'next/server'
import { requireClientMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// 메시지 숨김/표시
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const { hidden } = await req.json()
    
    const admin = createAdminSupabase()
    
    // 메시지 정보 조회
    const { data: message } = await admin
      .from('messages')
      .select('webinar_id, client_id')
      .eq('id', messageId)
      .single()
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 정보 조회
    const { data: webinar } = await admin
      .from('webinars')
      .select('client_id')
      .eq('id', message.webinar_id)
      .single()
    
    if (!webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인 (operator 이상)
    const { user, role } = await requireClientMember(webinar.client_id, ['owner', 'admin', 'operator'])
    
    if (role === 'viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 메시지 상태 업데이트
    const { data: updatedMessage, error: updateError } = await admin
      .from('messages')
      .update({ hidden: hidden ?? true })
      .eq('id', messageId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: updatedMessage.agency_id,
        client_id: updatedMessage.client_id,
        webinar_id: updatedMessage.webinar_id,
        action: 'MESSAGE_UPDATE',
        payload: { messageId, hidden }
      })
    
    return NextResponse.json({ success: true, message: updatedMessage })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// 메시지 삭제 (숨김 처리)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    
    const admin = createAdminSupabase()
    
    // 메시지 정보 조회
    const { data: message } = await admin
      .from('messages')
      .select('webinar_id, client_id, agency_id')
      .eq('id', messageId)
      .single()
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 정보 조회
    const { data: webinar } = await admin
      .from('webinars')
      .select('client_id')
      .eq('id', message.webinar_id)
      .single()
    
    if (!webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인 (operator 이상)
    const { user, role } = await requireClientMember(webinar.client_id, ['owner', 'admin', 'operator'])
    
    if (role === 'viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 메시지 숨김 처리
    const { error: updateError } = await admin
      .from('messages')
      .update({ hidden: true })
      .eq('id', messageId)
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: message.agency_id,
        client_id: message.client_id,
        webinar_id: message.webinar_id,
        action: 'MESSAGE_DELETE',
        payload: { messageId }
      })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


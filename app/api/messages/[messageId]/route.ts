import { NextResponse } from 'next/server'
import { requireClientMember, requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { broadcastChatUpdate, broadcastChatDelete } from '@/lib/webinar/broadcast'

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
    const { data: webinarRaw } = await admin
      .from('webinars')
      .select('client_id, agency_id')
      .eq('id', message.webinar_id)
      .single()
    
    if (!webinarRaw) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 타입 단언
    const webinar = webinarRaw as { client_id: string; agency_id: string | null }
    
    // 권한 확인 (슈퍼 관리자, 에이전시 멤버, 클라이언트 멤버)
    const supabase = await createServerSupabase()
    const { user } = await requireAuth()
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    // 1. 슈퍼 관리자 확인
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 2. 클라이언트 멤버십 확인 (owner/admin/operator)
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', webinar.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 3. 에이전시 멤버십 확인 (owner/admin)
        if (webinar.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', webinar.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()
          
          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }
    
    if (!hasPermission) {
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
      .select('id, webinar_id, user_id, content, created_at, hidden, client_msg_id, agency_id, client_id')
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
    
    // Phase 2: DB update 성공 후 Broadcast 전파
    const messagePayload = {
      id: updatedMessage.id,
      webinar_id: updatedMessage.webinar_id,
      user_id: updatedMessage.user_id,
      content: updatedMessage.content,
      created_at: updatedMessage.created_at,
      hidden: updatedMessage.hidden ?? false,
      client_msg_id: updatedMessage.client_msg_id || undefined,
    }
    
    broadcastChatUpdate(message.webinar_id, messagePayload, user.id)
      .catch((error) => {
        console.error('Broadcast 전파 실패 (응답은 성공):', error)
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
    const { data: webinarRaw } = await admin
      .from('webinars')
      .select('client_id, agency_id')
      .eq('id', message.webinar_id)
      .single()
    
    if (!webinarRaw) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 타입 단언
    const webinar = webinarRaw as { client_id: string; agency_id: string | null }
    
    // 권한 확인 (슈퍼 관리자, 에이전시 멤버, 클라이언트 멤버)
    const supabase = await createServerSupabase()
    const { user } = await requireAuth()
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    // 1. 슈퍼 관리자 확인
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 2. 클라이언트 멤버십 확인 (owner/admin/operator)
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', webinar.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 3. 에이전시 멤버십 확인 (owner/admin)
        if (webinar.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', webinar.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()
          
          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }
    
    if (!hasPermission) {
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
    
    // Phase 2: DB delete 성공 후 Broadcast 전파
    broadcastChatDelete(message.webinar_id, parseInt(messageId), user.id)
      .catch((error) => {
        console.error('Broadcast 전파 실패 (응답은 성공):', error)
      })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


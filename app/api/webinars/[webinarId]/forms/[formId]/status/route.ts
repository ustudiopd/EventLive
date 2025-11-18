import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { broadcastQuizOpen, broadcastQuizClose, broadcastPollOpen, broadcastPollClose } from '@/lib/webinar/broadcast'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ webinarId: string; formId: string }> }
) {
  try {
    const { webinarId, formId } = await params
    const { status } = await req.json()
    
    if (!status || !['draft', 'open', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be draft, open, or closed' },
        { status: 400 }
      )
    }
    
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    
    // 폼 조회
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('webinar_id', webinarId)
      .single()
    
    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인 (클라이언트 operator 이상 또는 에이전시 owner/admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', form.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 에이전시 멤버십 확인 (owner/admin만 상태 변경 가능)
        if (form.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', form.agency_id)
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
    
    // 상태 변경
    const updateData: any = { status }
    
    if (status === 'open') {
      updateData.opened_at = new Date().toISOString()
    } else if (status === 'closed') {
      updateData.closed_at = new Date().toISOString()
    }
    
    const { data: updatedForm, error: updateError } = await admin
      .from('forms')
      .update(updateData)
      .eq('id', formId)
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
        agency_id: form.agency_id,
        client_id: form.client_id,
        webinar_id: webinarId,
        action: 'FORM_STATUS_CHANGE',
        payload: { form_id: formId, status },
      })
    
    // Phase 3: DB update 성공 후 Broadcast 전파
    if (status === 'open') {
      if (form.kind === 'quiz') {
        broadcastQuizOpen(webinarId, updatedForm, user.id)
          .catch((error) => console.error('Broadcast 전파 실패:', error))
      } else {
        broadcastPollOpen(webinarId, updatedForm, user.id)
          .catch((error) => console.error('Broadcast 전파 실패:', error))
      }
    } else if (status === 'closed') {
      if (form.kind === 'quiz') {
        broadcastQuizClose(webinarId, updatedForm, user.id)
          .catch((error) => console.error('Broadcast 전파 실패:', error))
      } else {
        broadcastPollClose(webinarId, updatedForm, user.id)
          .catch((error) => console.error('Broadcast 전파 실패:', error))
      }
    }
    
    return NextResponse.json({ success: true, form: updatedForm })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


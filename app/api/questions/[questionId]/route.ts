import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// 질문 상태 업데이트 (고정/답변/숨김)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params
    const { status, answeredBy, answer, content } = await req.json()
    
    const admin = createAdminSupabase()
    const supabase = await createServerSupabase()
    const { user } = await requireAuth()
    
    // 질문 정보 조회
    const { data: question } = await admin
      .from('questions')
      .select('webinar_id, client_id, agency_id, user_id')
      .eq('id', questionId)
      .single()
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 정보 조회
    const { data: webinarRaw } = await admin
      .from('webinars')
      .select('client_id, agency_id')
      .eq('id', question.webinar_id)
      .single()
    
    if (!webinarRaw) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 타입 단언
    const webinar = webinarRaw as { client_id: string; agency_id: string | null }
    
    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    let isOwner = false // 질문 작성자 여부
    
    // 질문 작성자인지 확인
    if (question.user_id === user.id) {
      isOwner = true
    }
    
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
    
    // content 수정은 질문 작성자만 가능
    if (content !== undefined) {
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only question owner can edit content' },
          { status: 403 }
        )
      }
    }
    
    // status/answer 수정은 관리자만 가능
    if (status !== undefined || answer !== undefined) {
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }
    
    // 둘 다 없으면 에러
    if (status === undefined && content === undefined && answer === undefined) {
      return NextResponse.json(
        { error: 'status, content, or answer is required' },
        { status: 400 }
      )
    }
    
    // 상태 업데이트
    const updateData: any = {}
    
    if (status !== undefined) {
      updateData.status = status
    }
    
    if (content !== undefined) {
      updateData.content = content.trim()
    }
    
    if (status === 'answered' && answeredBy) {
      updateData.answered_by = answeredBy
      updateData.answered_at = new Date().toISOString()
      if (answer) {
        updateData.answer = answer
      }
    }
    
    const { data: updatedQuestion, error: updateError } = await admin
      .from('questions')
      .update(updateData)
      .eq('id', questionId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그 (에러 무시)
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: question.agency_id,
          client_id: question.client_id,
          webinar_id: question.webinar_id,
          action: 'QUESTION_UPDATE',
          payload: { questionId, status }
        })
    } catch (auditError) {
      // 감사 로그 실패는 무시 (선택적 기능)
      console.warn('감사 로그 기록 실패:', auditError)
    }
    
    return NextResponse.json({ success: true, question: updatedQuestion })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// 질문 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params
    
    const admin = createAdminSupabase()
    
    // 질문 정보 조회
    const { data: question } = await admin
      .from('questions')
      .select('webinar_id, client_id, agency_id, user_id')
      .eq('id', questionId)
      .single()
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 정보 조회
    const { data: webinarRaw } = await admin
      .from('webinars')
      .select('client_id, agency_id')
      .eq('id', question.webinar_id)
      .single()
    
    if (!webinarRaw) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 타입 단언
    const webinar = webinarRaw as { client_id: string; agency_id: string | null }
    
    // 권한 확인 (슈퍼 관리자, 에이전시 멤버, 클라이언트 멤버, 또는 질문 작성자)
    const supabase = await createServerSupabase()
    const { user } = await requireAuth()
    
    // 질문 작성자인지 확인
    const isOwner = question.user_id === user.id
    
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
      // 2. 클라이언트 멤버십 확인 (owner/admin)
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', webinar.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin'].includes(clientMember.role)) {
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
    
    // 관리자 또는 질문 작성자만 삭제 가능
    if (!hasPermission && !isOwner) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 질문 삭제 (실제로는 숨김 처리)
    const { error: deleteError } = await admin
      .from('questions')
      .update({ status: 'hidden' })
      .eq('id', questionId)
    
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그 (에러 무시)
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: question.agency_id,
          client_id: question.client_id,
          webinar_id: question.webinar_id,
          action: 'QUESTION_DELETE',
          payload: { questionId }
        })
    } catch (auditError) {
      // 감사 로그 실패는 무시 (선택적 기능)
      console.warn('감사 로그 기록 실패:', auditError)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { requireClientMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// 질문 상태 업데이트 (고정/답변/숨김)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params
    const { status, answeredBy } = await req.json()
    
    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 질문 정보 조회
    const { data: question } = await admin
      .from('questions')
      .select('webinar_id, client_id, agency_id')
      .eq('id', questionId)
      .single()
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 정보 조회
    const { data: webinar } = await admin
      .from('webinars')
      .select('client_id')
      .eq('id', question.webinar_id)
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
    
    // 상태 업데이트
    const updateData: any = { status }
    
    if (status === 'answered' && answeredBy) {
      updateData.answered_by = answeredBy
      updateData.answered_at = new Date().toISOString()
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
    
    // 감사 로그
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
      .select('webinar_id, client_id, agency_id')
      .eq('id', questionId)
      .single()
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 정보 조회
    const { data: webinar } = await admin
      .from('webinars')
      .select('client_id')
      .eq('id', question.webinar_id)
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
    
    // 감사 로그
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
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


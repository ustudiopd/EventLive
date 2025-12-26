import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * 설문조사 캠페인 폼 조회 (공개 API)
 * GET /api/event-survey/campaigns/[campaignId]/forms/[formId]
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; formId: string }> }
) {
  try {
    const { campaignId, formId } = await params
    
    const admin = createAdminSupabase()
    
    // 폼 조회 (campaign_id로 연결)
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('campaign_id', campaignId)
      .single()
    
    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
    
    // 문항 조회
    const { data: questions, error: questionsError } = await admin
      .from('form_questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_no', { ascending: true })
    
    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      )
    }
    
    // options를 파싱 (JSON 문자열인 경우)
    const parsedQuestions = questions.map((q: any) => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    }))
    
    return NextResponse.json({
      form: {
        ...form,
        questions: parsedQuestions,
      },
    })
  } catch (error: any) {
    console.error('폼 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 설문조사 캠페인 폼 수정
 * PUT /api/event-survey/campaigns/[campaignId]/forms/[formId]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; formId: string }> }
) {
  try {
    const { campaignId, formId } = await params
    const { title, description, questions, config } = await req.json()
    
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    
    // 폼 조회
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('campaign_id', campaignId)
      .single()
    
    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', form.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 폼 수정
    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (config !== undefined) updateData.config = config
    
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
    
    // 문항 수정 (있는 경우)
    if (questions && Array.isArray(questions)) {
      // 기존 문항 삭제
      await admin.from('form_questions').delete().eq('form_id', formId)
      
      // 새 문항 생성
      const questionRows = questions.map((q: any, index: number) => ({
        form_id: formId,
        order_no: index + 1,
        type: q.type,
        body: q.body.trim(),
        options: q.options ? JSON.stringify(q.options) : null,
      }))
      
      const { data: createdQuestions, error: questionsError } = await admin
        .from('form_questions')
        .insert(questionRows)
        .select()
      
      if (questionsError) {
        return NextResponse.json(
          { error: questionsError.message },
          { status: 500 }
        )
      }
      
      updatedForm.questions = createdQuestions
    }
    
    // 감사 로그
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: form.agency_id,
          client_id: form.client_id,
          action: 'FORM_UPDATE',
          payload: { form_id: formId, campaign_id: campaignId },
        })
    } catch (auditError) {
      console.warn('감사 로그 생성 실패:', auditError)
    }
    
    return NextResponse.json({ success: true, form: updatedForm })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

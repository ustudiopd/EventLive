import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// 웨비나 수정
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const {
      title,
      description,
      youtubeUrl,
      startTime,
      endTime,
      maxParticipants,
      isPublic,
      accessPolicy,
      allowedEmails
    } = await req.json()
    
    const admin = createAdminSupabase()
    
    // 웨비나 정보 조회
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('client_id, agency_id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    
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
        .eq('client_id', webinar.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 에이전시 멤버십 확인 (owner/admin만 허용)
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
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 웨비나 수정
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (youtubeUrl !== undefined) updateData.youtube_url = youtubeUrl
    if (startTime !== undefined) updateData.start_time = startTime || null
    if (endTime !== undefined) updateData.end_time = endTime || null
    if (maxParticipants !== undefined) updateData.max_participants = maxParticipants || null
    if (isPublic !== undefined) updateData.is_public = isPublic
    if (accessPolicy !== undefined) updateData.access_policy = accessPolicy
    
    const { data: updatedWebinar, error: updateError } = await admin
      .from('webinars')
      .update(updateData)
      .eq('id', webinarId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // email_auth 정책인 경우 허용된 이메일 목록 업데이트
    if (accessPolicy !== undefined) {
      if (accessPolicy === 'email_auth' && allowedEmails && Array.isArray(allowedEmails)) {
        // 기존 이메일 목록 삭제
        await admin
          .from('webinar_allowed_emails')
          .delete()
          .eq('webinar_id', webinarId)
        
        // 새 이메일 목록 추가
        const emailsToInsert = allowedEmails
          .map((email: string) => email.trim().toLowerCase())
          .filter((email: string) => email && email.includes('@'))
          .map((email: string) => ({
            webinar_id: webinarId,
            email,
            created_by: user.id,
          }))
        
        if (emailsToInsert.length > 0) {
          const { error: emailsError } = await admin
            .from('webinar_allowed_emails')
            .insert(emailsToInsert)
          
          if (emailsError) {
            console.error('허용된 이메일 저장 오류:', emailsError)
          }
        }
      } else if (accessPolicy !== 'email_auth') {
        // email_auth가 아닌 정책으로 변경 시 기존 이메일 목록 삭제
        await admin
          .from('webinar_allowed_emails')
          .delete()
          .eq('webinar_id', webinarId)
      }
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: updatedWebinar.agency_id,
        client_id: updatedWebinar.client_id,
        webinar_id: updatedWebinar.id,
        action: 'WEBINAR_UPDATE',
        payload: updateData
      })
    
    return NextResponse.json({ success: true, webinar: updatedWebinar })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// 웨비나 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    
    const admin = createAdminSupabase()
    
    // 웨비나 정보 조회
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('client_id, agency_id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인 (owner/admin만 삭제 가능)
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    
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
        .eq('client_id', webinar.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 에이전시 멤버십 확인 (owner/admin만 허용)
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
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete webinars' },
        { status: 403 }
      )
    }
    
    // 웨비나 삭제
    const { error: deleteError } = await admin
      .from('webinars')
      .delete()
      .eq('id', webinarId)
    
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
        agency_id: webinar.agency_id,
        client_id: webinar.client_id,
        webinar_id: webinarId,
        action: 'WEBINAR_DELETE',
        payload: { webinarId }
      })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


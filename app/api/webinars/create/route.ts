import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('웨비나 생성 API 요청:', body)
    
    const { 
      clientId,
      title,
      description,
      youtubeUrl,
      startTime,
      endTime,
      maxParticipants,
      isPublic,
      accessPolicy
    } = body
    
    if (!clientId || !title || !youtubeUrl) {
      console.error('필수 필드 누락:', { clientId, title, youtubeUrl })
      return NextResponse.json(
        { error: 'clientId, title, and youtubeUrl are required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 클라이언트 정보 조회 (agency_id 가져오기)
    const { data: client, error: clientError } = await admin
      .from('clients')
      .select('agency_id')
      .eq('id', clientId)
      .single()
    
    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
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
    
    // 슈퍼 관리자는 항상 허용
    if (profile?.is_super_admin) {
      // 계속 진행
    } else {
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', clientId)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        // 클라이언트 멤버 (owner/admin/operator)는 허용
      } else {
        // 에이전시 멤버십 확인 (owner/admin만 허용)
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('role')
          .eq('agency_id', client.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (!agencyMember || !['owner', 'admin'].includes(agencyMember.role)) {
          return NextResponse.json(
            { error: 'Insufficient permissions to create webinars' },
            { status: 403 }
          )
        }
      }
    }
    
    // YouTube URL 검증 (간단한 형식 체크)
    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
    if (!youtubeUrlPattern.test(youtubeUrl)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      )
    }
    
    // 웨비나 생성
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .insert({
        agency_id: client.agency_id,
        client_id: clientId,
        title,
        description: description || null,
        youtube_url: youtubeUrl,
        start_time: startTime || null,
        end_time: endTime || null,
        max_participants: maxParticipants || null,
        is_public: isPublic ?? false,
        access_policy: accessPolicy || 'auth',
        created_by: user.id,
      })
      .select()
      .single()
    
    if (webinarError) {
      console.error('웨비나 생성 DB 오류:', webinarError)
      return NextResponse.json(
        { error: webinarError.message || '웨비나 생성에 실패했습니다' },
        { status: 500 }
      )
    }
    
    console.log('웨비나 생성 성공:', webinar.id)
    
    // 감사 로그 (실패해도 웨비나 생성은 성공으로 처리)
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: client.agency_id,
          client_id: clientId,
          webinar_id: webinar.id,
          action: 'WEBINAR_CREATE',
          payload: { title, youtubeUrl }
        })
    } catch (auditError) {
      console.warn('감사 로그 생성 실패:', auditError)
      // 감사 로그 실패는 무시하고 계속 진행
    }
    
    return NextResponse.json({ success: true, webinar })
  } catch (error: any) {
    console.error('웨비나 생성 API 전체 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


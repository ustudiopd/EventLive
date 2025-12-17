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
      accessPolicy,
      allowedEmails
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
    
    // slug 자동 생성 (데이터베이스 함수 사용)
    const { data: slugResult, error: slugError } = await admin
      .rpc('generate_slug_from_title', { title })
    
    let slug = slugResult as string | null
    if (slugError || !slug) {
      console.warn('slug 생성 실패, 수동 생성 시도:', slugError)
      // 수동으로 slug 생성 (간단한 버전)
      slug = title
        .toLowerCase()
        .replace(/[^가-힣a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100)
        .replace(/^-+|-+$/g, '')
      
      if (!slug) {
        slug = 'webinar-' + Date.now().toString(36)
      }
      
      // 중복 체크 및 숫자 추가
      let finalSlug = slug
      let counter = 0
      while (true) {
        const { data: existing } = await admin
          .from('webinars')
          .select('id')
          .eq('slug', finalSlug)
          .maybeSingle()
        
        if (!existing) break
        
        counter++
        finalSlug = slug + '-' + counter
        if (counter > 1000) {
          finalSlug = slug + '-' + Date.now().toString(36)
          break
        }
      }
      slug = finalSlug
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
        slug,
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
    
    console.log('웨비나 생성 성공:', webinar.id, 'slug:', webinar.slug)
    
    // email_auth 정책인 경우 허용된 이메일 목록 저장
    if (accessPolicy === 'email_auth' && allowedEmails && Array.isArray(allowedEmails)) {
      const emailsToInsert = allowedEmails
        .map((email: string) => email.trim().toLowerCase())
        .filter((email: string) => email && email.includes('@'))
        .map((email: string) => ({
          webinar_id: webinar.id,
          email,
          created_by: user.id,
        }))
      
      if (emailsToInsert.length > 0) {
        const { error: emailsError } = await admin
          .from('webinar_allowed_emails')
          .insert(emailsToInsert)
        
        if (emailsError) {
          console.error('허용된 이메일 저장 오류:', emailsError)
          // 이메일 저장 실패는 경고만 하고 웨비나 생성은 성공으로 처리
        }
      }
    }
    
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


import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * 6자리 숫자로 고유한 public_path 생성
 * 짧은 링크 시스템과 동일한 방식
 */
async function generateUniquePublicPath(
  admin: ReturnType<typeof createAdminSupabase>,
  clientId: string
): Promise<string | null> {
  let attempts = 0
  const maxAttempts = 100
  
  while (attempts < maxAttempts) {
    // 100000 ~ 999999 범위의 6자리 숫자 생성
    const code = Math.floor(Math.random() * 900000 + 100000).toString().padStart(6, '0')
    const publicPath = `/${code}`
    
    // 중복 체크 (같은 client_id 내에서)
    const { data: existingCampaign } = await admin
      .from('event_survey_campaigns')
      .select('id')
      .eq('client_id', clientId)
      .eq('public_path', publicPath)
      .maybeSingle()
    
    if (!existingCampaign) {
      return publicPath
    }
    
    attempts++
  }
  
  // 최대 시도 횟수 초과
  console.error('public_path 자동 생성 실패: 최대 시도 횟수 초과')
  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('설문조사 캠페인 생성 API 요청:', body)
    
    const { 
      clientId,
      title,
      host,
      publicPath, // 선택사항: 제공되면 사용, 없으면 자동 생성
      status = 'draft',
      formId,
      welcomeSchema,
      completionSchema,
      displaySchema,
    } = body
    
    if (!clientId || !title) {
      console.error('필수 필드 누락:', { clientId, title })
      return NextResponse.json(
        { error: 'clientId and title are required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // public_path가 제공된 경우 검증
    let finalPublicPath = publicPath
    if (publicPath) {
      // public_path 검증: 슬래시로 시작하고 유효한 경로 형식이어야 함
      const publicPathPattern = /^\/[a-zA-Z0-9\/_-]+$/
      if (!publicPathPattern.test(publicPath)) {
        return NextResponse.json(
          { error: 'publicPath는 /로 시작하는 유효한 경로여야 합니다 (예: /2025/triz/triz_1211_booth)' },
          { status: 400 }
        )
      }
    } else {
      // public_path가 제공되지 않으면 6자리 숫자로 자동 생성
      finalPublicPath = await generateUniquePublicPath(admin, clientId)
      if (!finalPublicPath) {
        return NextResponse.json(
          { error: 'public_path 자동 생성에 실패했습니다. 다시 시도해주세요.' },
          { status: 500 }
        )
      }
    }
    
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
            { error: 'Insufficient permissions to create campaigns' },
            { status: 403 }
          )
        }
      }
    }
    
    // public_path 중복 체크 (client_id + public_path는 유니크해야 함)
    const { data: existingCampaign } = await admin
      .from('event_survey_campaigns')
      .select('id')
      .eq('client_id', clientId)
      .eq('public_path', finalPublicPath)
      .maybeSingle()
    
    if (existingCampaign) {
      return NextResponse.json(
        { error: '이미 사용 중인 public_path입니다. 다른 경로를 사용해주세요.' },
        { status: 400 }
      )
    }
    
    // public_path가 제공된 경우에만 추가 검증
    if (publicPath) {
      // 웨비나 slug와 중복 체크 (웨비나 slug는 /webinar/{slug} 형태로 사용되므로)
      const pathSegments = finalPublicPath.split('/').filter(Boolean)
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0]
        const { data: existingWebinar } = await admin
          .from('webinars')
          .select('id, slug')
          .eq('slug', firstSegment)
          .maybeSingle()
        
        if (existingWebinar) {
          return NextResponse.json(
            { error: `public_path의 첫 번째 세그먼트 "${firstSegment}"가 웨비나 slug와 중복됩니다. 다른 경로를 사용해주세요.` },
            { status: 400 }
          )
        }
        
        // 예약된 경로와의 충돌 체크
        const reservedFirstSegments = ['api', 'login', 'signup', 'settings', 'client', 'agency', 'super', 'admin', 'webinar', 's', 'test', 'event']
        if (reservedFirstSegments.includes(firstSegment)) {
          return NextResponse.json(
            { error: `public_path의 첫 번째 세그먼트 "${firstSegment}"는 예약된 경로입니다. 다른 경로를 사용해주세요.` },
            { status: 400 }
          )
        }
      }
    }
    
    // public_path는 /event 프리픽스 없이 저장됨
    // 실제 접근 경로는 /event{public_path} 형태
    // 예: public_path = /123456 → 접근 경로 = /event/123456
    
    // form_id가 제공된 경우 유효성 검증
    if (formId) {
      const { data: form, error: formError } = await admin
        .from('forms')
        .select('id, client_id')
        .eq('id', formId)
        .single()
      
      if (formError || !form) {
        return NextResponse.json(
          { error: 'Form not found' },
          { status: 404 }
        )
      }
      
      // form이 해당 client에 속하는지 확인
      if (form.client_id !== clientId) {
        return NextResponse.json(
          { error: 'Form does not belong to this client' },
          { status: 403 }
        )
      }
    }
    
    // 캠페인 생성
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .insert({
        agency_id: client.agency_id,
        client_id: clientId,
        title,
        host: host || null,
        public_path: finalPublicPath,
        status: status || 'draft',
        form_id: formId || null,
        welcome_schema: welcomeSchema || null,
        completion_schema: completionSchema || null,
        display_schema: displaySchema || null,
        next_survey_no: 1, // 초기값
        created_by: user.id,
      })
      .select()
      .single()
    
    if (campaignError) {
      console.error('캠페인 생성 DB 오류:', campaignError)
      return NextResponse.json(
        { error: campaignError.message || '캠페인 생성에 실패했습니다' },
        { status: 500 }
      )
    }
    
    console.log('캠페인 생성 성공:', campaign.id, 'public_path:', campaign.public_path)
    
    // 감사 로그 (실패해도 캠페인 생성은 성공으로 처리)
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: client.agency_id,
          client_id: clientId,
          action: 'CAMPAIGN_CREATE',
          payload: { title, public_path: finalPublicPath }
        })
    } catch (auditError) {
      console.warn('감사 로그 생성 실패:', auditError)
      // 감사 로그 실패는 무시하고 계속 진행
    }
    
    return NextResponse.json({ success: true, campaign })
  } catch (error: any) {
    console.error('캠페인 생성 API 전체 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


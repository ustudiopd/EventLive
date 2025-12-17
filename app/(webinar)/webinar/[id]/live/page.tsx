import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWebinarQuery } from '@/lib/utils/webinar'
import WebinarView from '../components/WebinarView'

export default async function WebinarLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const searchParamsData = await searchParams
  let isAdminMode = searchParamsData?.admin === 'true'
  
  const admin = createAdminSupabase()
  const supabase = await createServerSupabase()
  
  // UUID 또는 slug로 웨비나 조회
  const query = getWebinarQuery(id)
  
  // 웨비나 정보 조회 (RLS 우회하여 접근 가능하도록)
  let queryBuilder = admin
    .from('webinars')
    .select(`
      *,
      clients:client_id (
        id,
        name,
        logo_url,
        brand_config
      )
    `)
  
  const { data: webinar, error } = await queryBuilder
    .eq(query.column, query.value)
    .single()
  
  if (error || !webinar) {
    // 웨비나가 없으면 입장 페이지로 리다이렉트
    redirect(`/webinar/${id}`)
  }
  
  // slug가 있으면 slug를 사용하고, 없으면 id를 사용 (리다이렉트용)
  const webinarId = webinar.slug || webinar.id
  
  // 사용자 정보 조회
  const { data: { user } } = await supabase.auth.getUser()
  
  // 이메일 파라미터가 있고 로그인되지 않은 경우, 입장 페이지로 리다이렉트하여 자동 로그인 처리
  const emailParam = searchParamsData?.email as string | undefined
  if (emailParam && !user && webinar.access_policy === 'email_auth') {
    redirect(`/webinar/${webinarId}?email=${encodeURIComponent(emailParam)}`)
  }
  
  // 특정 이메일로 접속 시 자동 관리자 모드 활성화
  const isAutoAdminEmail = user && user.email === 'pd@ustudio.co.kr'
  if (isAutoAdminEmail) {
    isAdminMode = true
  }
  
  // 사용자가 있으면 해당 웨비나에 등록되어 있는지 확인 (관리자 모드가 아닐 때만 필수)
  // 먼저 관리자 권한이 있는지 확인하여 자동 관리자 모드 활성화 여부 결정
  let hasAdminPermission = false
  if (user) {
      // JWT app_metadata에서 슈퍼어드민 권한 확인
      const isSuperAdmin = !!user?.app_metadata?.is_super_admin
      
      if (isSuperAdmin) {
      hasAdminPermission = true
      } else {
        // 클라이언트 멤버십 확인 (Admin Supabase로 RLS 우회)
        const { data: clientMember } = await admin
          .from('client_members')
          .select('role')
          .eq('client_id', webinar.client_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        // 클라이언트 멤버는 모든 역할에서 운영 권한 부여 (owner, admin, operator, member)
        if (clientMember && ['owner', 'admin', 'operator', 'member'].includes(clientMember.role)) {
        hasAdminPermission = true
        } else {
          // 에이전시 멤버십 확인 (owner, admin만 운영 권한 부여)
          const { data: agencyMember } = await admin
            .from('agency_members')
            .select('role')
            .eq('agency_id', webinar.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()
          
          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
          hasAdminPermission = true
        }
      }
    }
    
    // URL 파라미터로 명시적으로 admin=false가 아닌 경우, 관리자 권한이 있으면 자동 관리자 모드 활성화
    if (hasAdminPermission && searchParamsData?.admin !== 'false') {
            isAdminMode = true
          }
    
    // 관리자 모드가 아닐 때만 등록 확인
    if (!isAdminMode) {
      const { data: registration } = await admin
        .from('registrations')
        .select('webinar_id, user_id')
        .eq('webinar_id', webinar.id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      // 등록되어 있지 않으면 입장 페이지로 리다이렉트 (웨비나별 독립 등록 필수)
      if (!registration) {
        redirect(`/webinar/${webinarId}`)
      }
    }
  }
  
  // 관리자 모드인 경우 권한 확인
  if (isAdminMode) {
    if (!user) {
      // 관리자 모드는 로그인 필요
      redirect(`/webinar/${webinarId}`)
    }
    
    // 특정 이메일은 권한 확인 건너뛰기
    if (!isAutoAdminEmail && !hasAdminPermission) {
        // 권한이 없으면 일반 입장 페이지로 리다이렉트
      redirect(`/webinar/${webinarId}`)
    }
  } else {
    // 일반 모드: 접근 정책 확인
    if (webinar.access_policy === 'auth' && !user) {
      redirect(`/webinar/${webinarId}`)
    }
    
    // email_auth 정책: 등록된 이메일인지 확인
    if (webinar.access_policy === 'email_auth' && user) {
      const { data: allowedEmail } = await admin
        .from('webinar_allowed_emails')
        .select('email')
        .eq('webinar_id', webinar.id)
        .ilike('email', user.email?.toLowerCase() || '')
        .maybeSingle()
      
      if (!allowedEmail) {
        // 등록되지 않은 이메일이면 입장 페이지로 리다이렉트
        redirect(`/webinar/${webinarId}`)
      }
    }
  }
  
  return <WebinarView webinar={webinar} isAdminMode={isAdminMode} />
}


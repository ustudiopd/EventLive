import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
  
  // 웨비나 정보 조회 (RLS 우회하여 접근 가능하도록)
  const { data: webinar, error } = await admin
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
    .eq('id', id)
    .single()
  
  if (error || !webinar) {
    // 웨비나가 없으면 입장 페이지로 리다이렉트
    redirect(`/webinar/${id}`)
  }
  
  // 특정 이메일로 접속 시 자동 관리자 모드 활성화
  const { data: { user } } = await supabase.auth.getUser()
  const isAutoAdminEmail = user && user.email === 'pd@ustudio.co.kr'
  if (isAutoAdminEmail) {
    isAdminMode = true
  }
  
  // 관리자 모드인 경우 권한 확인
  if (isAdminMode) {
    if (!user) {
      // 관리자 모드는 로그인 필요
      redirect(`/webinar/${id}`)
    }
    
    // 특정 이메일은 권한 확인 건너뛰기
    if (!isAutoAdminEmail) {
      // 관리자 권한 확인 (클라이언트 멤버 owner/admin/operator 또는 에이전시 멤버 owner/admin)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()
      
      let hasAdminPermission = false
      
      if (profile?.is_super_admin) {
        hasAdminPermission = true
      } else {
        // 클라이언트 멤버십 확인
        const { data: clientMember } = await supabase
          .from('client_members')
          .select('role')
          .eq('client_id', webinar.client_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
          hasAdminPermission = true
        } else {
          // 에이전시 멤버십 확인
          const { data: agencyMember } = await supabase
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
      
      if (!hasAdminPermission) {
        // 권한이 없으면 일반 입장 페이지로 리다이렉트
        redirect(`/webinar/${id}`)
      }
    }
  } else {
    // 일반 모드: 접근 정책 확인
    if (webinar.access_policy === 'auth' && !user) {
      redirect(`/webinar/${id}`)
    }
  }
  
  return <WebinarView webinar={webinar} isAdminMode={isAdminMode} />
}


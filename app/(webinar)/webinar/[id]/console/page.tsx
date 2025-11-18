import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import ConsoleView from './components/ConsoleView'

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminSupabase()
  const { user, supabase } = await requireAuth()
  
  // 웨비나 정보 조회 (RLS 우회)
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
    // 웨비나를 찾을 수 없으면 입장 페이지로 리다이렉트
    redirect(`/webinar/${id}`)
  }
  
  // 권한 확인 (클라이언트 멤버 또는 에이전시 owner/admin)
  // JWT app_metadata에서 슈퍼어드민 권한 확인 (RLS 재귀 방지)
  const isSuperAdmin = !!user?.app_metadata?.is_super_admin
  
  let hasPermission = false
  let userRole = 'viewer'
  
  // 슈퍼 어드민은 항상 접근 가능
  if (isSuperAdmin) {
    hasPermission = true
    userRole = 'super_admin'
  } else {
    // 클라이언트 멤버십 확인 (Admin Supabase로 RLS 우회)
    const { data: clientMember, error: clientMemberError } = await admin
      .from('client_members')
      .select('role')
      .eq('client_id', webinar.client_id)
      .eq('user_id', user.id)
      .maybeSingle()
    
    // 디버깅 로그
    console.log('[Console] 권한 체크:', {
      userId: user.id,
      webinarClientId: webinar.client_id,
      clientMember,
      clientMemberError,
    })
    
    // 클라이언트 멤버는 모든 역할에서 콘솔 접근 가능
    if (clientMember && ['owner', 'admin', 'operator', 'member'].includes(clientMember.role)) {
      hasPermission = true
      userRole = clientMember.role
    } else {
      // 에이전시 멤버십 확인 (owner/admin만 운영 콘솔 접근 가능)
      const { data: agencyMember } = await admin
        .from('agency_members')
        .select('role')
        .eq('agency_id', webinar.agency_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
        hasPermission = true
        userRole = agencyMember.role
      }
    }
  }
  
  // 권한이 없으면 입장 페이지로 리다이렉트
  if (!hasPermission) {
    console.log('[Console] 권한 없음 - 입장 페이지로 리다이렉트:', {
      userId: user.id,
      webinarId: id,
      webinarClientId: webinar.client_id,
    })
    redirect(`/webinar/${id}`)
  }
  
  return <ConsoleView webinar={webinar} userRole={userRole} />
}


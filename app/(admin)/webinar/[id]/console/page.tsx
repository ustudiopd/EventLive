import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { getWebinarQuery } from '@/lib/utils/webinar'
import ConsoleView from './components/ConsoleView'

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminSupabase()
  const { user, supabase } = await requireAuth()
  
  // UUID 또는 slug로 웨비나 조회
  const query = getWebinarQuery(id)
  
  // 웨비나 정보 조회 (RLS 우회)
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
    // 웨비나를 찾을 수 없으면 입장 페이지로 리다이렉트
    redirect(`/webinar/${id}`)
  }
  
  // slug가 있으면 slug를 사용하고, 없으면 id를 사용 (리다이렉트용)
  const webinarId = webinar.slug || webinar.id
  
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
      webinarAgencyId: webinar.agency_id,
      clientMember,
      clientMemberError,
    })
    
    // 클라이언트 멤버는 모든 역할에서 콘솔 접근 가능
    if (clientMember && ['owner', 'admin', 'operator', 'member'].includes(clientMember.role)) {
      hasPermission = true
      userRole = clientMember.role
    } else {
      // 클라이언트 멤버가 없으면 에이전시 멤버십 확인
      // 클라이언트가 속한 에이전시의 멤버인지 확인 (requireClientMember와 동일한 로직)
      if (webinar.agency_id) {
        const { data: agencyMember } = await admin
          .from('agency_members')
          .select('role')
          .eq('agency_id', webinar.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        console.log('[Console] 에이전시 멤버십 확인:', {
          agencyId: webinar.agency_id,
          agencyMember,
        })
        
        // 에이전시 멤버는 owner/admin만 운영 콘솔 접근 가능
        if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
          hasPermission = true
          userRole = agencyMember.role
        } else {
          // UStudio 계정 특별 처리: 에이전시 멤버가 없으면 자동으로 추가
          const isUStudioAccount = user.email?.endsWith('@ustudio.co.kr') || user.email?.endsWith('@ustudio.com')
          if (isUStudioAccount && !agencyMember) {
            // UStudio 계정을 해당 에이전시에 owner 역할로 자동 추가
            const { error: insertError } = await admin
              .from('agency_members')
              .insert({
                agency_id: webinar.agency_id,
                user_id: user.id,
                role: 'owner'
              })

            if (!insertError) {
              console.log(`[Console] UStudio 계정 ${user.email}을 에이전시 ${webinar.agency_id}에 멤버로 추가했습니다.`)
              hasPermission = true
              userRole = 'owner'
            } else {
              console.error(`[Console] UStudio 계정 멤버 추가 실패:`, insertError)
            }
          }
        }
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
    redirect(`/webinar/${webinarId}`)
  }
  
  return <ConsoleView webinar={webinar} userRole={userRole} />
}





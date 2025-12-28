import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/guards'
import { getWebinarQuery } from '@/lib/utils/webinar'

/**
 * 웨비나 통계 접근 권한 확인
 * 
 * 허용되는 역할:
 * - Super Admin: 모든 통계 접근 가능
 * - Agency: owner/admin/analyst
 * - Client: owner/admin/operator/analyst/viewer
 * 
 * @returns { hasPermission: boolean, webinar: { id, agency_id, client_id } | null }
 */
export async function checkWebinarStatsPermission(webinarId: string) {
  const { user } = await requireAuth()
  const admin = createAdminSupabase()

  // 슈퍼 어드민 확인
  const isSuperAdmin = !!user?.app_metadata?.is_super_admin
  
  // UUID 또는 slug로 웨비나 조회
  const query = getWebinarQuery(webinarId)
  
  if (isSuperAdmin) {
    const { data: webinar } = await admin
      .from('webinars')
      .select('id, agency_id, client_id')
      .eq(query.column, query.value)
      .single()

    if (!webinar) {
      return { hasPermission: false, webinar: null }
    }

    return { hasPermission: true, webinar }
  }

  // 웨비나 정보 조회 (UUID 또는 slug로 조회)
  const { data: webinar, error: webinarError } = await admin
    .from('webinars')
    .select('id, agency_id, client_id')
    .eq(query.column, query.value)
    .single()

  if (webinarError || !webinar) {
    return { hasPermission: false, webinar: null }
  }

  // 클라이언트 멤버 확인
  if (webinar.client_id) {
    const { data: clientMember } = await admin
      .from('client_members')
      .select('role')
      .eq('client_id', webinar.client_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (clientMember && ['owner', 'admin', 'operator', 'analyst', 'viewer'].includes(clientMember.role)) {
      return { hasPermission: true, webinar }
    }
  }

  // 에이전시 멤버 확인
  // 웨비나에 agency_id가 없으면 클라이언트를 통해 에이전시 조회
  let agencyId = webinar.agency_id
  
  if (!agencyId && webinar.client_id) {
    const { data: client } = await admin
      .from('clients')
      .select('agency_id')
      .eq('id', webinar.client_id)
      .maybeSingle()
    
    if (client?.agency_id) {
      agencyId = client.agency_id
    }
  }
  
  if (agencyId) {
    const { data: agencyMember } = await admin
      .from('agency_members')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (agencyMember && ['owner', 'admin', 'analyst'].includes(agencyMember.role)) {
      return { hasPermission: true, webinar }
    }

    // UStudio 계정 특별 처리: 에이전시 멤버가 없으면 자동으로 추가
    const isUStudioAccount = user.email?.endsWith('@ustudio.co.kr') || user.email?.endsWith('@ustudio.com')
    if (isUStudioAccount && !agencyMember) {
      // UStudio 계정을 해당 에이전시에 owner 역할로 자동 추가
      const { error: insertError } = await admin
        .from('agency_members')
        .insert({
          agency_id: agencyId,
          user_id: user.id,
          role: 'owner'
        })

      if (!insertError) {
        console.log(`[Stats] UStudio 계정 ${user.email}을 에이전시 ${agencyId}에 멤버로 추가했습니다.`)
        return { hasPermission: true, webinar }
      } else {
        console.error(`[Stats] UStudio 계정 멤버 추가 실패:`, insertError)
      }
    }
  }

  return { hasPermission: false, webinar }
}





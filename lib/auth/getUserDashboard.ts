import { createServerSupabase } from '@/lib/supabase/server'

/**
 * 사용자의 역할에 따라 적절한 대시보드 경로를 반환합니다.
 * @returns 대시보드 경로 또는 null (대시보드가 없으면)
 */
export async function getUserDashboard(): Promise<string | null> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }
  
  // 슈퍼 관리자 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  
  if (profile?.is_super_admin) {
    return '/super/dashboard'
  }
  
  // 에이전시 멤버십 확인 (첫 번째 에이전시)
  const { data: agencyMember } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  
  if (agencyMember) {
    return `/agency/${agencyMember.agency_id}/dashboard`
  }
  
  // 클라이언트 멤버십 확인 (첫 번째 클라이언트)
  const { data: clientMember } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  
  if (clientMember) {
    return `/client/${clientMember.client_id}/dashboard`
  }
  
  // 대시보드가 없으면 null 반환
  return null
}


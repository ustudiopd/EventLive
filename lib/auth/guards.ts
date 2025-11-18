import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requireAuth() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  return { user, supabase }
}

export async function requireSuperAdmin() {
  const { user, supabase } = await requireAuth()
  
  // JWT app_metadata에서 슈퍼어드민 권한 확인 (RLS 재귀 방지)
  let isSuperAdmin = !!user?.app_metadata?.is_super_admin
  
  // JWT에 app_metadata가 없을 경우 fallback: Admin Supabase로 확인
  // (JWT 토큰 갱신 전까지 임시 조치)
  if (!isSuperAdmin) {
    try {
      const { createAdminSupabase } = await import('@/lib/supabase/admin')
      const admin = createAdminSupabase()
      const { data: profile } = await admin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .maybeSingle()
      
      isSuperAdmin = !!profile?.is_super_admin
      
      if (isSuperAdmin) {
        console.warn('⚠️  JWT에 app_metadata가 없습니다. 재로그인하여 JWT 토큰을 갱신하세요.')
      }
    } catch (error) {
      console.error('프로필 확인 오류:', error)
    }
  }
  
  if (!isSuperAdmin) {
    redirect('/')
  }
  
  // 프로필 정보는 필요시에만 조회 (슈퍼어드민은 모든 프로필 접근 가능하므로 선택적)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()
  
  return { user, supabase, profile }
}

export async function requireAgencyMember(agencyId: string, roles: string[] = ['owner', 'admin']) {
  const { user, supabase } = await requireAuth()
  
  // JWT app_metadata에서 슈퍼어드민 권한 확인 (RLS 재귀 방지)
  const isSuperAdmin = !!user?.app_metadata?.is_super_admin
  
  if (isSuperAdmin) {
    // 프로필 정보는 필요시에만 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, is_super_admin')
      .eq('id', user.id)
      .maybeSingle()
    return { user, supabase, profile, role: 'super_admin' as const }
  }
  
  const { data: member } = await supabase
    .from('agency_members')
    .select('role')
    .eq('agency_id', agencyId)
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (!member || !roles.includes(member.role)) {
    redirect('/')
  }
  
  // 프로필 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()
  
  return { user, supabase, profile, role: member.role }
}

export async function requireClientMember(clientId: string, roles: string[] = ['owner', 'admin', 'operator', 'member']) {
  const { user, supabase } = await requireAuth()
  
  // JWT app_metadata에서 슈퍼어드민 권한 확인 (RLS 재귀 방지)
  const isSuperAdmin = !!user?.app_metadata?.is_super_admin
  
  if (isSuperAdmin) {
    // 프로필 정보는 필요시에만 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, is_super_admin')
      .eq('id', user.id)
      .maybeSingle()
    return { user, supabase, profile, role: 'super_admin' as const }
  }
  
  // 프로필 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()
  
  // 클라이언트 멤버십 확인
  const { data: member } = await supabase
    .from('client_members')
    .select('role')
    .eq('client_id', clientId)
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (member && roles.includes(member.role)) {
    return { user, supabase, profile, role: member.role }
  }
  
  // 클라이언트 멤버가 아니면, 에이전시 멤버인지 확인
  // 클라이언트가 속한 에이전시의 멤버라면 접근 허용
  const { data: client } = await supabase
    .from('clients')
    .select('agency_id')
    .eq('id', clientId)
    .single()
  
  if (client) {
    const { data: agencyMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('agency_id', client.agency_id)
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (agencyMember) {
      // 에이전시 멤버는 클라이언트 대시보드에 접근 가능 (viewer 역할로 처리)
      return { user, supabase, profile, role: 'viewer' as const }
    }
  }
  
  // 권한이 없으면 홈으로 리다이렉트
  redirect('/')
}


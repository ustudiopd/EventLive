import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * 사용자의 역할에 따라 적절한 대시보드 경로를 반환합니다.
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ dashboard: null, error: '로그인이 필요합니다' })
  }
  
  // 슈퍼 관리자 확인 (JWT app_metadata 사용 - RLS 재귀 방지)
  let isSuperAdmin = !!user?.app_metadata?.is_super_admin
  
  // JWT에 app_metadata가 없을 경우 fallback: Admin Supabase로 확인
  if (!isSuperAdmin) {
    try {
      const { createAdminSupabase } = await import('@/lib/supabase/admin')
      const admin = createAdminSupabase()
      const { data: profile } = await admin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profile?.is_super_admin) {
        isSuperAdmin = true
        // JWT app_metadata 동기화 (재로그인 필요 안내)
        console.warn(`⚠️  사용자 ${user.email}의 JWT에 app_metadata가 없습니다. 재로그인하여 JWT를 갱신하세요.`)
      }
    } catch (error) {
      console.error('프로필 확인 오류:', error)
    }
  }
  
  if (isSuperAdmin) {
    return NextResponse.json({ dashboard: '/super/dashboard' })
  }
  
  // 에이전시 멤버십 확인 (첫 번째 에이전시)
  const { data: agencyMember } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  
  if (agencyMember) {
    return NextResponse.json({ dashboard: `/agency/${agencyMember.agency_id}/dashboard` })
  }
  
  // 클라이언트 멤버십 확인 (첫 번째 클라이언트)
  const { data: clientMember } = await supabase
    .from('client_members')
    .select('client_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  
  if (clientMember) {
    return NextResponse.json({ dashboard: `/client/${clientMember.client_id}/dashboard` })
  }
  
  return NextResponse.json({ dashboard: null })
}


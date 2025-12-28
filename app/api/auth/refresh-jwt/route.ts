import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * JWT 토큰을 갱신하여 app_metadata를 최신 상태로 동기화합니다.
 * profiles 테이블의 is_super_admin 상태를 JWT app_metadata에 반영합니다.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }
    
    // Admin Supabase로 프로필 확인
    const admin = createAdminSupabase()
    const { data: profile } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!profile) {
      return NextResponse.json(
        { error: '프로필을 찾을 수 없습니다' },
        { status: 404 }
      )
    }
    
    // JWT app_metadata 업데이트
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { is_super_admin: !!profile.is_super_admin }
    })
    
    if (updateError) {
      return NextResponse.json(
        { error: `JWT 갱신 실패: ${updateError.message}` },
        { status: 500 }
      )
    }
    
    // 세션 갱신을 위해 재로그인 필요 안내
    return NextResponse.json({ 
      success: true,
      message: 'JWT가 갱신되었습니다. 재로그인하여 새 토큰을 받으세요.',
      requiresReLogin: true
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'JWT 갱신 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}








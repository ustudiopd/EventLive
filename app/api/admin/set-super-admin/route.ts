import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 슈퍼어드민이 다른 사용자의 is_super_admin 권한을 설정하는 API
 * 보안상 서버 전용 (Admin Supabase 사용)
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireSuperAdmin()
    const { userId, isSuperAdmin } = await req.json()
    
    if (!userId || typeof isSuperAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'userId and isSuperAdmin (boolean) are required' },
        { status: 400 }
      )
    }
    
    // 자기 자신의 권한은 변경 불가 (보안상)
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own super admin status' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 사용자 존재 확인
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, is_super_admin')
      .eq('id', userId)
      .maybeSingle()
    
    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }
    
    if (!profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // 권한 업데이트 (profiles 테이블)
    const { error: updateError } = await admin
      .from('profiles')
      .update({ is_super_admin: isSuperAdmin })
      .eq('id', userId)
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // JWT app_metadata도 업데이트 (재로그인 없이 권한 반영)
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { is_super_admin: isSuperAdmin }
    })
    
    if (authUpdateError) {
      console.error('JWT app_metadata 업데이트 실패:', authUpdateError)
      // profiles 업데이트는 성공했으므로 경고만 하고 계속 진행
      // 사용자는 재로그인하면 JWT가 갱신됨
    }
    
    // 감사 로그
    try {
      await admin.from('audit_logs').insert({
        actor_user_id: user.id,
        action: 'SET_SUPER_ADMIN',
        payload: { 
          target_user_id: userId, 
          target_email: profile.email,
          is_super_admin: isSuperAdmin 
        }
      })
    } catch (auditError) {
      // 감사 로그 실패는 무시
      console.warn('감사 로그 기록 실패:', auditError)
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Super admin status ${isSuperAdmin ? 'granted' : 'revoked'} for user ${profile.email}`
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


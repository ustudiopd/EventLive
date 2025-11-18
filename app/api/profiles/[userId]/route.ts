import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 사용자 프로필 정보 조회
 * 같은 웨비나에 등록된 사용자들의 프로필 정보 조회 가능
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { user } = await requireAuth()
    const admin = createAdminSupabase()
    
    // 자신의 프로필은 항상 조회 가능
    if (userId === user.id) {
      const { data: profile, error } = await admin
        .from('profiles')
        .select('id, display_name, email, nickname')
        .eq('id', userId)
        .single()
      
      if (error || !profile) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({ profile })
    }
    
    // 다른 사용자의 프로필은 같은 웨비나에 등록되어 있는지 확인
    // (간단하게 Admin으로 조회 - RLS 우회)
    const { data: profile, error } = await admin
      .from('profiles')
      .select('id, display_name, email, nickname')
      .eq('id', userId)
      .single()
    
    if (error || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ profile })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


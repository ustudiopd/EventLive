import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { name, userId } = await req.json()
    
    if (!name || !userId) {
      return NextResponse.json(
        { error: 'name and userId are required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // userId가 실제로 존재하는 사용자인지 확인 (회원가입 직후 세션이 없을 수 있음)
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle()
    
    if (!profile) {
      return NextResponse.json(
        { error: 'User not found. Please try signing up again.' },
        { status: 404 }
      )
    }
    
    // 에이전시 생성
    const { data: agency, error: agencyError } = await admin
      .from('agencies')
      .insert({ name })
      .select()
      .single()
    
    if (agencyError) {
      return NextResponse.json(
        { error: agencyError.message },
        { status: 500 }
      )
    }
    
    // 에이전시 멤버십 생성 (owner 역할)
    const { error: memberError } = await admin
      .from('agency_members')
      .insert({
        agency_id: agency.id,
        user_id: userId,
        role: 'owner'
      })
    
    if (memberError) {
      // 에이전시 롤백
      await admin.from('agencies').delete().eq('id', agency.id)
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      )
    }
    
    // 기본 플랜 할당 (free)
    await admin
      .from('subscriptions')
      .insert({
        agency_id: agency.id,
        plan_code: 'free',
        status: 'active'
      })
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: userId,
        agency_id: agency.id,
        action: 'AGENCY_SELF_CREATE',
        payload: { name }
      })
    
    return NextResponse.json({ success: true, agency })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


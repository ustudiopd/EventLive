import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { user } = await requireSuperAdmin()
    const { name, ownerEmail } = await req.json()
    
    if (!name || !ownerEmail) {
      return NextResponse.json(
        { error: 'name and ownerEmail are required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
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
    
    // 소유자 프로필 찾기 또는 생성 (이메일로)
    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', ownerEmail)
      .maybeSingle()
    
    if (ownerProfile) {
      // 멤버십 생성
      await admin
        .from('agency_members')
        .insert({
          agency_id: agency.id,
          user_id: ownerProfile.id,
          role: 'owner'
        })
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
        actor_user_id: user.id,
        agency_id: agency.id,
        action: 'AGENCY_CREATE',
        payload: { name, ownerEmail }
      })
    
    return NextResponse.json({ success: true, agency })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


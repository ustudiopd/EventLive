import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { agencyId, domain } = await req.json()
    
    if (!agencyId || !domain) {
      return NextResponse.json(
        { error: 'agencyId and domain are required' },
        { status: 400 }
      )
    }
    
    // 권한 확인 (에이전시 owner/admin만)
    const { user } = await requireAgencyMember(agencyId, ['owner', 'admin'])
    
    const admin = createAdminSupabase()
    
    // 도메인 중복 확인
    const { data: existing } = await admin
      .from('domains')
      .select('id')
      .eq('domain', domain.toLowerCase().trim())
      .maybeSingle()
    
    if (existing) {
      return NextResponse.json(
        { error: '이미 등록된 도메인입니다' },
        { status: 400 }
      )
    }
    
    // 도메인 생성
    const { data: newDomain, error: domainError } = await admin
      .from('domains')
      .insert({
        agency_id: agencyId,
        domain: domain.toLowerCase().trim(),
        verified: false,
      })
      .select()
      .single()
    
    if (domainError) {
      return NextResponse.json(
        { error: domainError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: agencyId,
        action: 'DOMAIN_CREATE',
        payload: { domain }
      })
    
    return NextResponse.json({ success: true, domain: newDomain })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { name, agencyId, logoUrl, brandConfig } = await req.json()
    
    if (!name || !agencyId) {
      return NextResponse.json(
        { error: 'name and agencyId are required' },
        { status: 400 }
      )
    }
    
    // 권한 확인 (에이전시 owner/admin만)
    const { user } = await requireAgencyMember(agencyId, ['owner', 'admin'])
    
    const admin = createAdminSupabase()
    
    // 클라이언트 생성
    const { data: client, error: clientError } = await admin
      .from('clients')
      .insert({
        agency_id: agencyId,
        name,
        logo_url: logoUrl || null,
        brand_config: brandConfig || null,
      })
      .select()
      .single()
    
    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
      )
    }
    
    // 클라이언트 소유자로 현재 사용자 추가 (선택사항)
    // 실제로는 초대 시스템을 통해 추가할 수 있음
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: agencyId,
        client_id: client.id,
        action: 'CLIENT_CREATE',
        payload: { name }
      })
    
    return NextResponse.json({ success: true, client })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


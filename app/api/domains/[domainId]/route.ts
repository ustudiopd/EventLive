import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params
    const { agencyId } = await req.json()
    
    if (!agencyId) {
      return NextResponse.json(
        { error: 'agencyId is required' },
        { status: 400 }
      )
    }
    
    // 권한 확인
    const { user } = await requireAgencyMember(agencyId, ['owner', 'admin'])
    
    const admin = createAdminSupabase()
    
    // 도메인 조회
    const { data: domain } = await admin
      .from('domains')
      .select('*')
      .eq('id', domainId)
      .eq('agency_id', agencyId)
      .single()
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      )
    }
    
    // 도메인 삭제
    const { error: deleteError } = await admin
      .from('domains')
      .delete()
      .eq('id', domainId)
    
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: agencyId,
        action: 'DOMAIN_DELETE',
        payload: { domain: domain.domain }
      })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


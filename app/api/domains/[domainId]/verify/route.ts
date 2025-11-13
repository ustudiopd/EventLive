import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import * as dns from 'dns'
import { promisify } from 'util'

const resolveTxt = promisify(dns.resolveTxt)

export const runtime = 'nodejs'

export async function POST(
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
    const { data: domain, error: domainError } = await admin
      .from('domains')
      .select('*')
      .eq('id', domainId)
      .eq('agency_id', agencyId)
      .single()
    
    if (domainError || !domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      )
    }
    
    // DNS TXT 레코드 확인
    const verifyToken = `eventlive-verify=${agencyId.slice(0, 8)}`
    let verified = false
    
    try {
      const txtRecords = await resolveTxt(domain.domain)
      const allRecords = txtRecords.flat()
      verified = allRecords.some(record => record.includes(verifyToken))
    } catch (dnsError) {
      // DNS 조회 실패는 검증 실패로 처리
      verified = false
    }
    
    // 도메인 검증 상태 업데이트
    const { data: updatedDomain, error: updateError } = await admin
      .from('domains')
      .update({
        verified,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq('id', domainId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: agencyId,
        action: 'DOMAIN_VERIFY',
        payload: { domain: domain.domain, verified }
      })
    
    return NextResponse.json({ 
      success: true, 
      domain: updatedDomain,
      verified 
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


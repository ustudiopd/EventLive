import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { agencyId, email, expiresInDays = 7 } = await req.json()
    
    if (!agencyId) {
      return NextResponse.json(
        { error: 'agencyId is required' },
        { status: 400 }
      )
    }
    
    // 권한 확인 (에이전시 owner/admin만)
    const { user } = await requireAgencyMember(agencyId, ['owner', 'admin'])
    
    const admin = createAdminSupabase()
    
    // 초대 토큰 생성
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    
    // client_invitations 테이블에 저장
    const { data: invitation, error: inviteError } = await admin
      .from('client_invitations')
      .insert({
        agency_id: agencyId,
        token,
        email: email || null,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single()
    
    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 500 }
      )
    }
    
    // 초대 링크 생성
    // 환경 변수가 있으면 우선 사용, 없으면 요청 헤더에서 동적으로 생성
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL
    
    if (!baseUrl) {
      // 요청 헤더에서 프로토콜과 호스트 추출
      // Vercel에서는 x-forwarded-proto 헤더를 제공
      const protocol = req.headers.get('x-forwarded-proto') || 
                      (req.url.startsWith('https://') ? 'https' : 'http')
      const host = req.headers.get('host') || 'localhost:3000'
      baseUrl = `${protocol}://${host}`
    }
    
    const inviteLink = `${baseUrl}/signup/client?token=${token}`
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: agencyId,
        action: 'CLIENT_INVITE_CREATE',
        payload: { email, token }
      })
    
    return NextResponse.json({ 
      success: true, 
      invitation,
      inviteLink 
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


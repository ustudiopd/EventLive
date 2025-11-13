import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { name, userId, inviteToken } = await req.json()
    
    if (!name || !userId || !inviteToken) {
      return NextResponse.json(
        { error: 'name, userId, and inviteToken are required' },
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
    
    // 초대 토큰 검증
    const { data: invite } = await admin
      .from('client_invitations')
      .select('agency_id, expires_at')
      .eq('token', inviteToken)
      .eq('used', false)
      .maybeSingle()
    
    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      )
    }
    
    // 만료 확인
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation token has expired' },
        { status: 400 }
      )
    }
    
    const agencyId = invite.agency_id
    
    // 초대 토큰 사용 처리
    await admin
      .from('client_invitations')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', inviteToken)
    
    // 에이전시 존재 확인
    const { data: agency } = await admin
      .from('agencies')
      .select('id')
      .eq('id', agencyId)
      .single()
    
    if (!agency) {
      return NextResponse.json(
        { error: 'Invalid agency' },
        { status: 400 }
      )
    }
    
    // 클라이언트 생성
    const { data: client, error: clientError } = await admin
      .from('clients')
      .insert({
        agency_id: agencyId,
        name
      })
      .select()
      .single()
    
    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
      )
    }
    
    // 클라이언트 멤버십 생성 (owner 역할)
    const { error: memberError } = await admin
      .from('client_members')
      .insert({
        client_id: client.id,
        user_id: userId,
        role: 'owner'
      })
    
    if (memberError) {
      // 클라이언트 롤백
      await admin.from('clients').delete().eq('id', client.id)
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: userId,
        agency_id: agencyId,
        client_id: client.id,
        action: 'CLIENT_SELF_CREATE',
        payload: { name, inviteToken }
      })
    
    return NextResponse.json({ success: true, client })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


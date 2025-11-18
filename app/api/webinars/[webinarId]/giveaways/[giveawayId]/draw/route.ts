import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { broadcastRaffleDraw } from '@/lib/webinar/broadcast'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ webinarId: string; giveawayId: string }> }
) {
  try {
    const { webinarId, giveawayId } = await params
    
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    
    // 추첨 조회
    const { data: giveaway, error: giveawayError } = await admin
      .from('giveaways')
      .select('*')
      .eq('id', giveawayId)
      .eq('webinar_id', webinarId)
      .single()
    
    if (giveawayError || !giveaway) {
      return NextResponse.json(
        { error: 'Giveaway not found' },
        { status: 404 }
      )
    }
    
    if (giveaway.status !== 'open' && giveaway.status !== 'closed') {
      return NextResponse.json(
        { error: 'Giveaway must be open or closed to draw' },
        { status: 400 }
      )
    }
    
    // 권한 확인 (클라이언트 operator 이상 또는 에이전시 owner/admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', giveaway.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 에이전시 멤버십 확인 (owner/admin만 추첨 실행 가능)
        if (giveaway.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', giveaway.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()
          
          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 자동 seed 생성 (현재 시간 + 추첨 ID 기반)
    const autoSeed = `${giveawayId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    
    // 추첨 실행 (SQL 함수 사용)
    const { data: winners, error: drawError } = await admin.rpc('draw_giveaway', {
      p_giveaway_id: giveawayId,
      p_seed: autoSeed,
    })
    
    if (drawError) {
      return NextResponse.json(
        { error: drawError.message },
        { status: 500 }
      )
    }
    
    // 추첨 상태 업데이트
    const { data: updatedGiveaway, error: updateError } = await admin
      .from('giveaways')
      .update({
        status: 'drawn',
        seed_reveal: autoSeed,
        drawn_at: new Date().toISOString(),
      })
      .eq('id', giveawayId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // 당첨자 사용자 정보 조회
    const participantIds = (winners || []).map((w: any) => w.participant_id)
    let profilesMap = new Map()
    
    if (participantIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, display_name, email')
        .in('id', participantIds)
      
      profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    }
    
    // 당첨자 데이터 포맷팅 (사용자 정보 포함)
    const formattedWinners = (winners || []).map((w: any) => {
      const profile = profilesMap.get(w.participant_id)
      return {
        participant_id: w.participant_id,
        rank: w.rank,
        proof: w.proof,
        user: profile ? {
          display_name: profile.display_name,
          email: profile.email,
        } : undefined,
      }
    })
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: giveaway.agency_id,
        client_id: giveaway.client_id,
        webinar_id: webinarId,
        action: 'GIVEAWAY_DRAW',
        payload: {
          giveaway_id: giveawayId,
          winners_count: winners?.length || 0,
        },
      })
    
    // Phase 3: DB draw 성공 후 Broadcast 전파
    broadcastRaffleDraw(webinarId, {
      giveaway: updatedGiveaway,
      winners: formattedWinners,
    }, user.id)
      .catch((error) => console.error('Broadcast 전파 실패:', error))
    
    return NextResponse.json({
      success: true,
      winners: formattedWinners,
      giveaway: updatedGiveaway,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 클라이언트 정보 조회
    const { data: client, error: clientError } = await admin
      .from('clients')
      .select('agency_id')
      .eq('id', clientId)
      .single()
    
    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    // 슈퍼 관리자는 항상 허용
    if (!profile?.is_super_admin) {
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', clientId)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (!clientMember || !['owner', 'admin', 'operator', 'analyst', 'viewer'].includes(clientMember.role)) {
        // 에이전시 멤버십 확인
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('role')
          .eq('agency_id', client.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (!agencyMember || !['owner', 'admin'].includes(agencyMember.role)) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view campaigns' },
            { status: 403 }
          )
        }
      }
    }
    
    // 캠페인 목록 조회
    const { data: campaigns, error: campaignsError } = await admin
      .from('event_survey_campaigns')
      .select(`
        *,
        forms:form_id (
          id,
          title,
          kind,
          status
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    
    if (campaignsError) {
      console.error('캠페인 목록 조회 오류:', campaignsError)
      return NextResponse.json(
        { error: campaignsError.message || '캠페인 목록 조회에 실패했습니다' },
        { status: 500 }
      )
    }
    
    // 통계 정보 추가 (각 캠페인별 완료 수, 스캔 수 등)
    const campaignsWithStats = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        const { count: completedCount } = await admin
          .from('event_survey_entries')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
        
        const { count: verifiedCount } = await admin
          .from('event_survey_entries')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .not('verified_at', 'is', null)
        
        const { count: prizeRecordedCount } = await admin
          .from('event_survey_entries')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .not('prize_recorded_at', 'is', null)
        
        return {
          ...campaign,
          stats: {
            total_completed: completedCount || 0,
            total_verified: verifiedCount || 0,
            total_prize_recorded: prizeRecordedCount || 0,
          }
        }
      })
    )
    
    return NextResponse.json({ 
      success: true, 
      campaigns: campaignsWithStats 
    })
  } catch (error: any) {
    console.error('캠페인 목록 조회 API 전체 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


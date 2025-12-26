import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * 설문조사 캠페인 상세 조회
 * GET /api/event-survey/campaigns/[campaignId]
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    
    const admin = createAdminSupabase()
    
    // 캠페인 정보 조회
    const { data: campaign, error: campaignError } = await admin
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
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
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
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (!clientMember || !['owner', 'admin', 'operator', 'analyst', 'viewer'].includes(clientMember.role)) {
        // 에이전시 멤버십 확인
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('role')
          .eq('agency_id', campaign.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (!agencyMember || !['owner', 'admin'].includes(agencyMember.role)) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view campaign' },
            { status: 403 }
          )
        }
      }
    }
    
    // 통계 정보 조회
    const { count: completedCount } = await admin
      .from('event_survey_entries')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
    
    const { count: verifiedCount } = await admin
      .from('event_survey_entries')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .not('verified_at', 'is', null)
    
    const { count: prizeRecordedCount } = await admin
      .from('event_survey_entries')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .not('prize_recorded_at', 'is', null)
    
    // 참여자 목록 (최근 100개)
    const { data: entries } = await admin
      .from('event_survey_entries')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('completed_at', { ascending: false })
      .limit(100)
    
    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        stats: {
          total_completed: completedCount || 0,
          total_verified: verifiedCount || 0,
          total_prize_recorded: prizeRecordedCount || 0,
        },
        entries: entries || [],
      }
    })
  } catch (error: any) {
    console.error('캠페인 상세 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 설문조사 캠페인 수정
 * PUT /api/event-survey/campaigns/[campaignId]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const body = await req.json()
    const { title, host, status, form_id, welcome_schema, completion_schema, display_schema } = body
    
    const admin = createAdminSupabase()
    
    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
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
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('role')
          .eq('agency_id', campaign.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
          hasPermission = true
        }
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update campaign' },
        { status: 403 }
      )
    }
    
    // 업데이트 데이터 구성
    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (host !== undefined) updateData.host = host?.trim() || null
    if (status !== undefined) updateData.status = status
    if (form_id !== undefined) updateData.form_id = form_id || null
    if (welcome_schema !== undefined) updateData.welcome_schema = welcome_schema
    if (completion_schema !== undefined) updateData.completion_schema = completion_schema
    if (display_schema !== undefined) updateData.display_schema = display_schema
    updateData.updated_at = new Date().toISOString()
    
    // 캠페인 업데이트
    const { data: updatedCampaign, error: updateError } = await admin
      .from('event_survey_campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select(`
        *,
        forms:form_id (
          id,
          title,
          kind,
          status
        )
      `)
      .single()
    
    if (updateError) {
      console.error('캠페인 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: updateError.message || '캠페인 업데이트에 실패했습니다' },
        { status: 500 }
      )
    }
    
    // 감사 로그
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: campaign.agency_id,
          client_id: campaign.client_id,
          action: 'CAMPAIGN_UPDATE',
          payload: { campaign_id: campaignId, changes: Object.keys(updateData) }
        })
    } catch (auditError) {
      console.warn('감사 로그 생성 실패:', auditError)
    }
    
    return NextResponse.json({ success: true, campaign: updatedCampaign })
  } catch (error: any) {
    console.error('캠페인 업데이트 API 전체 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 설문조사 캠페인 상태 변경 (간단한 업데이트용)
 * PATCH /api/event-survey/campaigns/[campaignId]
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const body = await req.json()
    const { status } = body
    
    if (!status || !['draft', 'published', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be draft, published, or closed' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, client_id, agency_id')
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
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
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('role')
          .eq('agency_id', campaign.agency_id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
          hasPermission = true
        }
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update campaign status' },
        { status: 403 }
      )
    }
    
    // 상태 업데이트
    const { data: updatedCampaign, error: updateError } = await admin
      .from('event_survey_campaigns')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single()
    
    if (updateError) {
      console.error('캠페인 상태 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: updateError.message || '상태 변경에 실패했습니다' },
        { status: 500 }
      )
    }
    
    // 감사 로그
    try {
      await admin
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          agency_id: campaign.agency_id,
          client_id: campaign.client_id,
          action: 'CAMPAIGN_STATUS_CHANGE',
          payload: { campaign_id: campaignId, status }
        })
    } catch (auditError) {
      console.warn('감사 로그 생성 실패:', auditError)
    }
    
    return NextResponse.json({ success: true, campaign: updatedCampaign })
  } catch (error: any) {
    console.error('캠페인 상태 변경 API 전체 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

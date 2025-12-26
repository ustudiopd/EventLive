import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import SurveyCampaignDetailView from './components/SurveyCampaignDetailView'

export default async function SurveyCampaignDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; campaignId: string }>
}) {
  const { clientId, campaignId } = await params
  const admin = createAdminSupabase()
  const { user, supabase } = await requireAuth()
  
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
    redirect(`/client/${clientId}/surveys`)
  }
  
  // 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  
  let hasPermission = false
  
  // 슈퍼 관리자는 항상 허용
  if (profile?.is_super_admin) {
    hasPermission = true
  } else {
    // 클라이언트 멤버십 확인
    const { data: clientMember } = await supabase
      .from('client_members')
      .select('role')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (clientMember && ['owner', 'admin', 'operator', 'analyst', 'viewer'].includes(clientMember.role)) {
      hasPermission = true
    } else {
      // 에이전시 멤버십 확인
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
    redirect(`/client/${clientId}/surveys`)
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
  
  const campaignWithStats = {
    ...campaign,
    stats: {
      total_completed: completedCount || 0,
      total_verified: verifiedCount || 0,
      total_prize_recorded: prizeRecordedCount || 0,
    },
    entries: entries || [],
  }
  
  return <SurveyCampaignDetailView campaign={campaignWithStats} clientId={clientId} />
}

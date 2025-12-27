import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createAdminSupabase } from '@/lib/supabase/admin'
import PublicDashboardClient from './PublicDashboardClient'

/**
 * 공개 대시보드 페이지
 * /event/dashboard/{code}
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  
  if (!code || code.length !== 6) {
    return {
      title: '대시보드',
    }
  }
  
  const admin = createAdminSupabase()
  
  // dashboard_code로 캠페인 조회
  const { data: campaign } = await admin
    .from('event_survey_campaigns')
    .select('title')
    .eq('dashboard_code', code.toUpperCase())
    .eq('status', 'published')
    .maybeSingle()
  
  if (!campaign) {
    return {
      title: '대시보드',
    }
  }
  
  const title = `${campaign.title} 대시보드`
  const description = `${campaign.title} 설문조사 통계 대시보드`
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  
  if (!code || code.length !== 6) {
    notFound()
  }
  
  const admin = createAdminSupabase()
  
  // dashboard_code로 캠페인 조회
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
    .eq('dashboard_code', code.toUpperCase())
    .eq('status', 'published')
    .maybeSingle()
  
  if (campaignError || !campaign) {
    notFound()
  }
  
  // 통계 정보 조회
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
  
  const campaignWithStats = {
    ...campaign,
    stats: {
      total_completed: completedCount || 0,
      total_verified: verifiedCount || 0,
      total_prize_recorded: prizeRecordedCount || 0,
    },
  }
  
  return <PublicDashboardClient campaign={campaignWithStats} />
}


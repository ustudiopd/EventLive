import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 체크인된 참여자 목록 조회 API (공개)
 * GET /api/public/event-survey/[campaignId]/verified-entries
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    
    const admin = createAdminSupabase()
    
    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id')
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // 체크인된 참여자 목록 조회 (verified_at이 있는 것만, survey_no 순서로 정렬)
    const { data: verifiedEntries, error: entriesError } = await admin
      .from('event_survey_entries')
      .select('survey_no, name, company, verified_at')
      .eq('campaign_id', campaignId)
      .not('verified_at', 'is', null)
      .order('survey_no', { ascending: true })
    
    if (entriesError) {
      console.error('체크인 목록 조회 오류:', entriesError)
      return NextResponse.json(
        { error: entriesError.message },
        { status: 500 }
      )
    }
    
    // 전체 등록자 수 조회
    const { count: totalCount } = await admin
      .from('event_survey_entries')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
    
    return NextResponse.json({
      success: true,
      total_registered: totalCount || 0,
      total_verified: verifiedEntries?.length || 0,
      entries: verifiedEntries || [],
    })
  } catch (error: any) {
    console.error('체크인 목록 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

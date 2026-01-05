import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * QR 코드 스캔 API (공개)
 * POST /api/public/event-survey/[campaignId]/scan
 * body: { code6 }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { code6 } = await req.json()
    
    if (!code6) {
      return NextResponse.json(
        { error: 'code6 is required' },
        { status: 400 }
      )
    }
    
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
    
    // code6로 참여 정보 조회
    const { data: entry, error: entryError } = await admin
      .from('event_survey_entries')
      .select('id, survey_no, code6, name, company, verified_at, prize_label')
      .eq('campaign_id', campaignId)
      .eq('code6', code6.trim())
      .maybeSingle()
    
    if (entryError) {
      console.error('참여 정보 조회 오류:', entryError)
      return NextResponse.json(
        { error: entryError.message },
        { status: 500 }
      )
    }
    
    if (!entry) {
      return NextResponse.json({
        found: false,
        message: 'QR 코드를 찾을 수 없습니다.',
      })
    }
    
    // verified_at이 null이면 자동으로 업데이트
    if (!entry.verified_at) {
      const { error: updateError } = await admin
        .from('event_survey_entries')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', entry.id)
      
      if (updateError) {
        console.error('verified_at 업데이트 오류:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }
      
      // 업데이트된 정보 다시 조회
      const { data: updatedEntry } = await admin
        .from('event_survey_entries')
        .select('survey_no, code6, name, company, verified_at, prize_label')
        .eq('id', entry.id)
        .single()
      
      return NextResponse.json({
        found: true,
        completed: true,
        survey_no: updatedEntry?.survey_no || entry.survey_no,
        code6: updatedEntry?.code6 || entry.code6,
        name: updatedEntry?.name || entry.name,
        company: updatedEntry?.company || entry.company,
        verified: true,
        verified_at: updatedEntry?.verified_at,
        prize_label: updatedEntry?.prize_label || entry.prize_label || null,
        isNewVerification: true,
      })
    }
    
    // 이미 verified된 경우
    return NextResponse.json({
      found: true,
      completed: true,
      survey_no: entry.survey_no,
      code6: entry.code6,
      name: entry.name,
      company: entry.company,
      verified: true,
      verified_at: entry.verified_at,
      prize_label: entry.prize_label || null,
      isNewVerification: false,
      message: '이미 체크인되었습니다.',
    })
  } catch (error: any) {
    console.error('QR 스캔 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

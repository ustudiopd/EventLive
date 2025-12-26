import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 공개 API: public_path로 캠페인 정보 조회
 * GET /api/public/event-survey/resolve?path=<request_path>
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // public_path로 캠페인 조회 (published 상태만)
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
      .eq('public_path', path)
      .eq('status', 'published')
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or not published' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        host: campaign.host,
        public_path: campaign.public_path,
        status: campaign.status,
        form_id: campaign.form_id,
        welcome_schema: campaign.welcome_schema,
        completion_schema: campaign.completion_schema,
        display_schema: campaign.display_schema,
        form: campaign.forms,
      }
    })
  } catch (error: any) {
    console.error('캠페인 resolve 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')
    const kind = searchParams.get('kind') // 'survey' or 'quiz'
    const availableOnly = searchParams.get('availableOnly') === 'true' // campaign_id가 null인 것만
    
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
            { error: 'Insufficient permissions to view forms' },
            { status: 403 }
          )
        }
      }
    }
    
    // Forms 조회
    let query = admin
      .from('forms')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    
    if (kind) {
      query = query.eq('kind', kind)
    }
    
    if (availableOnly) {
      // campaign_id가 null인 것만 (아직 캠페인에 연결되지 않은 폼)
      query = query.is('campaign_id', null)
    }
    
    const { data: forms, error: formsError } = await query
    
    if (formsError) {
      console.error('Forms 목록 조회 오류:', formsError)
      return NextResponse.json(
        { error: formsError.message || 'Forms 목록 조회에 실패했습니다' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      forms: forms || [] 
    })
  } catch (error: any) {
    console.error('Forms 목록 조회 API 전체 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


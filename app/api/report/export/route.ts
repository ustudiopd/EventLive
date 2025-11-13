import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const agencyId = searchParams.get('agencyId')
    const clientId = searchParams.get('clientId')
    const format = searchParams.get('format') || 'csv'
    
    if (!agencyId) {
      return NextResponse.json(
        { error: 'agencyId is required' },
        { status: 400 }
      )
    }
    
    // 권한 확인
    await requireAgencyMember(agencyId)
    
    const supabase = await createServerSupabase()
    
    // 리포트 데이터 조회
    let webinarsQuery = supabase
      .from('webinars')
      .select('id, title, start_time, created_at, client_id')
      .eq('agency_id', agencyId)
    
    if (clientId) {
      webinarsQuery = webinarsQuery.eq('client_id', clientId)
    }
    
    const { data: webinars } = await webinarsQuery
    
    // 클라이언트 정보 조회
    const clientIds = [...new Set(webinars?.map(w => w.client_id) || [])]
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
    
    const clientsMap = new Map(clientsData?.map(c => [c.id, c.name]) || [])
    
    if (format === 'csv') {
      // CSV 생성
      const headers = ['웨비나 ID', '제목', '클라이언트', '시작 시간', '생성일']
      const rows = webinars?.map(w => [
        w.id,
        w.title,
        clientsMap.get(w.client_id) || '',
        w.start_time ? new Date(w.start_time).toLocaleString('ko-KR') : '',
        new Date(w.created_at).toLocaleString('ko-KR'),
      ]) || []
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="report-${agencyId}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }
    
    return NextResponse.json({ webinars })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


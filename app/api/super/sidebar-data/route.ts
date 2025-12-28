import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 슈퍼 관리자 사이드바 데이터 조회
 */
export async function GET() {
  try {
    await requireSuperAdmin()
    const admin = createAdminSupabase()

    // 전체 에이전시 목록
    const { data: agencies } = await admin
      .from('agencies')
      .select('id, name')
      .order('name', { ascending: true })

    // 전체 클라이언트 목록 (에이전시 정보 포함)
    const { data: clients } = await admin
      .from('clients')
      .select(`
        id,
        name,
        agency_id,
        agencies:agency_id (
          id,
          name
        )
      `)
      .order('name', { ascending: true })

    return NextResponse.json({
      agencies: agencies || [],
      clients: (clients || []).map((client: any) => ({
        id: client.id,
        name: client.name,
        agencyId: client.agency_id,
        agencyName: client.agencies?.name,
      })),
    })
  } catch (error: any) {
    console.error('슈퍼 관리자 사이드바 데이터 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}





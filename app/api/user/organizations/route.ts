import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 사용자가 속한 에이전시와 클라이언트 목록 조회
 */
export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    
    // 슈퍼 관리자 확인 (JWT app_metadata 우선, 없으면 DB 확인)
    let isSuperAdmin = !!user?.app_metadata?.is_super_admin
    
    // JWT에 app_metadata가 없을 경우 fallback: DB에서 확인
    if (!isSuperAdmin) {
      const { data: profile } = await admin
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .maybeSingle()
      
      isSuperAdmin = profile?.is_super_admin || false
    }
    
    // 에이전시 목록 조회
    const { data: agencyMembers } = await admin
      .from('agency_members')
      .select(`
        role,
        agencies:agency_id (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    // 클라이언트 목록 조회 (직접 멤버로 속한 클라이언트)
    const { data: clientMembers } = await admin
      .from('client_members')
      .select(`
        role,
        clients:client_id (
          id,
          name,
          agency_id,
          created_at,
          agencies:agency_id (
            id,
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    // 에이전시 멤버인 경우, 해당 에이전시의 모든 클라이언트도 포함
    const agencyIds = (agencyMembers || []).map((am: any) => am.agencies?.id).filter(Boolean)
    let agencyClients: any[] = []
    
    if (agencyIds.length > 0) {
      const { data: clientsFromAgencies } = await admin
        .from('clients')
        .select(`
          id,
          name,
          agency_id,
          created_at,
          agencies:agency_id (
            id,
            name
          )
        `)
        .in('agency_id', agencyIds)
        .order('created_at', { ascending: false })
      
      // 에이전시 멤버로 접근 가능한 클라이언트 (직접 멤버가 아닌 경우)
      agencyClients = (clientsFromAgencies || []).map((client: any) => ({
        id: client.id,
        name: client.name,
        role: 'viewer', // 에이전시 멤버는 viewer 권한으로 접근
        agencyId: client.agency_id,
        agencyName: client.agencies?.name,
        createdAt: client.created_at,
      }))
    }
    
    // 직접 멤버로 속한 클라이언트와 에이전시를 통해 접근 가능한 클라이언트를 합치기
    const directClients = (clientMembers || []).map((cm: any) => ({
      id: cm.clients?.id,
      name: cm.clients?.name,
      role: cm.role,
      agencyId: cm.clients?.agency_id,
      agencyName: cm.clients?.agencies?.name,
      createdAt: cm.clients?.created_at,
    }))
    
    // 중복 제거 (직접 멤버가 우선)
    const clientMap = new Map()
    directClients.forEach((client: any) => {
      if (client.id) {
        clientMap.set(client.id, client)
      }
    })
    agencyClients.forEach((client: any) => {
      if (client.id && !clientMap.has(client.id)) {
        clientMap.set(client.id, client)
      }
    })
    
    const allClients = Array.from(clientMap.values())
    
    return NextResponse.json({
      isSuperAdmin,
      agencies: (agencyMembers || []).map((am: any) => ({
        id: am.agencies?.id,
        name: am.agencies?.name,
        role: am.role,
        createdAt: am.agencies?.created_at,
      })),
      clients: allClients,
    })
  } catch (error: any) {
    console.error('조직 목록 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}





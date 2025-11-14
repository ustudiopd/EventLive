import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 사용자가 특정 웨비나의 관리자인지 확인
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { userIds } = await req.json()
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds array is required' },
        { status: 400 }
      )
    }
    
    await requireAuth()
    const admin = createAdminSupabase()
    
    // 웨비나 정보 조회
    const { data: webinarRaw, error: webinarError } = await admin
      .from('webinars')
      .select('agency_id, client_id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinarRaw) {
      return NextResponse.json(
        { success: false, error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 타입 단언
    const webinar = webinarRaw as { agency_id: string | null; client_id: string }
    
    const adminUsersSet = new Set<string>()
    
    // 1. 슈퍼 관리자 확인
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, is_super_admin')
      .in('id', userIds)
    
    if (profiles) {
      profiles.forEach((p: any) => {
        if (p.is_super_admin) {
          adminUsersSet.add(p.id)
        }
      })
    }
    
    // 2. 에이전시 멤버십 확인
    if (webinar.agency_id) {
      const { data: agencyMembers } = await admin
        .from('agency_members')
        .select('user_id')
        .eq('agency_id', webinar.agency_id)
        .in('user_id', userIds)
      
      if (agencyMembers) {
        agencyMembers.forEach((m: any) => {
          adminUsersSet.add(m.user_id)
        })
      }
    }
    
    // 3. 클라이언트 멤버십 확인
    if (webinar.client_id) {
      const { data: clientMembers } = await admin
        .from('client_members')
        .select('user_id')
        .eq('client_id', webinar.client_id)
        .in('user_id', userIds)
      
      if (clientMembers) {
        clientMembers.forEach((m: any) => {
          adminUsersSet.add(m.user_id)
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      adminUserIds: Array.from(adminUsersSet),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


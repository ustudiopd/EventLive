import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 슈퍼어드민: 에이전시 삭제
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { user } = await requireSuperAdmin()
    const { agencyId } = await params
    
    const admin = createAdminSupabase()
    
    // 에이전시 조회
    const { data: agency, error: fetchError } = await admin
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single()
    
    if (fetchError || !agency) {
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      )
    }
    
    // 클라이언트 수 확인
    const { count: clientCount } = await admin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
    
    // 에이전시 삭제 (CASCADE로 관련 데이터도 삭제됨)
    const { error: deleteError } = await admin
      .from('agencies')
      .delete()
      .eq('id', agencyId)
    
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    try {
      await admin.from('audit_logs').insert({
        actor_user_id: user.id,
        action: 'SUPER_ADMIN_AGENCY_DELETE',
        payload: { 
          agency_id: agencyId, 
          agency_name: agency.name,
          deleted_clients_count: clientCount || 0
        }
      })
    } catch (auditError) {
      console.warn('감사 로그 기록 실패:', auditError)
    }
    
    return NextResponse.json({ 
      success: true,
      message: `에이전시 "${agency.name}"가 삭제되었습니다. (연관된 클라이언트 ${clientCount || 0}개도 함께 삭제됨)`
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


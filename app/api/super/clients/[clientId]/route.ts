import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 슈퍼어드민: 클라이언트 삭제
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { user } = await requireSuperAdmin()
    const { clientId } = await params
    
    const admin = createAdminSupabase()
    
    // 클라이언트 조회
    const { data: client, error: fetchError } = await admin
      .from('clients')
      .select('id, name, agency_id')
      .eq('id', clientId)
      .single()
    
    if (fetchError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }
    
    // 웨비나 수 확인
    const { count: webinarCount } = await admin
      .from('webinars')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
    
    // 클라이언트 삭제 (CASCADE로 관련 데이터도 삭제됨)
    const { error: deleteError } = await admin
      .from('clients')
      .delete()
      .eq('id', clientId)
    
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
        agency_id: client.agency_id,
        action: 'SUPER_ADMIN_CLIENT_DELETE',
        payload: { 
          client_id: clientId, 
          client_name: client.name,
          deleted_webinars_count: webinarCount || 0
        }
      })
    } catch (auditError) {
      console.warn('감사 로그 기록 실패:', auditError)
    }
    
    return NextResponse.json({ 
      success: true,
      message: `클라이언트 "${client.name}"가 삭제되었습니다. (연관된 웨비나 ${webinarCount || 0}개도 함께 삭제됨)`
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


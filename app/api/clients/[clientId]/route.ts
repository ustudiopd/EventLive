import { NextResponse } from 'next/server'
import { requireClientMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params
    
    // 권한 확인 (viewer 이상)
    await requireClientMember(clientId, ['owner', 'admin', 'operator', 'analyst', 'viewer'])
    
    const admin = createAdminSupabase()
    
    // 클라이언트 정보 조회
    const { data: client, error } = await admin
      .from('clients')
      .select('id, name, logo_url, brand_config')
      .eq('id', clientId)
      .single()
    
    if (error || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, client })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


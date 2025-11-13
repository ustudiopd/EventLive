import { NextResponse } from 'next/server'
import { requireClientMember } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params
    const { logoUrl, brandConfig } = await req.json()
    
    // 권한 확인 (클라이언트 owner/admin만)
    await requireClientMember(clientId, ['owner', 'admin'])
    
    const admin = createAdminSupabase()
    
    // 브랜딩 설정 업데이트
    const { data: client, error: clientError } = await admin
      .from('clients')
      .update({
        logo_url: logoUrl || null,
        brand_config: brandConfig || null,
      })
      .eq('id', clientId)
      .select()
      .single()
    
    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
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


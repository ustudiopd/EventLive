import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// 허용된 이메일 목록 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const admin = createAdminSupabase()
    
    const { data: emails, error } = await admin
      .from('webinar_allowed_emails')
      .select('email')
      .eq('webinar_id', webinarId)
      .order('created_at', { ascending: true })
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      emails: emails?.map(e => e.email) || [] 
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}






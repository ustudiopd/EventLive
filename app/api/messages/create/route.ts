import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { webinarId, content } = await req.json()
    
    if (!webinarId || !content) {
      return NextResponse.json(
        { error: 'webinarId and content are required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // 웨비나 정보 조회 (agency_id, client_id 가져오기)
    const admin = createAdminSupabase()
    const { data: webinar } = await admin
      .from('webinars')
      .select('agency_id, client_id')
      .eq('id', webinarId)
      .single()
    
    if (!webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 메시지 내용 검증
    const trimmedContent = content.trim()
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      return NextResponse.json(
        { error: 'Message content must be between 1 and 500 characters' },
        { status: 400 }
      )
    }
    
    // 메시지 생성
    const { data: message, error: messageError } = await admin
      .from('messages')
      .insert({
        agency_id: webinar.agency_id,
        client_id: webinar.client_id,
        webinar_id: webinarId,
        user_id: user.id,
        content: trimmedContent,
      })
      .select()
      .single()
    
    if (messageError) {
      return NextResponse.json(
        { error: messageError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


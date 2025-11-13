import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 웨비나에 참여자 등록 (자동 등록)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { user } = await requireAuth()
    const admin = createAdminSupabase()
    
    // 웨비나 존재 확인
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 이미 등록되어 있는지 확인
    const { data: existingRegistration } = await admin
      .from('registrations')
      .select('webinar_id, user_id')
      .eq('webinar_id', webinarId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (existingRegistration) {
      // 이미 등록되어 있으면 성공 반환
      return NextResponse.json({ success: true, alreadyRegistered: true })
    }
    
    // 등록 생성 (attendee 역할)
    const { error: registerError } = await admin
      .from('registrations')
      .insert({
        webinar_id: webinarId,
        user_id: user.id,
        role: 'attendee',
      })
    
    if (registerError) {
      // 중복 키 에러는 무시 (동시 요청 시 발생 가능)
      if (registerError.code === '23505') {
        return NextResponse.json({ success: true, alreadyRegistered: true })
      }
      
      return NextResponse.json(
        { error: registerError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


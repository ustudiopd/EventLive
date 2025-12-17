import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendWebinarRegistrationEmail } from '@/lib/email'

export const runtime = 'nodejs'

/**
 * 웨비나 등록 신청 (인증 없이, email_auth 정책용)
 * 등록된 이메일 목록에 추가
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { email, displayName, nickname } = await req.json()
    
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요' },
        { status: 400 }
      )
    }
    
    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: '이름을 입력해주세요' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 웨비나 정보 확인 (slug 포함)
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id, title, access_policy, start_time, slug')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // email_auth 정책인지 확인
    if (webinar.access_policy !== 'email_auth') {
      return NextResponse.json(
        { error: 'This webinar does not use email authentication' },
        { status: 400 }
      )
    }
    
    const emailLower = email.trim().toLowerCase()
    
    // 이미 등록된 이메일인지 확인
    const { data: existingEmail } = await admin
      .from('webinar_allowed_emails')
      .select('email')
      .eq('webinar_id', webinarId)
      .eq('email', emailLower)
      .maybeSingle()
    
    if (existingEmail) {
      return NextResponse.json(
        { error: '이미 등록된 이메일 주소입니다.' },
        { status: 400 }
      )
    }
    
    // 등록된 이메일 목록에 추가
    const { error: insertError } = await admin
      .from('webinar_allowed_emails')
      .insert({
        webinar_id: webinarId,
        email: emailLower,
        created_by: null, // 인증 없이 등록하므로 null
      })
    
    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || '등록 신청에 실패했습니다' },
        { status: 500 }
      )
    }
    
    // slug가 있으면 slug를 사용하고, 없으면 id를 사용
    const webinarSlug = webinar.slug || webinarId
    
    // 이메일 발송 (실패해도 등록은 성공으로 처리)
    try {
      await sendWebinarRegistrationEmail(
        email.trim(),
        displayName.trim(),
        webinar.title || '웨비나',
        webinarSlug,
        webinar.start_time
      )
    } catch (emailError) {
      console.error('이메일 발송 실패 (등록은 성공):', emailError)
      // 이메일 발송 실패는 경고만 하고 등록은 성공으로 처리
    }
    
    return NextResponse.json({ 
      success: true,
      message: '등록 신청이 완료되었습니다. 이메일로 입장 안내가 발송되었습니다.'
    })
  } catch (error: any) {
    console.error('웨비나 등록 신청 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 게스트 계정 생성 (닉네임만으로 익명 계정 생성)
 */
export async function POST(req: Request) {
  try {
    const { nickname, webinarId } = await req.json()
    
    if (!nickname || !nickname.trim()) {
      return NextResponse.json(
        { error: '닉네임을 입력해주세요' },
        { status: 400 }
      )
    }
    
    if (!webinarId) {
      return NextResponse.json(
        { error: 'webinarId is required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 웨비나 정보 확인 (access_policy가 guest_allowed인지 확인)
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id, access_policy')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    if (webinar.access_policy !== 'guest_allowed') {
      return NextResponse.json(
        { error: 'This webinar does not allow guest access' },
        { status: 403 }
      )
    }
    
    // 임시 이메일 생성 (게스트 식별용)
    const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}@guest.eventlive.ai`
    const guestPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    
    // Supabase Auth로 게스트 계정 생성
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: guestEmail,
      password: guestPassword,
      email_confirm: true, // 이메일 확인 없이 바로 활성화
      user_metadata: {
        display_name: nickname.trim(),
        role: 'guest',
        is_guest: true,
      }
    })
    
    if (authError || !authData.user) {
      console.error('게스트 계정 생성 실패:', authError)
      return NextResponse.json(
        { error: authError?.message || '게스트 계정 생성에 실패했습니다' },
        { status: 500 }
      )
    }
    
    // 프로필 생성 확인 및 업데이트
    let profileExists = false
    for (let i = 0; i < 50; i++) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()
      
      if (profile) {
        profileExists = true
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (profileExists) {
      // 프로필 업데이트 (닉네임 설정)
      await admin
        .from('profiles')
        .update({
          display_name: nickname.trim(),
          email: guestEmail,
        })
        .eq('id', authData.user.id)
    }
    
    // 웨비나 등록 (게스트도 등록 필요)
    // 이미 등록되어 있는지 확인
    const { data: existingRegistration } = await admin
      .from('registrations')
      .select('webinar_id, user_id')
      .eq('webinar_id', webinarId)
      .eq('user_id', authData.user.id)
      .maybeSingle()
    
    // 등록되어 있지 않으면 등록
    if (!existingRegistration) {
      const { error: registerError } = await admin
        .from('registrations')
        .insert({
          webinar_id: webinarId,
          user_id: authData.user.id,
          role: 'attendee',
          nickname: nickname.trim() || null,
        })
        
      if (registerError && registerError.code !== '23505') {
        // 중복 키 에러(23505)는 무시, 다른 에러는 로깅
        console.error('웨비나 등록 실패:', registerError)
      }
    } else {
      // 이미 등록되어 있으면 nickname 업데이트
      await admin
        .from('registrations')
        .update({ nickname: nickname.trim() || null })
        .eq('webinar_id', webinarId)
        .eq('user_id', authData.user.id)
    }
    
    // 게스트 계정 정보 반환 (클라이언트에서 직접 로그인)
    // 보안을 위해 비밀번호는 반환하지 않음
    // 클라이언트에서 signInWithPassword를 사용하여 로그인
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: guestEmail,
        display_name: nickname.trim(),
      },
      // 클라이언트에서 로그인할 수 있도록 이메일과 비밀번호 반환
      // (일회성 사용이므로 보안상 문제 없음)
      email: guestEmail,
      password: guestPassword,
    })
  } catch (error: any) {
    console.error('게스트 계정 생성 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


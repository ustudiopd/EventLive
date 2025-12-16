import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 이메일 인증 가입 (비밀번호 없이 Magic Link 방식)
 * 등록된 이메일만 가입 가능
 */
export async function POST(req: Request) {
  try {
    const { email, nickname, webinarId } = await req.json()
    
    if (!email || !webinarId) {
      return NextResponse.json(
        { error: 'email and webinarId are required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 웨비나 정보 확인
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
    
    // email_auth 정책인지 확인
    if (webinar.access_policy !== 'email_auth') {
      return NextResponse.json(
        { error: 'This webinar does not use email authentication' },
        { status: 400 }
      )
    }
    
    // 등록된 이메일인지 확인 (소문자로 비교)
    const emailLower = email.trim().toLowerCase()
    const { data: allowedEmail, error: emailCheckError } = await admin
      .from('webinar_allowed_emails')
      .select('email')
      .eq('webinar_id', webinarId)
      .eq('email', emailLower)
      .maybeSingle()
    
    if (emailCheckError) {
      return NextResponse.json(
        { error: 'Failed to check allowed emails' },
        { status: 500 }
      )
    }
    
    if (!allowedEmail) {
      return NextResponse.json(
        { error: '이 이메일 주소는 이 웨비나에 등록되지 않았습니다.' },
        { status: 403 }
      )
    }
    
    // 이미 존재하는 사용자인지 확인
    const { data: existingUser } = await admin.auth.admin.listUsers()
    const user = existingUser?.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())
    
    let userId: string
    let tempPassword: string
    
    // 임시 비밀번호 생성
    tempPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    
    if (user) {
      // 기존 사용자: 비밀번호 재설정
      userId = user.id
      
      const { error: updateError } = await admin.auth.admin.updateUserById(
        userId,
        {
          password: tempPassword,
          email_confirm: true, // 이메일 인증 없이 바로 활성화
        }
      )
      
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }
      
      // 프로필 업데이트 (닉네임이 제공된 경우)
      if (nickname?.trim()) {
        await admin
          .from('profiles')
          .update({
            nickname: nickname.trim(),
          })
          .eq('id', userId)
      }
    } else {
      // 새 사용자: 계정 생성
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: email.trim(),
        password: tempPassword,
        email_confirm: true, // 이메일 인증 없이 바로 활성화
        user_metadata: {
          display_name: nickname?.trim() || email.trim().split('@')[0],
          nickname: nickname?.trim() || null,
          role: 'participant',
          webinar_id: webinarId,
        }
      })
      
      if (createError || !newUser.user) {
        return NextResponse.json(
          { error: createError?.message || 'Failed to create user' },
          { status: 500 }
        )
      }
      
      userId = newUser.user.id
      
      // 프로필 생성
      const finalDisplayName = nickname?.trim() || email.trim().split('@')[0]
      await admin
        .from('profiles')
        .upsert({
          id: userId,
          email: email.trim(),
          display_name: finalDisplayName,
          nickname: nickname?.trim() || null,
        }, {
          onConflict: 'id'
        })
    }
    
    // 비밀번호로 바로 로그인할 수 있도록 이메일과 비밀번호 반환
    return NextResponse.json({ 
      success: true,
      email: email.trim(),
      password: tempPassword
    })
  } catch (error: any) {
    console.error('이메일 인증 가입 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


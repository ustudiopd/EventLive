/**
 * 슈퍼어드민 계정 생성 스크립트
 * 
 * 사용법: 
 *   npx tsx scripts/seed-super-admin.ts
 * 
 * 환경 변수:
 *   SUPER_ADMIN_EMAIL=admin@example.com (선택, 기본값: admin@eventlive.ai)
 *   NEXT_PUBLIC_SUPABASE_URL (필수)
 *   SUPABASE_SERVICE_ROLE_KEY (필수)
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
// "admin"을 입력하면 "admin@eventlive.ai"로 변환 (Supabase는 이메일 형식 요구)
// 사용자는 "admin"만 입력해도 로그인 가능 (프론트엔드에서 자동 변환)
const rawEmail = process.env.SUPER_ADMIN_EMAIL || 'admin'
const email = rawEmail === 'admin' ? 'admin@eventlive.ai' : rawEmail

if (!url || !serviceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', url ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗')
  process.exit(1)
}

// 임시 비밀번호 생성 (최초 로그인 시 변경 필요)
const tempPassword = randomBytes(16).toString('hex')

;(async () => {
  const admin = createClient(url, serviceKey)

  try {
    // 1) 유저 조회/생성
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers()
    
    if (listError) {
      throw new Error(`사용자 목록 조회 실패: ${listError.message}`)
    }

    // 기존 사용자 조회 (이메일 변환 고려)
    const existingUser = users?.find(u => 
      u.email === email || (rawEmail === 'admin' && u.email === 'admin@eventlive.ai')
    )
    let userId: string | undefined = existingUser?.id

    if (!userId) {
      // 새 사용자 생성
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // 이메일 확인 없이 바로 활성화
        app_metadata: { is_super_admin: true }, // JWT 클레임에 슈퍼어드민 권한 추가
        user_metadata: {
          force_password_reset: true, // 최초 로그인 시 비밀번호 변경 강제
          display_name: 'Super Admin'
        }
      })

      if (authError) {
        throw new Error(`사용자 생성 실패: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('사용자 생성 실패: user 데이터 없음')
      }

      userId = authData.user.id
      console.log('✅ 슈퍼어드민 계정 생성:', email)
      if (rawEmail === 'admin') {
        console.log('ℹ️  로그인 시 이메일: "admin" 또는 "admin@eventlive.ai" 둘 다 사용 가능')
      }
      console.log('⚠️  임시 비밀번호:', tempPassword)
      console.log('⚠️  최초 로그인 시 비밀번호 변경이 필요합니다!')
    } else {
      console.log('ℹ️  슈퍼어드민 계정이 이미 존재합니다:', email)
      // 기존 사용자의 app_metadata 업데이트 (JWT 클레임 동기화)
      const { error: updateMetadataError } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: { is_super_admin: true }
      })
      if (updateMetadataError) {
        console.warn('⚠️  app_metadata 업데이트 실패 (무시됨):', updateMetadataError.message)
      } else {
        console.log('✅ JWT app_metadata 동기화 완료')
        console.log('ℹ️  JWT 토큰 갱신을 위해 재로그인이 필요할 수 있습니다')
      }
    }

    // 2) 프로필 확인 및 is_super_admin 설정
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, is_super_admin')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      throw new Error(`프로필 조회 실패: ${profileError.message}`)
    }

    if (!profile) {
      // 프로필이 없으면 생성 (트리거가 늦게 실행될 수 있음)
      const { error: createProfileError } = await admin
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          is_super_admin: true
        })

      if (createProfileError) {
        throw new Error(`프로필 생성 실패: ${createProfileError.message}`)
      }
      console.log('✅ 프로필 생성 및 슈퍼어드민 권한 부여')
    } else if (!profile.is_super_admin) {
      // 프로필이 있지만 슈퍼어드민이 아니면 업데이트
      const { error: updateError } = await admin
        .from('profiles')
        .update({ is_super_admin: true })
        .eq('id', userId)

      if (updateError) {
        throw new Error(`프로필 업데이트 실패: ${updateError.message}`)
      }
      console.log('✅ 슈퍼어드민 권한 부여')
    } else {
      console.log('ℹ️  이미 슈퍼어드민 권한이 설정되어 있습니다')
    }

    // 3) 감사 로그 (선택적, audit_logs 테이블이 있다면)
    try {
      await admin.from('audit_logs').insert({
        actor_user_id: userId,
        action: 'SEED_SUPER_ADMIN',
        payload: { email, created: !existingUser }
      })
    } catch (auditError) {
      // 감사 로그 실패는 무시 (테이블이 없을 수 있음)
      console.warn('⚠️  감사 로그 기록 실패 (무시됨):', auditError)
    }

    console.log('\n✅ 완료!')
    if (!existingUser) {
      console.log('\n📋 다음 단계:')
      console.log('1. 이메일:', rawEmail === 'admin' ? 'admin (또는 admin@eventlive.ai)' : email)
      console.log('2. 임시 비밀번호:', tempPassword)
      console.log('3. 로그인 후 비밀번호를 변경하세요')
    }
  } catch (error: any) {
    console.error('❌ 오류:', error.message)
    process.exit(1)
  }
})()


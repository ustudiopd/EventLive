import dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'

// .env.local 파일 로드
config({ path: resolve(process.cwd(), '.env.local') })

import { sendWebinarRegistrationEmail } from '../lib/email'

async function testEmail() {
  const testEmails = [
    'pd@ustudio.co.kr',
    'ad@ustudio.co.kr'
  ]

  const webinarTitle = '테스트 웨비나'
  const webinarId = 'test-webinar-id'

  console.log('테스트 이메일 발송 시작...\n')

  for (const email of testEmails) {
    console.log(`${email}로 이메일 발송 중...`)
    const result = await sendWebinarRegistrationEmail(
      email,
      '테스트 사용자',
      webinarTitle,
      webinarId
    )
    
    if (result) {
      console.log(`✅ ${email} - 발송 성공\n`)
    } else {
      console.log(`❌ ${email} - 발송 실패\n`)
    }
  }

  console.log('테스트 완료!')
}

testEmail().catch(console.error)


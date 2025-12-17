import dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'

// .env.local 파일 로드
config({ path: resolve(process.cwd(), '.env.local') })

import { sendWebinarRegistrationEmail } from '../lib/email'

async function testEmail() {
  const testEmail = 'ad@ustudio.co.kr'
  const webinarTitle = '인간지능x인공지능 토크쇼 : 2025년 AI 결산'
  const webinarId = '7d4ad9e9-2f69-49db-87a9-8d25cb82edee'

  console.log('테스트 이메일 발송 시작...\n')
  console.log(`받는 사람: ${testEmail}`)
  console.log(`웨비나: ${webinarTitle}`)
  console.log(`웨비나 ID: ${webinarId}\n`)

  console.log(`${testEmail}로 이메일 발송 중...`)
  const result = await sendWebinarRegistrationEmail(
    testEmail,
    '테스트 사용자',
    webinarTitle,
    webinarId
  )
  
  if (result) {
    console.log(`✅ ${testEmail} - 발송 성공\n`)
  } else {
    console.log(`❌ ${testEmail} - 발송 실패\n`)
  }

  console.log('테스트 완료!')
}

testEmail().catch(console.error)


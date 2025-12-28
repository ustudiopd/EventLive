/**
 * Excel 파일에서 참가자 리스트를 읽어 웨비나에 등록하는 스크립트
 * 
 * 사용법: npx tsx scripts/register-participants-from-excel.ts <webinarId> <excelFilePath>
 * 예시: npx tsx scripts/register-participants-from-excel.ts 7d4ad9e9-2f69-49db-87a9-8d25cb82edee "118138_참가자리스트_데이터다운로드_모두의특강인간지능x인공지능토크쇼2025년AI결산.xlsx"
 */

import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendWebinarRegistrationEmail } from '@/lib/email'

// .env.local 파일 로드
dotenv.config({ path: '.env.local' })

interface Participant {
  email: string
  name: string
  nickname?: string
}

interface RegistrationResult {
  participant: Participant
  success: boolean
  error?: string
  emailSent: boolean
}

/**
 * Excel 파일에서 참가자 데이터 추출
 */
function readParticipantsFromExcel(filePath: string): Participant[] {
  console.log(`📖 Excel 파일 읽기: ${filePath}`)
  
  const workbook = XLSX.readFile(filePath, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // JSON으로 변환
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  
  if (data.length === 0) {
    throw new Error('Excel 파일이 비어있습니다.')
  }
  
  // 헤더 행 찾기 (이메일, 이름 컬럼 찾기)
  const headerRow = data[0]
  let emailColIndex = -1
  let nameColIndex = -1
  let nicknameColIndex = -1
  
  // 컬럼 이름 패턴 매칭 (다양한 형식 지원)
  const emailPatterns = ['이메일', 'email', 'e-mail', '메일', 'mail', '이메일주소', '이메일 주소']
  const namePatterns = ['이름', 'name', '성명', '닉네임', 'nickname', '참가자명']
  const nicknamePatterns = ['닉네임', 'nickname', '별명', '별칭']
  
  headerRow.forEach((cell: any, index: number) => {
    const cellValue = String(cell || '').toLowerCase().trim()
    
    if (emailColIndex === -1 && emailPatterns.some(pattern => cellValue.includes(pattern.toLowerCase()))) {
      emailColIndex = index
      console.log(`✓ 이메일 컬럼 발견: ${cell} (인덱스 ${index})`)
    }
    
    if (nameColIndex === -1 && namePatterns.some(pattern => cellValue.includes(pattern.toLowerCase()))) {
      nameColIndex = index
      console.log(`✓ 이름 컬럼 발견: ${cell} (인덱스 ${index})`)
    }
    
    if (nicknameColIndex === -1 && nicknamePatterns.some(pattern => cellValue.includes(pattern.toLowerCase()))) {
      nicknameColIndex = index
      console.log(`✓ 닉네임 컬럼 발견: ${cell} (인덱스 ${index})`)
    }
  })
  
  if (emailColIndex === -1) {
    throw new Error('이메일 컬럼을 찾을 수 없습니다. 헤더 행에 "이메일" 또는 "email" 컬럼이 있어야 합니다.')
  }
  
  if (nameColIndex === -1) {
    throw new Error('이름 컬럼을 찾을 수 없습니다. 헤더 행에 "이름" 또는 "name" 컬럼이 있어야 합니다.')
  }
  
  // 데이터 행 파싱
  const participants: Participant[] = []
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const email = String(row[emailColIndex] || '').trim()
    const name = String(row[nameColIndex] || '').trim()
    const nickname = nicknameColIndex >= 0 ? String(row[nicknameColIndex] || '').trim() : undefined
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (email && emailRegex.test(email) && name) {
      participants.push({
        email: email.toLowerCase(),
        name,
        nickname: nickname || undefined
      })
    } else if (email || name) {
      console.warn(`⚠️  행 ${i + 1} 건너뜀: 이메일="${email}", 이름="${name}" (형식 오류)`)
    }
  }
  
  console.log(`✅ 총 ${participants.length}명의 참가자 데이터 추출 완료\n`)
  return participants
}

/**
 * 웨비나 정보 확인
 */
async function verifyWebinar(webinarId: string) {
  const admin = createAdminSupabase()
  
  const { data: webinar, error } = await admin
    .from('webinars')
    .select('id, title, access_policy, start_time, slug')
    .eq('id', webinarId)
    .single()
  
  if (error || !webinar) {
    throw new Error(`웨비나를 찾을 수 없습니다: ${webinarId}`)
  }
  
  if (webinar.access_policy !== 'email_auth') {
    throw new Error(`이 웨비나는 email_auth 정책을 사용하지 않습니다. 현재 정책: ${webinar.access_policy}`)
  }
  
  console.log(`✅ 웨비나 확인 완료:`)
  console.log(`   제목: ${webinar.title}`)
  console.log(`   정책: ${webinar.access_policy}`)
  console.log(`   시작 시간: ${webinar.start_time || '미정'}`)
  console.log(`   Slug: ${webinar.slug || '없음'}\n`)
  
  return webinar
}

/**
 * 참가자 등록 (DB 직접 삽입 + 이메일 발송)
 */
async function registerParticipant(
  admin: ReturnType<typeof createAdminSupabase>,
  webinarId: string,
  webinar: { title: string; slug: string | null; start_time: string | null },
  participant: Participant
): Promise<RegistrationResult> {
  const emailLower = participant.email.toLowerCase()
  
  // 이미 등록된 이메일인지 확인
  const { data: existingEmail } = await admin
    .from('webinar_allowed_emails')
    .select('email')
    .eq('webinar_id', webinarId)
    .eq('email', emailLower)
    .maybeSingle()
  
  if (existingEmail) {
    return {
      participant,
      success: false,
      error: '이미 등록된 이메일 주소입니다.',
      emailSent: false
    }
  }
  
  // 등록된 이메일 목록에 추가
  const { error: insertError } = await admin
    .from('webinar_allowed_emails')
    .insert({
      webinar_id: webinarId,
      email: emailLower,
      created_by: null,
    })
  
  if (insertError) {
    return {
      participant,
      success: false,
      error: insertError.message || '등록 실패',
      emailSent: false
    }
  }
  
  // 이메일 발송
  let emailSent = false
  const webinarSlug = webinar.slug || webinarId
  
  try {
    await sendWebinarRegistrationEmail(
      participant.email,
      participant.name,
      webinar.title || '웨비나',
      webinarSlug,
      webinar.start_time
    )
    emailSent = true
  } catch (emailError) {
    console.error(`⚠️  이메일 발송 실패 (등록은 성공): ${participant.email}`, emailError)
    // 이메일 발송 실패는 경고만 하고 등록은 성공으로 처리
  }
  
  return {
    participant,
    success: true,
    emailSent
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  const webinarId = process.argv[2]
  const excelFilePath = process.argv[3]
  
  if (!webinarId) {
    console.error('❌ 사용법: npx tsx scripts/register-participants-from-excel.ts <webinarId> <excelFilePath>')
    console.error('예시: npx tsx scripts/register-participants-from-excel.ts 7d4ad9e9-2f69-49db-87a9-8d25cb82edee "118138_참가자리스트_데이터다운로드_모두의특강인간지능x인공지능토크쇼2025년AI결산.xlsx"')
    process.exit(1)
  }
  
  if (!excelFilePath) {
    console.error('❌ Excel 파일 경로를 입력해주세요.')
    process.exit(1)
  }
  
  // 환경 변수 확인
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ 환경 변수가 설정되지 않았습니다.')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗')
    console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
    process.exit(1)
  }
  
  try {
    // 1. Excel 파일 읽기
    const fullPath = join(process.cwd(), excelFilePath)
    const participants = readParticipantsFromExcel(fullPath)
    
    if (participants.length === 0) {
      console.error('❌ 등록할 참가자가 없습니다.')
      process.exit(1)
    }
    
    // 2. 웨비나 확인
    const webinar = await verifyWebinar(webinarId)
    
    // 3. 참가자 등록
    console.log(`🚀 ${participants.length}명의 참가자 등록 시작...\n`)
    
    const admin = createAdminSupabase()
    const results: RegistrationResult[] = []
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i]
      const progress = `[${i + 1}/${participants.length}]`
      
      process.stdout.write(`${progress} ${participant.name} (${participant.email}) 등록 중... `)
      
      const result = await registerParticipant(admin, webinarId, webinar, participant)
      results.push(result)
      
      if (result.success) {
        console.log(`✅ 성공${result.emailSent ? ' (이메일 발송됨)' : ' (이메일 발송 실패)'}`)
      } else {
        console.log(`❌ 실패: ${result.error}`)
      }
      
      // API 호출 제한을 위한 짧은 딜레이
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // 4. 결과 리포트
    console.log('\n' + '='.repeat(60))
    console.log('📊 등록 결과 리포트')
    console.log('='.repeat(60))
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const duplicateCount = results.filter(r => r.error?.includes('이미 등록된')).length
    const emailSentCount = results.filter(r => r.emailSent).length
    const emailFailCount = results.filter(r => r.success && !r.emailSent).length
    
    console.log(`\n✅ 성공: ${successCount}명`)
    console.log(`❌ 실패: ${failCount}명`)
    console.log(`   - 중복 등록: ${duplicateCount}명`)
    console.log(`   - 기타 오류: ${failCount - duplicateCount}명`)
    console.log(`\n📧 이메일 발송:`)
    console.log(`   ✅ 발송 성공: ${emailSentCount}명`)
    console.log(`   ⚠️  발송 실패: ${emailFailCount}명`)
    
    if (failCount > 0) {
      console.log(`\n❌ 실패한 참가자 목록:`)
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   - ${r.participant.name} (${r.participant.email}): ${r.error}`)
        })
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ 등록 작업 완료!')
    console.log('='.repeat(60))
    
  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main().catch(console.error)








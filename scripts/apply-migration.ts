/**
 * 마이그레이션 실행 스크립트
 * Supabase Admin 클라이언트를 사용하여 마이그레이션을 실행합니다.
 * 
 * 사용법: npx tsx scripts/apply-migration.ts 011_create_client_invitations.sql
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('사용법: npx tsx scripts/apply-migration.ts <migration-file>')
  process.exit(1)
}

async function applyMigration() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  // 마이그레이션 파일 읽기
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile)
  console.log(`마이그레이션 파일 읽기: ${migrationPath}`)
  
  const sql = readFileSync(migrationPath, 'utf-8')
  
  // SQL 문장들을 분리 (세미콜론 기준)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`실행할 SQL 문장 수: ${statements.length}`)
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    console.log(`\n[${i + 1}/${statements.length}] 실행 중...`)
    console.log(statement.substring(0, 100) + '...')
    
    try {
      // Supabase는 직접 SQL 실행을 지원하지 않으므로, 각 문장을 적절히 처리
      // CREATE TABLE, CREATE INDEX, ALTER TABLE 등은 직접 실행 불가
      // 대신 Supabase Dashboard의 SQL Editor에서 실행해야 함
      
      // 하지만 일부 작업은 가능: 예를 들어 데이터 삽입 등
      console.log('⚠️  이 마이그레이션은 Supabase Dashboard의 SQL Editor에서 직접 실행해야 합니다.')
      console.log('📝 SQL 파일 위치:', migrationPath)
      break
    } catch (error: any) {
      console.error(`❌ 오류:`, error.message)
      throw error
    }
  }
  
  console.log('\n✅ 마이그레이션 파일 준비 완료')
  console.log('📋 다음 단계:')
  console.log('1. Supabase Dashboard (https://supabase.com/dashboard) 접속')
  console.log('2. 프로젝트 선택')
  console.log('3. SQL Editor 메뉴로 이동')
  console.log('4. 아래 SQL을 복사하여 실행:')
  console.log('\n' + '='.repeat(60))
  console.log(sql)
  console.log('='.repeat(60))
}

applyMigration().catch(console.error)


/**
 * client_invitations 테이블 확인 및 생성 스크립트
 * Admin 클라이언트를 사용하여 테이블이 없으면 생성합니다.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkAndCreate() {
  console.log('🔍 client_invitations 테이블 확인 중...')
  
  // 테이블 존재 확인
  const { data: tables, error: tableError } = await admin
    .from('client_invitations')
    .select('id')
    .limit(1)
  
  if (!tableError && tables !== null) {
    console.log('✅ client_invitations 테이블이 이미 존재합니다.')
    return
  }
  
  // 테이블이 없으면 생성 안내
  console.log('❌ client_invitations 테이블이 없습니다.')
  console.log('\n📋 다음 SQL을 Supabase Dashboard의 SQL Editor에서 실행하세요:')
  console.log('\n' + '='.repeat(70))
  
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '011_create_client_invitations.sql')
  const sql = readFileSync(migrationPath, 'utf-8')
  console.log(sql)
  
  console.log('='.repeat(70))
  console.log('\n📍 Supabase Dashboard: https://supabase.com/dashboard')
  console.log('   1. 프로젝트 선택')
  console.log('   2. SQL Editor 메뉴로 이동')
  console.log('   3. 위 SQL을 복사하여 실행')
}

checkAndCreate().catch(console.error)


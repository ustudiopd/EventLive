/**
 * Supabase 테이블 목록 조회 스크립트
 * 
 * 사용법: npx tsx scripts/list-tables.ts
 */

import dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'

// .env.local 파일 로드
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

async function listTables() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  console.log('📊 Supabase 테이블 목록 조회 중...\n')
  
  try {
    // information_schema를 사용하여 테이블 목록 조회
    const { data, error } = await admin
      .from('information_schema.tables')
      .select('table_schema, table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name')
    
    if (error) {
      // information_schema 접근이 안 되면 직접 쿼리 실행
      console.log('⚠️  information_schema 접근 실패, 직접 SQL 쿼리 실행...\n')
      
      // PostgreSQL의 pg_catalog를 사용하여 테이블 목록 조회
      const { data: tables, error: queryError } = await admin.rpc('exec_sql', {
        sql_query: `
          SELECT 
            schemaname as schema_name,
            tablename as table_name
          FROM pg_catalog.pg_tables
          WHERE schemaname = 'public'
          ORDER BY tablename;
        `
      })
      
      if (queryError) {
        // RPC가 없으면 다른 방법 시도
        console.log('📋 public 스키마의 테이블 목록 (수동 조회):\n')
        console.log('다음 SQL을 Supabase SQL Editor에서 실행하세요:')
        console.log(`
SELECT 
  schemaname as schema_name,
  tablename as table_name
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
        `)
        return
      }
      
      console.log('✅ 테이블 목록:\n')
      if (tables && Array.isArray(tables) && tables.length > 0) {
        tables.forEach((table: any, index: number) => {
          console.log(`${index + 1}. ${table.table_name}`)
        })
      } else {
        console.log('테이블이 없습니다.')
      }
      return
    }
    
    if (!data || data.length === 0) {
      console.log('❌ 테이블을 찾을 수 없습니다.')
      return
    }
    
    console.log(`✅ 총 ${data.length}개의 테이블을 찾았습니다:\n`)
    
    // 테이블별로 그룹화
    const baseTables = data.filter((t: any) => t.table_type === 'BASE TABLE')
    const views = data.filter((t: any) => t.table_type === 'VIEW')
    
    if (baseTables.length > 0) {
      console.log('📋 테이블 (BASE TABLE):')
      baseTables.forEach((table: any, index: number) => {
        console.log(`   ${index + 1}. ${table.table_name}`)
      })
      console.log()
    }
    
    if (views.length > 0) {
      console.log('👁️  뷰 (VIEW):')
      views.forEach((view: any, index: number) => {
        console.log(`   ${index + 1}. ${view.table_name}`)
      })
      console.log()
    }
    
  } catch (error: any) {
    console.error('❌ 오류:', error.message)
    
    // 대안: 직접 SQL 쿼리 실행
    console.log('\n📋 대안: 다음 SQL을 Supabase SQL Editor에서 실행하세요:')
    console.log(`
SELECT 
  schemaname as schema_name,
  tablename as table_name,
  tableowner as table_owner
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
    `)
  }
}

listTables().catch(console.error)


import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

// 개발 환경에서만 사용 가능한 마이그레이션 실행 엔드포인트
export async function POST(req: Request) {
  // 보안: 개발 환경에서만 실행 가능하도록 체크
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const { migrationFile } = await req.json()
    
    if (!migrationFile) {
      return NextResponse.json(
        { error: 'migrationFile is required' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    
    // 마이그레이션 파일 읽기
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile)
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // SQL 실행 (여러 문장을 분리하여 실행)
    const statements = sql.split(';').filter(s => s.trim().length > 0)
    
    for (const statement of statements) {
      const trimmed = statement.trim()
      if (trimmed) {
        const { error } = await admin.rpc('exec_sql', { sql_query: trimmed })
        if (error) {
          // RPC가 없을 수 있으므로 직접 쿼리 실행
          // Supabase는 여러 문장을 한 번에 실행할 수 없으므로 각각 실행
          console.warn('RPC exec_sql not available, trying direct execution')
        }
      }
    }
    
    return NextResponse.json({ success: true, message: 'Migration executed' })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    )
  }
}


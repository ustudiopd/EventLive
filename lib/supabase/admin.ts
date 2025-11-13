import { createClient } from '@supabase/supabase-js'

/**
 * 서버 전용 Supabase Admin 클라이언트
 * 절대 클라이언트 번들에 포함되지 않도록 주의!
 */
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}


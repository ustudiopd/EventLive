import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저용 Supabase 클라이언트 생성
 * 브라우저 환경에서는 커스텀 도메인(must.ai.kr)을 사용하고,
 * 서버 환경에서는 원래 Supabase URL을 사용합니다.
 */
export function createClientSupabase() {
  // 브라우저 환경일 때만 커스텀 도메인 사용
  const supabaseUrl = typeof window !== 'undefined' 
    ? 'https://must.ai.kr' 
    : process.env.NEXT_PUBLIC_SUPABASE_URL!

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}


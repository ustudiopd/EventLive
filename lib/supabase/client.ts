import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저용 Supabase 클라이언트 생성
 * 
 * 주의: WebSocket(Realtime)은 Next.js rewrites로 프록시할 수 없으므로
 * 원래 Supabase URL을 사용해야 합니다.
 * 
 * Next.js rewrites는 HTTP 요청만 프록시할 수 있고, WebSocket 연결은 프록시할 수 없습니다.
 * 따라서 Realtime 기능을 사용하려면 반드시 원래 Supabase URL을 사용해야 합니다.
 */
export function createClientSupabase() {
  // WebSocket 연결 문제를 방지하기 위해 원래 Supabase URL 사용
  // Realtime은 WebSocket(wss://)을 사용하므로 rewrites로 프록시할 수 없음
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  // Realtime 토큰 주입 (세션이 있을 때)
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token)
    } else {
      supabase.realtime.setAuth(null)
    }
  })
  
  // 초기 세션 확인 및 토큰 주입
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token)
    }
  })
  
  return supabase
}


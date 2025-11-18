import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저용 Supabase 클라이언트 생성 (싱글턴 패턴)
 * 
 * 주의: WebSocket(Realtime)은 Next.js rewrites로 프록시할 수 없으므로
 * 원래 Supabase URL을 사용해야 합니다.
 * 
 * Next.js rewrites는 HTTP 요청만 프록시할 수 있고, WebSocket 연결은 프록시할 수 없습니다.
 * 따라서 Realtime 기능을 사용하려면 반드시 원래 Supabase URL을 사용해야 합니다.
 * 
 * 싱글턴 패턴: 인스턴스가 변경되면 Realtime 채널이 끊기므로,
 * 한 번 생성된 인스턴스를 재사용합니다.
 */
let supabaseClientInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClientSupabase() {
  // 싱글턴 패턴: 이미 생성된 인스턴스가 있으면 재사용
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }
  
  // ⚠️ 중요: WebSocket(Realtime) 연결은 Vercel 프록시를 거치면 중간에 끊어짐
  // 따라서 반드시 원본 Supabase URL(*.supabase.co)을 직접 사용해야 함
  // 
  // NEXT_PUBLIC_SUPABASE_URL이 이미 원본 URL이면 그대로 사용
  // 커스텀 도메인인 경우, 별도 환경 변수 NEXT_PUBLIC_SUPABASE_ORIGIN_URL 사용
  // 또는 NEXT_PUBLIC_SUPABASE_URL을 원본 URL로 설정
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  // 원본 Supabase URL 확인 (반드시 *.supabase.co 도메인 사용)
  if (!supabaseUrl.includes('.supabase.co')) {
    // 별도 환경 변수에서 원본 URL 가져오기
    const originUrl = process.env.NEXT_PUBLIC_SUPABASE_ORIGIN_URL
    if (originUrl && originUrl.includes('.supabase.co')) {
      supabaseUrl = originUrl
      console.log('✅ Realtime 연결: 원본 Supabase URL 사용 (Vercel 프록시 우회)')
    } else {
      // 경고: 커스텀 도메인 사용 시 Realtime 연결이 불안정할 수 있음
      console.warn('⚠️ Realtime 연결 경고: NEXT_PUBLIC_SUPABASE_URL이 원본 URL(*.supabase.co)이 아닙니다.')
      console.warn('   Vercel 프록시를 거치면 WebSocket 연결이 중간에 끊어질 수 있습니다.')
      console.warn('   해결: NEXT_PUBLIC_SUPABASE_URL을 원본 URL로 설정하거나,')
      console.warn('         NEXT_PUBLIC_SUPABASE_ORIGIN_URL 환경 변수를 추가하세요.')
    }
  }
  
  supabaseClientInstance = createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  // Realtime 토큰 주입 (세션이 있을 때)
  supabaseClientInstance.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      supabaseClientInstance!.realtime.setAuth(session.access_token)
    } else {
      supabaseClientInstance!.realtime.setAuth(null)
    }
  })
  
  // 초기 세션 확인 및 토큰 주입
  supabaseClientInstance.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      supabaseClientInstance!.realtime.setAuth(session.access_token)
    }
  })
  
  return supabaseClientInstance
}


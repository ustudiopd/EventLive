import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // /super/** 경로 보호
  if (path.startsWith('/super')) {
    // 쿠키에서 세션 확인
    const response = NextResponse.next()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string, options?: any) => {
            req.cookies.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          },
          remove: (name: string, options?: any) => {
            req.cookies.set({ name, value: '', ...options })
            response.cookies.set({ name, value: '', ...options })
          },
        } as any,
      }
    )

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // 슈퍼어드민 권한 확인 (JWT app_metadata 사용 - RLS 재귀 방지)
    let isSuperAdmin = !!user?.app_metadata?.is_super_admin

    // JWT에 app_metadata가 없을 경우 fallback: Admin Supabase로 확인
    // (JWT 토큰 갱신 전까지 임시 조치)
    if (!isSuperAdmin) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: profile } = await admin
          .from('profiles')
          .select('is_super_admin')
          .eq('id', user.id)
          .maybeSingle()
        
        isSuperAdmin = !!profile?.is_super_admin
      } catch (error) {
        console.error('미들웨어 프로필 확인 오류:', error)
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super admin access required' },
        { status: 403 }
      )
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/super/:path*']
}


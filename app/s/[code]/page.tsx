import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ code: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const admin = createAdminSupabase()

  // 짧은 링크로 웨비나 ID 조회
  const { data: shortLink } = await admin
    .from('short_links')
    .select('webinar_id')
    .eq('code', code)
    .single()

  if (!shortLink) {
    return {
      title: '웨비나를 찾을 수 없습니다',
    }
  }

  // 웨비나 정보 조회 (slug 포함)
  const { data: webinar, error: webinarError } = await admin
    .from('webinars')
    .select('id, slug, title, description')
    .eq('id', shortLink.webinar_id)
    .single()

  if (webinarError || !webinar) {
    return {
      title: '웨비나를 찾을 수 없습니다',
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://must.ai.kr'
  const shortUrl = `${appUrl}/s/${code}`

  return {
    title: webinar.title || '웨비나',
    description: webinar.description || 'EventLive 웨비나에 참여하세요',
    openGraph: {
      title: webinar.title || '웨비나',
      description: webinar.description || 'EventLive 웨비나에 참여하세요',
      url: shortUrl,
      siteName: 'EventLive',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: webinar.title || '웨비나',
      description: webinar.description || 'EventLive 웨비나에 참여하세요',
    },
  }
}

export default async function ShortLinkRedirectPage({ 
  params,
  searchParams 
}: PageProps) {
  try {
    const { code } = await params
    const searchParamsData = await searchParams
    console.log('[ShortLink] 시작:', { code, searchParams: Object.keys(searchParamsData || {}) })
    
    const admin = createAdminSupabase()

    // 짧은 링크로 웨비나 ID 조회
    console.log('[ShortLink] 짧은 링크 조회 시작:', code)
    const { data: shortLink, error } = await admin
      .from('short_links')
      .select('webinar_id, expires_at')
      .eq('code', code)
      .single()

    if (error || !shortLink) {
      console.error('[ShortLink] 짧은 링크 조회 실패:', { error, code })
      redirect('/')
    }
    
    console.log('[ShortLink] 짧은 링크 조회 성공:', { 
      code, 
      webinar_id: shortLink.webinar_id,
      expires_at: shortLink.expires_at 
    })

    // 만료 시간 확인
    if (shortLink.expires_at) {
      const expiresAt = new Date(shortLink.expires_at)
      if (expiresAt < new Date()) {
        console.error('[ShortLink] 만료된 링크:', { code, expires_at: shortLink.expires_at })
        redirect('/')
      }
    }

    // 웨비나 정보 조회 (slug 포함)
    console.log('[ShortLink] 웨비나 조회 시작:', shortLink.webinar_id)
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id, slug')
      .eq('id', shortLink.webinar_id)
      .single()

    if (webinarError || !webinar) {
      console.error('[ShortLink] 웨비나 조회 실패:', {
        error: webinarError,
        webinarId: shortLink.webinar_id,
        code
      })
      redirect('/')
    }
    
    console.log('[ShortLink] 웨비나 조회 성공:', {
      id: webinar.id,
      slug: webinar.slug
    })

    // slug가 있으면 slug를 사용하고, 없으면 id를 사용
    // slug가 null이거나 빈 문자열이면 id 사용
    const webinarSlug = (webinar.slug && webinar.slug.trim()) ? webinar.slug : webinar.id
    
    console.log('[ShortLink] 최종 slug 결정:', {
      code,
      webinarId: webinar.id,
      slug: webinar.slug,
      finalSlug: webinarSlug
    })

    // URL 파라미터 유지 (이메일 등)
    const queryParams = new URLSearchParams()
    if (searchParamsData?.email) {
      const emailValue = Array.isArray(searchParamsData.email) 
        ? searchParamsData.email[0] 
        : searchParamsData.email
      if (emailValue) {
        queryParams.set('email', emailValue)
      }
    }
    // 다른 파라미터도 유지
    Object.keys(searchParamsData).forEach(key => {
      if (key !== 'email' && searchParamsData[key]) {
        const value = Array.isArray(searchParamsData[key])
          ? searchParamsData[key][0]
          : searchParamsData[key]
        if (value) {
          queryParams.set(key, value)
        }
      }
    })

    const queryString = queryParams.toString()
    // Next.js redirect는 자동으로 URL 인코딩하므로, slug를 그대로 사용
    const redirectUrl = queryString 
      ? `/webinar/${webinarSlug}?${queryString}`
      : `/webinar/${webinarSlug}`

    console.log('[ShortLink] 리다이렉트 실행:', {
      code,
      redirectUrl,
      slug: webinarSlug,
      queryString
    })

    // slug로 리다이렉트 (파라미터 포함, Next.js가 자동 인코딩)
    redirect(redirectUrl)
  } catch (err: any) {
    console.error('[ShortLink] 예외 발생:', {
      error: err,
      message: err?.message,
      stack: err?.stack
    })
    redirect('/')
  }
}


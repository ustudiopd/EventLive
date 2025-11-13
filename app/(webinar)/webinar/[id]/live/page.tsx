import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WebinarView from '../components/WebinarView'

export default async function WebinarLivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminSupabase()
  const supabase = await createServerSupabase()
  
  // 웨비나 정보 조회 (RLS 우회하여 접근 가능하도록)
  const { data: webinar, error } = await admin
    .from('webinars')
    .select(`
      *,
      clients:client_id (
        id,
        name,
        logo_url,
        brand_config
      )
    `)
    .eq('id', id)
    .single()
  
  if (error || !webinar) {
    // 웨비나가 없으면 입장 페이지로 리다이렉트
    redirect(`/webinar/${id}`)
  }
  
  // 접근 정책 확인
  const { data: { user } } = await supabase.auth.getUser()
  
  if (webinar.access_policy === 'auth' && !user) {
    redirect(`/webinar/${id}`)
  }
  
  // 게스트 모드는 나중에 구현
  
  return <WebinarView webinar={webinar} />
}


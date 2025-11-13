import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WebinarView from './components/WebinarView'

export default async function WebinarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabase()
  
  // 웨비나 정보 조회
  const { data: webinar, error } = await supabase
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
    redirect('/')
  }
  
  // 접근 정책 확인
  const { data: { user } } = await supabase.auth.getUser()
  
  if (webinar.access_policy === 'auth' && !user) {
    redirect(`/login?redirect=/webinar/${id}`)
  }
  
  // 게스트 모드는 나중에 구현
  
  return <WebinarView webinar={webinar} />
}


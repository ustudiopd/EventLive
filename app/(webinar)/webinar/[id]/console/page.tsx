import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireClientMember } from '@/lib/auth/guards'
import ConsoleView from './components/ConsoleView'

export default async function ConsolePage({
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
  
  // 권한 확인 (클라이언트 operator 이상 또는 에이전시 멤버)
  const { user, role } = await requireClientMember(webinar.client_id, ['owner', 'admin', 'operator'])
  
  // viewer 역할은 운영 콘솔 접근 불가
  if (role === 'viewer') {
    redirect(`/webinar/${id}`)
  }
  
  return <ConsoleView webinar={webinar} userRole={role} />
}


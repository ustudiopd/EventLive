import { createAdminSupabase } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { getWebinarQuery } from '@/lib/utils/webinar'
import RegistrantsPageClient from './components/RegistrantsPageClient'

export default async function RegistrantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const searchParamsData = await searchParams
  const admin = createAdminSupabase()
  const { user, supabase } = await requireAuth()

  // UUID 또는 slug로 웨비나 조회
  const query = getWebinarQuery(id)

  // 웨비나 정보 조회
  const { data: webinar, error: webinarError } = await admin
    .from('webinars')
    .select(`
      *,
      clients:client_id (
        id,
        name
      )
    `)
    .eq(query.column, query.value)
    .single()

  if (webinarError || !webinar) {
    redirect('/')
  }

  // 권한 확인 (클라이언트 멤버 owner/admin/operator 또는 에이전시 owner/admin 또는 슈퍼 관리자)
  const isSuperAdmin = !!user?.app_metadata?.is_super_admin

  let hasPermission = false
  if (isSuperAdmin) {
    hasPermission = true
  } else {
    // 클라이언트 멤버 확인
    const { data: clientMember } = await supabase
      .from('client_members')
      .select('role')
      .eq('client_id', webinar.client_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
      hasPermission = true
    } else {
      // 에이전시 멤버 확인
      const client = Array.isArray(webinar.clients) ? webinar.clients[0] : webinar.clients
      if (client) {
        const { data: agency } = await supabase
          .from('clients')
          .select('agency_id')
          .eq('id', client.id)
          .single()

        if (agency?.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', agency.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()

          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }
  }

  if (!hasPermission) {
    redirect(`/webinar/${id}`)
  }

  // 등록자 목록 조회
  const { data: registrations } = await admin
    .from('registrations')
    .select(`
      *,
      profiles:user_id (
        id,
        email,
        display_name
      )
    `)
    .eq('webinar_id', webinar.id)
    .order('created_at', { ascending: false })

  return (
    <RegistrantsPageClient
      webinar={webinar}
      registrations={registrations || []}
    />
  )
}





import { createAdminSupabase } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { getWebinarQuery } from '@/lib/utils/webinar'
import StatsPageClient from './components/StatsPageClient'

export default async function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // 권한 확인 (클라이언트 멤버 owner/admin/operator/analyst/member 또는 에이전시 owner/admin/analyst 또는 슈퍼 관리자)
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

    if (clientMember && ['owner', 'admin', 'operator', 'analyst', 'member'].includes(clientMember.role)) {
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

          if (agencyMember && ['owner', 'admin', 'analyst'].includes(agencyMember.role)) {
            hasPermission = true
          } else {
            // UStudio 계정 특별 처리: 에이전시 멤버가 없으면 자동으로 추가
            const isUStudioAccount = user.email?.endsWith('@ustudio.co.kr') || user.email?.endsWith('@ustudio.com')
            if (isUStudioAccount && !agencyMember) {
              // UStudio 계정을 해당 에이전시에 owner 역할로 자동 추가
              const { error: insertError } = await admin
                .from('agency_members')
                .insert({
                  agency_id: agency.agency_id,
                  user_id: user.id,
                  role: 'owner'
                })

              if (!insertError) {
                console.log(`[Stats] UStudio 계정 ${user.email}을 에이전시 ${agency.agency_id}에 멤버로 추가했습니다.`)
                hasPermission = true
              } else {
                console.error(`[Stats] UStudio 계정 멤버 추가 실패:`, insertError)
              }
            }
          }
        }
      }
    }
  }

  if (!hasPermission) {
    redirect(`/webinar/${id}`)
  }

  return (
    <StatsPageClient
      webinar={webinar}
    />
  )
}





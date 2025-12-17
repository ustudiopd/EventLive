import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getWebinarQuery } from '@/lib/utils/webinar'
import WebinarEntry from './components/WebinarEntry'

export default async function WebinarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminSupabase()
  
  // Next.js 동적 라우트는 자동으로 URL 디코딩하므로, id는 이미 디코딩된 상태
  // UUID 또는 slug로 웨비나 조회
  const query = getWebinarQuery(id)
  
  console.log('WebinarPage 조회:', {
    id,
    queryColumn: query.column,
    queryValue: query.value
  })
  
        // 웨비나 정보 조회 (RLS 우회하여 누구나 접근 가능하도록)
        // 입장 페이지는 public이므로 기본 정보만 조회
        let queryBuilder = admin
          .from('webinars')
          .select(`
            id,
            slug,
            title,
            description,
            youtube_url,
            start_time,
            end_time,
            access_policy,
            clients:client_id (
              id,
              name,
              logo_url,
              brand_config
            )
          `)
        
        const { data: webinar, error } = await queryBuilder
          .eq(query.column, query.value)
          .single()
        
        if (error || !webinar) {
          redirect('/')
        }
        
        // clients가 배열로 반환될 수 있으므로 단일 객체로 변환
        const webinarData = {
          ...webinar,
          clients: Array.isArray(webinar.clients) ? webinar.clients[0] : webinar.clients,
        }
        
        // 모든 사용자는 입장 페이지를 거쳐야 함 (관리자 포함)
        return <WebinarEntry webinar={webinarData} />
}

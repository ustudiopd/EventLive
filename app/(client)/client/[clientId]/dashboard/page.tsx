import { requireClientMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import Link from 'next/link'
import UnifiedListItem from './components/UnifiedListItem'

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const { user, role } = await requireClientMember(clientId)
  const supabase = await createServerSupabase()
  
  // 프로필 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single()
  
  // 역할 한글명 매핑
  const roleNames: Record<string, string> = {
    owner: '소유자',
    admin: '관리자',
    operator: '운영자',
    analyst: '분석가',
    viewer: '조회자',
    member: '멤버',
  }
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  
  const admin = createAdminSupabase()
  
  // 웨비나 목록 조회
  const { data: webinars } = await admin
    .from('webinars')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  
  // 설문조사 캠페인 목록 조회
  const { data: campaigns } = await admin
    .from('event_survey_campaigns')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  
  // 웨비나와 설문조사를 통합 리스트로 변환
  const unifiedItems = [
    ...(webinars || []).map((webinar: any) => ({
      type: 'webinar' as const,
      id: webinar.id,
      slug: webinar.slug,
      title: webinar.title,
      start_time: webinar.start_time,
      created_at: webinar.created_at,
    })),
    ...(campaigns || []).map((campaign: any) => ({
      type: 'survey' as const,
      id: campaign.id,
      title: campaign.title,
      public_path: campaign.public_path,
      created_at: campaign.created_at,
    })),
  ].sort((a, b) => {
    // 최신순 정렬
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {client?.name} 대시보드
              </h1>
              <p className="text-gray-600">웨비나와 설문조사를 생성하고 관리하세요</p>
            </div>
            <div className="bg-white px-4 py-3 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">접속 계정</div>
                  <div className="font-semibold text-gray-900">{profile?.display_name || profile?.email || user.email}</div>
                  <div className="text-xs text-blue-600 mt-1">클라이언트 {roleNames[role] || role}</div>
                </div>
                <Link
                  href="/settings/profile"
                  className="ml-4 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  수정
                </Link>
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link 
              href={`/client/${clientId}/webinars/new`}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              + 웨비나 생성
            </Link>
            <Link 
              href={`/client/${clientId}/surveys/new`}
              className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              + 설문조사 생성
            </Link>
            <Link 
              href={`/client/${clientId}/settings/branding`}
              className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              🎨 브랜딩 설정
            </Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-gray-600 mb-1">웨비나 수</h2>
                <p className="text-4xl font-bold text-gray-900">{webinars?.length || 0}</p>
              </div>
              <div className="text-4xl opacity-20">🎥</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-gray-600 mb-1">설문조사 수</h2>
                <p className="text-4xl font-bold text-gray-900">{campaigns?.length || 0}</p>
              </div>
              <div className="text-4xl opacity-20">📋</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-xl font-semibold text-white">웨비나 & 설문조사 목록</h2>
          </div>
          <div className="p-6">
            {unifiedItems.length > 0 ? (
              <div className="space-y-3">
                {unifiedItems.map((item) => (
                  <UnifiedListItem 
                    key={`${item.type}-${item.id}`} 
                    item={item}
                    clientId={clientId}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-lg">웨비나나 설문조사가 없습니다.</p>
                <p className="text-sm mt-2">새 웨비나나 설문조사를 생성해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


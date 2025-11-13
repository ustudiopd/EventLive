import { requireClientMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const { user } = await requireClientMember(clientId)
  const supabase = await createServerSupabase()
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  
  const { data: webinars } = await supabase
    .from('webinars')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {client?.name} 대시보드
            </h1>
            <p className="text-gray-600">웨비나를 생성하고 관리하세요</p>
          </div>
          <div className="flex gap-3">
            <Link 
              href={`/client/${clientId}/webinars`}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              📋 웨비나 관리
            </Link>
            <Link 
              href={`/client/${clientId}/webinars/new`}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              + 웨비나 생성
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
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-xl font-semibold text-white">웨비나 목록</h2>
          </div>
          <div className="p-6">
            {webinars && webinars.length > 0 ? (
              <div className="space-y-3">
                {webinars.map((webinar) => (
                  <div key={webinar.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <div className="font-medium text-gray-800">{webinar.title}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {webinar.start_time ? new Date(webinar.start_time).toLocaleString('ko-KR') : '일정 미정'}
                      </div>
                    </div>
                    <Link 
                      href={`/webinar/${webinar.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      보기 →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">🎥</div>
                <p className="text-lg">웨비나가 없습니다.</p>
                <p className="text-sm mt-2">새 웨비나를 생성해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function SuperDashboard() {
  const { user } = await requireSuperAdmin()
  // 슈퍼어드민은 Admin Supabase 사용 (RLS 우회, 성능 향상)
  const admin = createAdminSupabase()

  // 병렬로 모든 데이터 조회 (에러 처리 포함)
  const [
    profileResult,
    agenciesCountResult,
    clientsCountResult,
    webinarsCountResult,
    recentAgenciesResult,
    recentClientsResult,
  ] = await Promise.allSettled([
    admin
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .single(),
    admin
      .from('agencies')
      .select('id', { count: 'exact', head: true }),
    admin
      .from('clients')
      .select('id', { count: 'exact', head: true }),
    admin
      .from('webinars')
      .select('id', { count: 'exact', head: true }),
    admin
      .from('agencies')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('clients')
      .select('id, name, agency_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // 결과 추출 (에러 발생 시 기본값 사용)
  const profile = profileResult.status === 'fulfilled' ? profileResult.value.data : null
  const agenciesCount = agenciesCountResult.status === 'fulfilled' ? agenciesCountResult.value.count : 0
  const clientsCount = clientsCountResult.status === 'fulfilled' ? clientsCountResult.value.count : 0
  const webinarsCount = webinarsCountResult.status === 'fulfilled' ? webinarsCountResult.value.count : 0
  const recentAgencies = recentAgenciesResult.status === 'fulfilled' ? recentAgenciesResult.value.data : []
  const recentClients = recentClientsResult.status === 'fulfilled' ? recentClientsResult.value.data : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              슈퍼 관리자 대시보드
            </h1>
            <p className="text-gray-600">전체 시스템 관리 및 모니터링</p>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg shadow border border-gray-200">
            <div className="text-sm text-gray-600">접속 계정</div>
            <div className="font-semibold text-gray-900">
              {profile?.display_name || profile?.email || user.email}
            </div>
            <div className="text-xs text-blue-600 mt-1">슈퍼 관리자</div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">에이전시 수</h2>
              <div className="text-3xl">🏢</div>
            </div>
            <p className="text-4xl font-bold text-blue-600">{agenciesCount || 0}</p>
            <Link
              href="/super/agencies"
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">클라이언트 수</h2>
              <div className="text-3xl">👥</div>
            </div>
            <p className="text-4xl font-bold text-purple-600">{clientsCount || 0}</p>
            <Link
              href="/super/clients"
              className="mt-4 inline-block text-sm text-purple-600 hover:underline"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">웨비나 수</h2>
              <div className="text-3xl">🎥</div>
            </div>
            <p className="text-4xl font-bold text-green-600">{webinarsCount || 0}</p>
          </div>
        </div>

        {/* 최근 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 최근 에이전시 */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
              <h2 className="text-xl font-semibold text-white">최근 에이전시</h2>
            </div>
            <div className="p-6">
              {recentAgencies && recentAgencies.length > 0 ? (
                <ul className="space-y-3">
                  {recentAgencies.map((agency) => (
                    <li
                      key={agency.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <span className="font-medium text-gray-800">{agency.name}</span>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(agency.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                      <Link
                        href="/super/agencies"
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        보기 →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">📭</div>
                  <p>에이전시가 없습니다</p>
                </div>
              )}
            </div>
          </div>

          {/* 최근 클라이언트 */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
              <h2 className="text-xl font-semibold text-white">최근 클라이언트</h2>
            </div>
            <div className="p-6">
              {recentClients && recentClients.length > 0 ? (
                <ul className="space-y-3">
                  {recentClients.map((client) => (
                    <li
                      key={client.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <span className="font-medium text-gray-800">{client.name}</span>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(client.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                      <Link
                        href="/super/clients"
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        보기 →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">📭</div>
                  <p>클라이언트가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


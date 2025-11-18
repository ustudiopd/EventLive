import { requireClientMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function ClientAccountsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const { user, role } = await requireClientMember(clientId)
  const supabase = await createServerSupabase()
  const admin = createAdminSupabase()
  
  // 클라이언트 정보 조회
  const { data: client } = await supabase
    .from('clients')
    .select('*, agencies(id, name)')
    .eq('id', clientId)
    .single()
  
  // 1. 이 클라이언트와 관련된 계정들 (client_members)
  const { data: clientMembers } = await admin
    .from('client_members')
    .select(`
      role,
      created_at,
      profiles:user_id (
        id,
        email,
        display_name,
        nickname
      )
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  
  // 2. 이 클라이언트를 관리할 수 있는 에이전시 (clients.agency_id)
  const agencyId = client?.agency_id
  let agencyMembers: any[] = []
  let agency: any = null
  
  if (agencyId) {
    const { data: agencyData } = await admin
      .from('agencies')
      .select('id, name, created_at')
      .eq('id', agencyId)
      .single()
    agency = agencyData
    
    // 에이전시 멤버들 조회
    const { data: members } = await admin
      .from('agency_members')
      .select(`
        role,
        created_at,
        profiles:user_id (
          id,
          email,
          display_name,
          nickname
        )
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    agencyMembers = members || []
  }
  
  // 3. 이 대시보드를 관리할 수 있는 클라이언트 목록 (같은 에이전시의 다른 클라이언트들)
  let otherClients: any[] = []
  if (agencyId) {
    const { data: clients } = await admin
      .from('clients')
      .select('id, name, created_at, status')
      .eq('agency_id', agencyId)
      .neq('id', clientId)
      .order('created_at', { ascending: false })
    otherClients = clients || []
  }
  
  // 역할 한글명 매핑
  const roleNames: Record<string, string> = {
    owner: '소유자',
    admin: '관리자',
    operator: '운영자',
    analyst: '분석가',
    viewer: '조회자',
    member: '멤버',
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            가입계정관리
          </h1>
          <p className="text-gray-600">{client?.name} 클라이언트의 계정 및 관리 조직을 확인하세요</p>
        </div>
        
        {/* 1. 이 클라이언트와 관련된 계정들 */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-xl font-semibold text-white">클라이언트 멤버 ({clientMembers?.length || 0})</h2>
            <p className="text-sm text-blue-100 mt-1">이 클라이언트에 가입된 계정 목록</p>
          </div>
          <div className="p-6">
            {clientMembers && clientMembers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">역할</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientMembers.map((member: any) => {
                      const profile = member.profiles
                      return (
                        <tr key={profile?.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {profile?.nickname || profile?.display_name || profile?.email || '익명'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{profile?.email || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              member.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                              member.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              member.role === 'operator' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {roleNames[member.role] || member.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(member.created_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-lg">멤버가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* 2. 이 클라이언트를 관리할 수 있는 에이전시 */}
        {agency && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
              <h2 className="text-xl font-semibold text-white">관리 에이전시</h2>
              <p className="text-sm text-green-100 mt-1">{agency.name}</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">에이전시 정보</div>
                <div className="text-lg font-semibold text-gray-900">{agency.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  생성일: {new Date(agency.created_at).toLocaleDateString('ko-KR')}
                </div>
                {role === 'owner' && (
                  <Link
                    href={`/agency/${agencyId}/dashboard`}
                    className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    에이전시 대시보드로 이동
                  </Link>
                )}
              </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">에이전시 멤버 ({agencyMembers.length})</h3>
                {agencyMembers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">역할</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {agencyMembers.map((member: any) => {
                          const profile = member.profiles
                          return (
                            <tr key={profile?.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {profile?.nickname || profile?.display_name || profile?.email || '익명'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{profile?.email || '-'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  member.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                                  member.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {roleNames[member.role] || member.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(member.created_at).toLocaleDateString('ko-KR')}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>에이전시 멤버가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 3. 이 대시보드를 관리할 수 있는 클라이언트 목록 (같은 에이전시의 다른 클라이언트들) */}
        {otherClients.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
              <h2 className="text-xl font-semibold text-white">같은 에이전시의 다른 클라이언트 ({otherClients.length})</h2>
              <p className="text-sm text-purple-100 mt-1">동일한 에이전시에서 관리하는 다른 클라이언트 목록</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherClients.map((otherClient: any) => (
                  <Link
                    key={otherClient.id}
                    href={`/client/${otherClient.id}/dashboard`}
                    className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{otherClient.name}</h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        otherClient.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {otherClient.status === 'active' ? '활성' : '비활성'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      생성일: {new Date(otherClient.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


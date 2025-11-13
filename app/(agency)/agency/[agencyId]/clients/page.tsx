import { requireAgencyMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'
import ClientCreateModal from './components/ClientCreateModal'
import ClientInviteModal from './components/ClientInviteModal'

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ agencyId: string }>
}) {
  const { agencyId } = await params
  const { user } = await requireAgencyMember(agencyId)
  const supabase = await createServerSupabase()
  
  const { data: agency } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', agencyId)
    .single()
  
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              클라이언트 관리
            </h1>
            <p className="text-gray-600">클라이언트를 생성하고 관리하세요</p>
          </div>
          <div className="flex gap-3">
            <ClientInviteModal agencyId={agencyId} />
            <ClientCreateModal agencyId={agencyId} />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-xl font-semibold text-white">클라이언트 목록</h2>
          </div>
          {clients && clients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {client.logo_url && (
                            <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-full mr-3 border-2 border-gray-200" />
                          )}
                          <span className="text-sm font-medium text-gray-900">{client.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          client.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(client.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                        <Link 
                          href={`/client/${client.id}/dashboard`}
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                          대시보드
                        </Link>
                        <Link 
                          href={`/client/${client.id}/settings/branding`}
                          className="text-gray-600 hover:text-gray-800 font-medium hover:underline"
                        >
                          설정
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-lg text-gray-600 mb-2">클라이언트가 없습니다</p>
              <p className="text-sm text-gray-500">새로 생성하거나 초대해주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


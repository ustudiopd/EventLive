import { requireSuperAdmin } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

export default async function AgenciesPage() {
  await requireSuperAdmin()
  const supabase = await createServerSupabase()
  
  const { data: agencies } = await supabase
    .from('agencies')
    .select('*')
    .order('created_at', { ascending: false })
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">에이전시 관리</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {agencies?.map((agency) => (
              <tr key={agency.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{agency.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{agency.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(agency.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


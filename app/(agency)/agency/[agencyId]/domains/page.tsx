import { requireAgencyMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import DomainForm from './components/DomainForm'
import DomainList from './components/DomainList'

export default async function DomainsPage({
  params,
}: {
  params: Promise<{ agencyId: string }>
}) {
  const { agencyId } = await params
  const { user } = await requireAgencyMember(agencyId, ['owner', 'admin'])
  const supabase = await createServerSupabase()
  
  const { data: agency } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', agencyId)
    .single()
  
  const { data: domains } = await supabase
    .from('domains')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            도메인 관리
          </h1>
          <p className="text-gray-600">커스텀 도메인을 등록하고 관리하세요</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">도메인 추가</h2>
          <DomainForm agencyId={agencyId} />
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">등록된 도메인</h2>
          <DomainList domains={domains || []} agencyId={agencyId} />
        </div>
      </div>
    </div>
  )
}


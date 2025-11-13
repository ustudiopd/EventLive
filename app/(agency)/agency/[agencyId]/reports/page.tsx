import { requireAgencyMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import StatsDashboard from './components/StatsDashboard'
import ExportButton from './components/ExportButton'

export default async function ReportsPage({
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
  
  // 클라이언트 목록 조회
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('agency_id', agencyId)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              리포트 및 통계
            </h1>
            <p className="text-gray-600">에이전시 통계 및 분석 데이터</p>
          </div>
          <ExportButton agencyId={agencyId} />
        </div>
        
        <StatsDashboard agencyId={agencyId} clients={clients || []} />
      </div>
    </div>
  )
}


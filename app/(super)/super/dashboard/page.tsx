import { requireSuperAdmin } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

export default async function SuperDashboard() {
  const { user } = await requireSuperAdmin()
  const supabase = await createServerSupabase()
  
  // 통계 조회
  const { data: stats } = await supabase
    .from('agencies')
    .select('id', { count: 'exact', head: true })
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">슈퍼 관리자 대시보드</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">에이전시 수</h2>
          <p className="text-3xl font-bold">{stats?.length || 0}</p>
        </div>
        {/* 추가 통계 카드들 */}
      </div>
    </div>
  )
}


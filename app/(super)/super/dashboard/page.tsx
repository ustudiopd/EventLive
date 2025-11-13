import { requireSuperAdmin } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

export default async function SuperDashboard() {
  const { user } = await requireSuperAdmin()
  const supabase = await createServerSupabase()
  
  // 프로필 정보 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single()
  
  // 통계 조회
  const { data: stats } = await supabase
    .from('agencies')
    .select('id', { count: 'exact', head: true })
  
  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">슈퍼 관리자 대시보드</h1>
        <div className="bg-white px-4 py-2 rounded-lg shadow border border-gray-200">
          <div className="text-sm text-gray-600">접속 계정</div>
          <div className="font-semibold text-gray-900">{profile?.display_name || profile?.email || user.email}</div>
          <div className="text-xs text-blue-600 mt-1">슈퍼 관리자</div>
        </div>
      </div>
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


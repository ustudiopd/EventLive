import { requireClientMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'
import BrandingForm from './components/BrandingForm'

export default async function BrandingPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const { user } = await requireClientMember(clientId, ['owner', 'admin'])
  const supabase = await createServerSupabase()
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            브랜딩 설정
          </h1>
          <p className="text-gray-600">클라이언트 브랜딩을 커스터마이징하세요</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-8">
          <BrandingForm client={client} />
        </div>
      </div>
    </div>
  )
}


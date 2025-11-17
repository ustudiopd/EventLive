import { requireSuperAdmin } from '@/lib/auth/guards'
import SuperSidebar from './_components/SuperSidebar'

export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 서버에서 확정적으로 권한 확인
  await requireSuperAdmin()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SuperSidebar />
      <main className="flex-1 ml-64">{children}</main>
    </div>
  )
}


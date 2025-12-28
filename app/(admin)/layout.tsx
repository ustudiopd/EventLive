export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // (admin) route group은 app/layout.tsx의 LayoutWrapper를 사용하므로 여기서는 중복 래핑하지 않음
  return <>{children}</>
}





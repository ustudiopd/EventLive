import { redirect } from 'next/navigation'

export default async function SurveysPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  // 설문조사 목록 페이지는 대시보드로 리다이렉트
  redirect(`/client/${clientId}/dashboard`)
}


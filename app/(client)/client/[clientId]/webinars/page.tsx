'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import WebinarEditModal from './components/WebinarEditModal'
import ShareLinkButton from '@/components/webinar/ShareLinkButton'

export default function WebinarsPage() {
  const params = useParams()
  const clientId = params?.clientId as string
  const [client, setClient] = useState<any>(null)
  const [webinars, setWebinars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingWebinar, setEditingWebinar] = useState<any>(null)
  
  useEffect(() => {
    async function fetchData() {
      if (!clientId) return
      
      try {
        // 클라이언트 정보 조회 (실패해도 계속 진행)
        try {
          const clientResponse = await fetch(`/api/clients/${clientId}`)
          if (clientResponse.ok) {
            const clientData = await clientResponse.json()
            setClient(clientData.client)
          }
        } catch (clientErr) {
          console.warn('클라이언트 정보 조회 실패:', clientErr)
          // 클라이언트 정보 조회 실패는 무시하고 계속 진행
        }
        
        // 웨비나 목록 조회 (서버 사이드 API 사용)
        const webinarsResponse = await fetch(`/api/webinars/list?clientId=${clientId}`)
        const webinarsData = await webinarsResponse.json()
        
        if (!webinarsResponse.ok) {
          throw new Error(webinarsData.error || '웨비나 조회 실패')
        }
        
        setWebinars(webinarsData.webinars || [])
      } catch (err: any) {
        console.error('데이터 조회 오류:', err)
        setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [clientId])

  const handleDelete = async (webinarId: string) => {
    if (!confirm('정말 이 웨비나를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      const response = await fetch(`/api/webinars/${webinarId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '웨비나 삭제 실패')
      }

      // 목록 새로고침
      const webinarsResponse = await fetch(`/api/webinars/list?clientId=${clientId}`)
      const webinarsData = await webinarsResponse.json()
      
      if (webinarsResponse.ok) {
        setWebinars(webinarsData.webinars || [])
      }
    } catch (err: any) {
      console.error('웨비나 삭제 오류:', err)
      alert(err.message || '웨비나 삭제 중 오류가 발생했습니다')
    }
  }

  const handleEditSuccess = async () => {
    // 목록 새로고침
    const webinarsResponse = await fetch(`/api/webinars/list?clientId=${clientId}`)
    const webinarsData = await webinarsResponse.json()
    
    if (webinarsResponse.ok) {
      setWebinars(webinarsData.webinars || [])
    }
  }
  
  const getWebinarStatus = (webinar: any) => {
    if (!webinar.start_time) return 'scheduled'
    const now = new Date()
    const start = new Date(webinar.start_time)
    const end = webinar.end_time ? new Date(webinar.end_time) : null
    
    if (end && now > end) return 'ended'
    if (now >= start) return 'live'
    return 'scheduled'
  }
  
  const getStatusBadge = (status: string) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-800',
      live: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
    }
    const labels = {
      scheduled: '예정',
      live: '진행중',
      ended: '종료',
    }
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link 
              href={`/client/${clientId}/dashboard`}
              className="text-blue-600 hover:text-blue-700 hover:underline mb-2 inline-block"
            >
              ← 대시보드로 돌아가기
            </Link>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              웨비나 목록
            </h1>
            <p className="text-gray-600">{client?.name}의 웨비나를 관리하세요</p>
          </div>
          <Link 
            href={`/client/${clientId}/webinars/new`}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
          >
            + 웨비나 생성
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-xl font-semibold text-white">웨비나 목록</h2>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">⏳</div>
                <p className="text-lg">로딩 중...</p>
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-12">
                <div className="text-5xl mb-4">❌</div>
                <p className="text-lg">{error}</p>
              </div>
            ) : webinars && webinars.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제목</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시작 시간</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">접근 정책</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {webinars.map((webinar) => {
                      const status = getWebinarStatus(webinar)
                      return (
                        <tr key={webinar.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{webinar.title}</div>
                            {webinar.description && (
                              <div className="text-sm text-gray-500 mt-1 line-clamp-1">{webinar.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {webinar.start_time 
                              ? new Date(webinar.start_time).toLocaleString('ko-KR')
                              : '일정 미정'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {webinar.access_policy === 'auth' && '인증 필요'}
                            {webinar.access_policy === 'email_auth' && '인증필요 (이메일)'}
                            {webinar.access_policy === 'guest_allowed' && '게스트 허용'}
                            {webinar.access_policy === 'invite_only' && '초대 전용'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-3 flex-wrap">
                              {(() => {
                                const webinarSlug = webinar.slug || webinar.id
                                return (
                                  <>
                                    <Link 
                                      href={`/webinar/${webinarSlug}`}
                                      className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                    >
                                      웨비나링크
                                    </Link>
                                    <ShareLinkButton 
                                      webinarId={webinar.id} 
                                      webinarTitle={webinar.title}
                                    />
                                    <Link 
                                      href={`/webinar/${webinarSlug}/live?admin=true`}
                                      className="text-green-600 hover:text-green-800 font-medium hover:underline"
                                    >
                                      관리자 접속
                                    </Link>
                                    <Link 
                                      href={`/webinar/${webinarSlug}/console`}
                                      className="text-purple-600 hover:text-purple-800 font-medium hover:underline"
                                    >
                                      콘솔
                                    </Link>
                                  </>
                                )
                              })()}
                              <button
                                onClick={() => setEditingWebinar(webinar)}
                                className="text-purple-600 hover:text-purple-800 font-medium hover:underline"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(webinar.id)}
                                className="text-red-600 hover:text-red-800 font-medium hover:underline"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">🎥</div>
                <p className="text-lg">웨비나가 없습니다.</p>
                <p className="text-sm mt-2">새 웨비나를 생성해주세요.</p>
                <Link 
                  href={`/client/${clientId}/webinars/new`}
                  className="mt-4 inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
                >
                  + 웨비나 생성
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingWebinar && (
        <WebinarEditModal
          webinar={editingWebinar}
          isOpen={!!editingWebinar}
          onClose={() => setEditingWebinar(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

